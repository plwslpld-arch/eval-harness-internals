# SWE-bench：补丁评测为什么不等于「跑一次测试」

> 本文不讲 SWE-bench 怎么用，而是借一个环境型 Eval Harness（评测框架）案例，看它怎样把仓库问题和模型补丁放进测试环境，再留下可复核的 Trial（试验）、环境终态、评分证据与汇总结果。

![SWE-bench 补丁评测机制](../assets/diagrams/swe-bench-mechanism.svg)

## 学完后应该能回答什么

读完以后，你应该能说清下面几个问题：

1. 为什么「补丁能应用」只是前置条件，不是任务通过；
2. 为什么测试进程退出码不能单独代表产品质量；
3. 为什么基础设施失败、测试失败和补丁失败必须分开记录；
4. 为什么同一个问题实例要冻结仓库版本、测试规范和镜像身份；
5. 怎样把 SWE-bench 风格的运行结果映射到本仓库的 `Trial → Attempt → Observation → Score → Gate`。

## 先建立一个具体场景

假设 Dataset 收录了一个问题：某个 Python 项目收到空输入时会错误地抛出异常。要评测这个问题，实例里至少要带上这些内容：

- 仓库与基础提交；
- 问题描述；
- 预期被修复的行为；
- 用于判定修复是否成立的测试补丁；
- 用于防止回归的测试范围；
- 构建和运行环境约束。

被测 Agent 返回 Git diff 以后，Eval Harness 不会看着 diff 猜它修没修好，而会先在冻结环境里把补丁应用到指定版本，跑完测试，再把每一步发生了什么保存下来。

## 一次 Trial 的身份是什么

要认定两次 SWE-bench 风格的 Trial 是同一次试验，问题、Target、环境和评测条件都得对得上。身份可以写成下面这样。

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

这里最容易漏掉环境和测试规范。如果只记 `instance_id + model_name`，基础镜像、依赖解析方式或选中的测试即使变了，记录里的身份看起来仍然没变，结果却已经不能直接比较。

为了把这个公式对应到本仓库的对象模型，下表列出了各个通用对象来到 SWE-bench 场景后分别指什么。

| 通用对象 | SWE-bench 场景中的含义 | 必须冻结的内容 |
| --- | --- | --- |
| Sample | 一个仓库问题实例 | 实例 ID、基础提交、问题与测试规范 |
| Target | 生成补丁的 Agent 或已保存补丁 | 模型/Agent 配置或补丁摘要 |
| Environment | 隔离的仓库运行环境 | 镜像 digest、资源限制、网络策略 |
| Trial | 一次预声明的「实例 × Target」实验 | Trial ID 与完整身份摘要 |
| Attempt | Trial 的一次基础设施执行 | Attempt 序号、租约、开始与结束时间 |
| Artifact | 补丁、日志、测试报告、环境元数据 | 内容摘要、大小、媒体类型、相对路径 |
| Observation | 评分器可以消费的规范化事实 | 补丁状态、测试结果、基础设施状态 |
| Score | 对一个 Trial 的判定 | `resolved`、`unresolved` 或 `invalid` |

## 锁定源码中的五个关键入口

本案例锁定在提交 `7a21e05772954cc81471ae19d56f436cecf43c54`，所以下面五组链接指向的都是不会随分支更新而漂移的源码位置：

1. [`run_instances()`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/run_evaluation.py#L432-L471) 负责组织实例、镜像与运行过程，单个实例的执行在 [`run_instance()`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/run_evaluation.py#L229-L268)；
2. [`exec_run_with_timeout()`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/docker_utils.py#L109-L146) 承担容器内执行与超时，清理在 [`cleanup_container()`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/docker_utils.py#L48-L87)；
3. [`get_logs_eval()`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/grading.py#L113-L152) 把测试日志解析成用例状态，[`get_eval_tests_report()`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/grading.py#L179-L218) 再据此给出实例级判定；
4. [`classify_logs()`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/infra_failure.py#L79-L86) 表达基础设施故障——它把日志归到 [`TIER_ENVIRONMENT`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/infra_failure.py#L22-L25) 这类分层里，而不是简单标记失败；
5. [`make_run_report()`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/reporting.py#L16-L55) 汇总运行结果。

这五个文件要连起来看：运行器先记下实际发生的事，基础设施层判断这次运行是否有效，评分层再解释测试结果，最后报告层才汇总已经成立的实例判定，整条证据链也就这样接了起来。

## 从补丁到判定的完整流程

### 1. 物化环境

Harness 按实例和镜像规范准备隔离环境，不过在应用补丁以前，运行器得先记下这次究竟用了什么条件：

- 实际使用的镜像 digest，而不只是可变 tag；
- 容器创建参数和资源限制；
- 基础仓库提交；
- Harness 自身版本；
- 测试规范摘要。

如果镜像没拉下来，就应记为基础设施错误，不能算作 `unresolved`，因为测试根本没有跑起来，模型也没有得到一次有效的产品判定机会。

### 2. 应用补丁

补丁至少有三种不同结果：

| 状态 | 含义 | 是否进入测试 |
| --- | --- | --- |
| `applied` | 补丁成功应用 | 是 |
| `rejected` | 补丁与基础版本不兼容 | 否，通常是产品失败 |
| `invalid` | 补丁为空、损坏或违反输入合同 | 否，按评测协议处理 |

只要仓库版本和执行环境都与声明一致，补丁应用失败通常就不能算基础设施故障，因为此时环境已经履约，真正无法执行的是 Target 给出的内容。

### 3. 执行测试

环境型代码评测通常要看两类测试信号：

- `FAIL_TO_PASS`：问题修复后应该从失败变为通过；
- `PASS_TO_PASS`：原本正确的行为必须继续通过。

如果只满足第一类，补丁可能修好了目标问题，却顺手引入了回归。如果只满足第二类，原来的问题又可能完全没修，因此你得按评测协议把两类信号合在一起，才能判定整个实例。

### 4. 区分执行错误与产品结果

测试命令返回非零退出码时，背后的原因可能完全不同：

- 测试断言失败；
- 测试收集失败；
- 依赖缺失；
- 进程超时；
- 容器被系统终止；
- Harness 无法解析日志。

如果一律压成 `0 分`，报告就分不清究竟是产品没通过，还是环境根本没把测试跑完，因此评分之前要先把实际情况整理成下面这份规范化 Observation。

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

整理好这些事实以后，评分器才能按当前协议把实例记成 `resolved` 或 `unresolved`。如果 `execution_status` 是 `timeout`，这次执行就没有留下足够的代码行为供它判断，所以评分器只能给出 `invalid/unscorable`。

### 5. 生成实例级 Score

把刚才的顺序写成教学代码，就是先检查证据能不能用，再判断产品有没有成功，简化后如下。

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

这段代码只解释机制，并未逐行复制上游实现。你要抓住的是判断顺序：先确认这份证据有效，再用它判断产品是否成功。这个顺序不能颠倒。

## Retry 为什么不能改变分母

假设计划事先声明了 100 个问题实例，每个实例只建一个 Trial，其中某个 Trial 第一次因镜像下载超时而中断，第二次才跑完，那么运行记录会是下面这个结构。

```text
100 Trials
101 Attempts
99 个一次完成 + 1 个基础设施恢复后完成
```

最终分母还是 100 个 Trial，因为第 101 次 Attempt 只是替其中一个 Trial 记录恢复过程，没有多出一个预先声明的样本。如果第一次测试失败后，又让 Agent 反复生成补丁直到通过，被测策略和采样预算就都变了，此时必须新建 Trial 身份，或者按事先声明的多样本协议来统计。

## 报告层应该显示什么

一份能让人核对的报告，至少要把下面几类数字分开列出：

- 计划 Trial 数；
- 已获得有效产品判定的 Trial 数；
- `resolved` 与 `unresolved` 数；
- 基础设施错误、证据解析错误和预算耗尽数；
- 实际 Attempt 数及重试原因；
- 每个实例对应的补丁、日志与环境摘要。

假如 100 个 Trial 里有 6 个因基础设施故障而没能判定，报告只写「94 个样本中通过 50 个，成功率 53.2%」，就把缺失的 6 个藏掉了。完整报告应列出 50 resolved、44 unresolved 和 6 invalid，这时 53.2% 只是有效样本的条件成功率，计划整体能否过关，还得看门禁怎样处理那 6 个缺失判定。

## 映射到 Reference Harness

本仓库既没有内置 Docker，也不打算复刻 SWE-bench，所以对接时要先说清各层分别做什么：

1. Target Adapter 接收 Sample，返回补丁 Artifact；
2. Environment Adapter 在隔离环境应用补丁并运行测试；
3. Observation Builder 规范化补丁、执行、测试与基础设施事实；
4. Scorer 只消费 Observation，不直接猜测日志含义；
5. Metric 聚合 Trial 级 Score；
6. Gate 同时检查解决率、无效率和证据完整性。

解决率、无效率和证据完整性各自对应不同风险，因此 Gate 得同时声明多条规则，只设一个阈值兜不住这些问题。

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

### 「测试通过率就是解决率」

不一定。解决率要对整个实例下判断，往往要同时满足多组测试和协议条件，而测试通过率数的是测试用例。两边连统计单位都不同。

### 「容器失败也算模型失败，反正用户只看结果」

这样记会把 Harness 自己靠不靠谱算进模型质量。评估线上可用性时可以另外统计端到端失败，但仍要保留原因分层。这两件事不能混，否则出了问题，你连该修 Agent 还是修基础设施都判断不了。

### 「多跑几次取最好结果更稳定」

每次都挑最好的一次，评测对象就从单次策略输出变成了多次采样里的最优输出。真要评估 `best-of-k`，就得在计划里提前写清 k、选择规则和成本，不能等结果出来以后，再把恢复重试算成策略采样。

## 自测题与参考答案

### 题 1

一个补丁应用成功，目标修复测试全部通过，但 3 个原有测试回归。它是否 resolved？

**参考答案：**取决于协议，但在同时要求目标修复和无回归的协议下应为 unresolved；补丁可应用只证明可执行，不能覆盖回归证据。

### 题 2

测试进程因宿主机磁盘已满而终止，是否给 0 分？

**参考答案：**不应直接给产品 0 分。应标记基础设施错误，使本 Attempt 无法提供有效产品判定；是否在预算内恢复由预声明策略决定。

### 题 3

为什么要记录测试规范摘要？

**参考答案：**因为测试选择和解析规则属于实验条件，所以代码和模型不变时，测试规范变化仍可能改变结果；没有摘要就无法证明两次运行可比较。

## 继续阅读

- [Agent Environment 与 Final State](../comparisons/06-agent-environment-final-state.md)
- [Retry 与 Recovery](../engineering/03-retries-and-recovery.md)
- [统计比较](../engineering/05-statistical-comparison.md)
- [Quality Gate](../engineering/07-quality-gates.md)
- [验证与证据边界](../appendices/verification.md)
