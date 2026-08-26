# 03｜Sample、Trial 与 Attempt：别让重试改写统计分母

[上一章](02-task-dataset-target-environment.md) · [下一章](04-trace-artifact-observation.md)

## 本篇要解决什么问题

调用超时后再试一次很合理；模型答错后再问一次有时也能得到正确答案。但这两种“重试”不能混为一谈。前者是在恢复同一个实验对象的基础设施执行，后者是在给被测产品额外机会。如果只记录最后一次成功，失败样本会被重试成通过，成功率分母也会随着可用结果变化。

## 学完你能解释什么

- Sample、Trial、Attempt 为什么是三层对象，而不是三个同义词；
- 为什么 Trial 是统计单位，Attempt 是恢复记录；
- canonical Attempt 怎样阻止多个结果同时进入评分；
- blocked、completed 与 Score failed 为什么可以同时出现在不同层。

## 贯穿案例

金额 100 的 Sample 分别交给 buggy 与 fixed Target，形成两个 Trial——如果 buggy 脚本正常启动并返回运费 10，这个 Trial 已完成；答案虽错，也不能再启动一次“希望它答对”。若 Python 子进程因临时资源错误没有启动，Harness 可以在预声明的两次基础设施预算内创建 Attempt 2；恢复成功后 Attempt 2 成为唯一 canonical Attempt，Attempt 1 仍保留在证据中。

## 核心概念与边界

**Sample** 是 Dataset 中稳定的输入与 Reference 单元。**Trial** 是 Sample × Target × Repetition 物化后的统计对象，它在执行前已进入计划分母。**Attempt** 是为完成一个 Trial 而发生的基础设施执行记录，记录序号、错误码和是否 canonical。

重复次数不是 Attempt。对随机模型做 5 次重复会生成 5 个 Trial，因为每次都是计划内观测；某个 Trial 因网络握手失败而恢复 2 次，仍只有 1 个统计单位。产品级 retry 若本来就是 Target 的算法——例如 Agent 自己在 Loop 内重新调用模型，应封装在同一个 Target 行为里，并在 Trace 中可见，而不是由 Eval Harness 偷偷增加 Attempt。

## 机制图

![Sample、Trial 与 Attempt 层级](../assets/diagrams/foundations/03-trial-attempt.svg)

## 调用链与状态变化

1. Planner 在运行前生成稳定 Trial ID，格式包含 run、Target、Sample 与重复序号。
2. Runner 创建 Attempt 1，调用 Target Adapter。
3. Adapter 返回正常结果时，Attempt 状态为 `succeeded` 且成为 canonical；Trial 状态为 `completed`。
4. Adapter 抛出被声明为基础设施错误的异常时，Attempt 为 `infra_failed`；若还有预算，Runner 创建下一个 Attempt。
5. 所有恢复机会耗尽后，Trial 为 `blocked`，没有 canonical Attempt，也不能伪造 Observation Bundle。
6. 产品失败由 Adapter 作为正常返回的一种结果类型传回——它仍产生 canonical Attempt，随后由 Scorer 判断失败。

这条状态机直接实现在 [`run_trial`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/runner.py)；[`tests/test_runner.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_runner.py) 分别锁住基础设施恢复、产品失败不重试和 canonical 唯一性。

## 关键数据结构

```text
Trial
  trial_id
  target_id
  sample
  repetition

Attempt
  attempt_id
  trial_id
  ordinal
  status
  canonical
  error_code
```

Trial 不保存“最终分数”，因为执行和评分是两个阶段；Attempt 也不保存 Dataset 权重，因为统计设计不属于恢复层。canonical 不是“最好的一次”，而是协议允许进入后续证据链的唯一一次；选择规则必须在看到结果前确定。

## 设计取舍

最简单的本地 Harness 可以同步执行并在内存里选择 canonical；分布式系统还需要 Lease、Fencing Token 和幂等提交，防止超时 Worker 在新 Worker 已接管后迟到写入。首版 Reference Harness 不假装实现分布式一致性，而是把“最多一个 canonical”作为模型不变量——这样课程能清楚展示语义，同时避免用复杂基础设施遮住统计问题。

Harbor 的锁定 [`Trial` 抽象基类](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/trial/trial.py#L86-L125) 展示 Agent Trial 生命周期，是**上游源码事实**。Reference Harness 的 Attempt 分层是本仓库的**教学实现**，字段不能直接当作 Harbor 内部结构的逐项翻译。

## 失败语义

- 超时、进程无法启动、临时工作区失败：基础设施错误，可按预算增加 Attempt。
- 程序返回非零且表示被测测试失败：产品失败，Trial 完成，不由 Harness 重试。
- 两个 Attempt 都标 canonical：Trial `invalid`，后续 Score 不可信。
- 只有失败 Attempt：Trial `blocked`，不是 Score 0。
- 运行后才删除困难 Trial：破坏预声明分母，整次 Metric 无效。

## 动手实验

运行 `python -m pytest tests/test_runner.py -q`。随后打开测试中的 `FlakyTarget` 和产品失败 Target，手工预测每种情况下 Attempt 数量、canonical 序号和 Trial 状态，再对照断言。最后运行 shipping 示例，统计 `run.json` 中每个 Trial 的 Attempt 数。

## 预期输出与答案

基础设施第一次失败、第二次成功时：2 个 Attempt，第二个 canonical，Trial completed。产品失败时：1 个 succeeded/canonical Attempt，Trial completed，`product_failed=true`。所有基础设施机会失败时：Attempt 数等于预算，均非 canonical，Trial blocked。shipping 正常运行中每个 Trial 只有一个 Attempt，即使 buggy 的一个 Score 最终失败。

## 常见误解

“只要最终成功，前面的 Attempt 可以删掉”会丢失可靠性与成本证据；“Attempt 越多样本越多”会造成伪重复；“blocked 就按 0 分最保守”把平台故障错误归因给产品；“模型自洽重试也必须拆 Attempt”则混淆 Target 内部策略与 Harness 恢复。

## 如何核对

阅读 [`models.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/models.py) 的分层状态枚举，再运行 `eval-harness-ref inspect` 查看计划 Trial 数和 Observation Bundle 数。检查 Metric 的 denominator 来自 Trial 清单而不是 Bundle 数。上游 SWE-bench 的 [`infra_failure.py`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/infra_failure.py) 提供了环境型评测显式处理基础设施失败的另一处源码证据。

## 与其他 Harness 的关系

benchmark 型 Harness 常把请求重试藏在 Model Adapter；声明式应用评测可能把每个 Test Case 直接称作一条结果；Agent 环境 Harness 通常有更重的 Trial 生命周期。比较这些实现时要追踪“统计分母何时确定”“产品错误是否可重试”“哪个结果进入评分”，不能只对齐 `retry` 配置名。

## 本篇不能证明什么

正确分层不会自动选择最佳重试预算，也不能保证分布式执行恰好一次。它能证明的是：在声明的本地协议内，基础设施恢复不会悄悄增加成功样本或删除失败 Trial。

[上一章](02-task-dataset-target-environment.md) · [下一章](04-trace-artifact-observation.md)
