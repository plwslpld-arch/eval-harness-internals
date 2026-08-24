# SWE-bench：补丁评测为什么不等于“跑一次测试”

> 本文不是 SWE-bench 的使用手册，而是一篇环境型 Eval Harness 机制案例。目标是解释：一个仓库问题、一个模型补丁和一组测试，怎样被转换成可复核的 Trial、环境终态、评分证据与汇总结果。

![SWE-bench 补丁评测机制](../assets/diagrams/swe-bench-mechanism.svg)

## 学完后应该能回答什么

读完本文，你应该能够解释以下问题：

1. 为什么“补丁能应用”只是前置条件，不是任务通过；
2. 为什么测试进程退出码不能单独代表产品质量；
3. 为什么基础设施失败、测试失败和补丁失败必须分开记录；
4. 为什么同一个问题实例要冻结仓库版本、测试规范和镜像身份；
5. 怎样把 SWE-bench 风格的运行结果映射到本仓库的 `Trial → Attempt → Observation → Score → Gate`。

## 先建立一个具体场景

假设 Dataset 中有一个问题实例：某个 Python 项目在空输入下错误抛出异常。实例至少包含：

- 仓库与基础提交；
- 问题描述；
- 预期被修复的行为；
- 用于判定修复是否成立的测试补丁；
- 用于防止回归的测试范围；
- 构建和运行环境约束。

被测 Agent 返回一个 Git diff。Eval Harness 的工作不是“看看 diff 像不像修复”，而是在冻结环境中把它应用到指定版本，执行测试，再把每一步的证据保存下来。

## 一次 Trial 的身份是什么

可以把一个 SWE-bench 风格 Trial 的身份写成：

```text
trial_id = hash(
  instance_id,
  target_id,
  repository_commit,
  image_digest,
  test_spec_digest,
  harness_version
)
```

这里最容易遗漏的是环境和测试规范。只记录 `instance_id + model_name` 不够，因为基础镜像、依赖解析或测试选择发生变化，都可能改变结果。

本仓库的通用对象与该场景对应如下：

| 通用对象 | SWE-bench 场景中的含义 | 必须冻结的内容 |
| --- | --- | --- |
| Sample | 一个仓库问题实例 | 实例 ID、基础提交、问题与测试规范 |
| Target | 生成补丁的 Agent 或已保存补丁 | 模型/Agent 配置或补丁摘要 |
| Environment | 隔离的仓库运行环境 | 镜像 digest、资源限制、网络策略 |
| Trial | 一次预声明的“实例 × Target”实验 | Trial ID 与完整身份摘要 |
| Attempt | Trial 的一次基础设施执行 | Attempt 序号、租约、开始与结束时间 |
| Artifact | 补丁、日志、测试报告、环境元数据 | 内容摘要、大小、媒体类型、相对路径 |
| Observation | 评分器可以消费的规范化事实 | 补丁状态、测试结果、基础设施状态 |
| Score | 对一个 Trial 的判定 | `resolved`、`unresolved` 或 `invalid` |

## 锁定源码中的五个关键入口

本案例基于锁定提交 `7a21e05772954cc81471ae19d56f436cecf43c54`。以下链接指向不可漂移的源码位置：

1. [`run_evaluation.py`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/run_evaluation.py) 负责组织实例、镜像与运行过程；
2. [`docker_utils.py`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/docker_utils.py) 承担容器相关操作；
3. [`grading.py`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/grading.py) 把测试日志解释成实例级判定；
4. [`infra_failure.py`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/infra_failure.py) 表达基础设施故障；
5. [`reporting.py`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/reporting.py) 汇总运行结果。

不要把这五个文件理解成互相独立的模块清单。它们组成的是一条证据链：运行器产生事实，基础设施层标记运行有效性，评分层解释测试结果，报告层只能聚合已经成立的实例级判定。

## 从补丁到判定的完整流程

### 1. 物化环境

Harness 根据实例和镜像规范准备隔离环境。此时需要记录：

- 实际使用的镜像 digest，而不只是可变 tag；
- 容器创建参数和资源限制；
- 基础仓库提交；
- Harness 自身版本；
- 测试规范摘要。

如果镜像拉取失败，结果应是基础设施错误，而不是 `unresolved`。模型还没有获得一次有效的产品判定机会。

### 2. 应用补丁

补丁至少有三种不同结果：

| 状态 | 含义 | 是否进入测试 |
| --- | --- | --- |
| `applied` | 补丁成功应用 | 是 |
| `rejected` | 补丁与基础版本不兼容 | 否，通常是产品失败 |
| `invalid` | 补丁为空、损坏或违反输入合同 | 否，按评测协议处理 |

“补丁无法应用”通常不是基础设施失败。只要仓库版本与执行环境符合声明，它就是 Target 产生了不可执行输出。

### 3. 执行测试

环境型代码评测常见两类测试信号：

- `FAIL_TO_PASS`：问题修复后应该从失败变为通过；
- `PASS_TO_PASS`：原本正确的行为必须继续通过。

只满足第一类可能是“修好了目标问题但引入回归”；只满足第二类则可能根本没有修复问题。实例级判定必须同时考虑评测协议要求的信号。

### 4. 区分执行错误与产品结果

一个测试命令返回非零退出码，可能表示：

- 测试断言失败；
- 测试收集失败；
- 依赖缺失；
- 进程超时；
- 容器被系统终止；
- Harness 无法解析日志。

这些情况不能都压缩成 `0 分`。推荐先构造规范化 Observation：

```json
{
  "patch_status": "applied",
  "execution_status": "completed",
  "tests": {
    "fail_to_pass": {"passed": 4, "total": 4},
    "pass_to_pass": {"passed": 117, "total": 118}
  },
  "infrastructure_error": null,
  "parser_status": "valid"
}
```

然后由评分器决定该协议下是 `resolved` 还是 `unresolved`。如果 `execution_status` 是 `timeout`，评分器应得到 `invalid/unscorable`，而不是假装观察到了代码行为。

### 5. 生成实例级 Score

教学化的判定逻辑可以写成：

```python
if observation.infrastructure_error:
    return Score(status="invalid", reason="基础设施未完成有效执行")
if observation.patch_status != "applied":
    return Score(status="failed", value=0, reason="补丁无法应用")
if not observation.parser_valid:
    return Score(status="invalid", reason="测试证据无法解析")
resolved = all_required_tests_pass(observation.tests)
return Score(status="passed" if resolved else "failed", value=int(resolved))
```

这是机制说明，不是对上游实现的逐行复制。关键设计是：先判断证据是否有效，再判断产品是否成功。

## Retry 为什么不能改变分母

假设预声明计划包含 100 个问题实例，每个实例一个 Trial。某个 Trial 第一次因镜像下载超时失败，第二次正常完成：

```text
100 Trials
101 Attempts
99 个一次完成 + 1 个基础设施恢复后完成
```

最终分母仍是 100 个 Trial，而不是 101 次 Attempt。更不能因为第一次测试失败就重新让 Agent 生成补丁，直到通过，然后仍把它当作同一个 Trial。后者已经改变了被测策略或采样预算，必须创建新的 Trial 身份或按预声明的多样本协议统计。

## 报告层应该显示什么

一个可核对的报告至少分开展示：

- 计划 Trial 数；
- 已获得有效产品判定的 Trial 数；
- `resolved` 与 `unresolved` 数；
- 基础设施错误、证据解析错误和预算耗尽数；
- 实际 Attempt 数及重试原因；
- 每个实例对应的补丁、日志与环境摘要。

如果 100 个 Trial 中有 6 个基础设施失败，报告不能写“94 个样本中通过 50 个，成功率 53.2%”而隐藏缺失数据。更诚实的表达是：50 resolved、44 unresolved、6 invalid；有效样本条件成功率为 53.2%，但计划总体结论仍需按门禁策略处理这 6 个缺失判定。

## 映射到 Reference Harness

本仓库没有内置 Docker，也不声称复刻 SWE-bench。可以用以下接口边界接入：

1. Target Adapter 接收 Sample，返回补丁 Artifact；
2. Environment Adapter 在隔离环境应用补丁并运行测试；
3. Observation Builder 规范化补丁、执行、测试与基础设施事实；
4. Scorer 只消费 Observation，不直接猜测日志含义；
5. Metric 聚合 Trial 级 Score；
6. Gate 同时检查解决率、无效率和证据完整性。

推荐的 Gate 不是单一阈值：

```yaml
rules:
  - metric: resolved_rate
    operator: gte
    threshold: 0.45
  - metric: invalid_rate
    operator: lte
    threshold: 0.02
  - metric: evidence_completeness
    operator: eq
    threshold: 1.0
```

## 常见误解

### “测试通过率就是解决率”

不一定。解决率是实例级判定，可能由多组测试和协议条件共同决定；测试通过率是测试用例级聚合。两者统计单位不同。

### “容器失败也算模型失败，反正用户只看结果”

这会把 Harness 可靠性混入模型质量。线上产品可用性评估可以额外统计端到端失败，但仍要保留原因分层，否则无法知道应该修 Agent 还是修基础设施。

### “多跑几次取最好结果更稳定”

取最好结果改变了估计对象。若要评估 `best-of-k`，必须在计划中声明 k、选择规则和成本；不能事后把恢复重试伪装成策略采样。

## 自测题与参考答案

### 题 1

一个补丁应用成功，目标修复测试全部通过，但 3 个原有测试回归。它是否 resolved？

**参考答案：**取决于协议，但在同时要求目标修复和无回归的协议下应为 unresolved。补丁可应用只证明可执行，不能覆盖回归证据。

### 题 2

测试进程因宿主机磁盘已满而终止，是否给 0 分？

**参考答案：**不应直接给产品 0 分。应标记基础设施错误，使本 Attempt 无法提供有效产品判定；是否在预算内恢复由预声明策略决定。

### 题 3

为什么要记录测试规范摘要？

**参考答案：**因为测试选择和解析规则属于实验条件。代码和模型不变时，测试规范变化仍可能改变结果；没有摘要就无法证明两次运行可比较。

## 继续阅读

- [Agent Environment 与 Final State](../comparisons/06-agent-environment-final-state.md)
- [Retry 与 Recovery](../engineering/03-retries-and-recovery.md)
- [统计比较](../engineering/05-statistical-comparison.md)
- [Quality Gate](../engineering/07-quality-gates.md)
- [验证与证据边界](../appendices/verification.md)
