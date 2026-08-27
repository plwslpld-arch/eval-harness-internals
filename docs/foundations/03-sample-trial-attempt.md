# 03｜Sample、Trial 与 Attempt：别让重试改写统计分母

[上一章](02-task-dataset-target-environment.md) · [下一章](04-trace-artifact-observation.md)

## 本篇要解决什么问题

调用超时后再试一次很合理，模型答错后再问一次也可能得到正确答案，但这两种「重试」改动的不是同一层。前一种是在基础设施出故障后，设法把同一个实验对象跑完。后一种却让被测产品多答了一次。如果你只留下最后成功的结果，原本失败的样本就会被一次次试成通过，成功率的分母也会跟着能用的结果来回变化。

## 学完你能解释什么

- Sample、Trial、Attempt 为什么是三层对象，而不是三个同义词；
- 为什么 Trial 是统计单位，Attempt 是恢复记录；
- canonical Attempt 怎样阻止多个结果同时进入评分；
- blocked、completed 与 Score failed 为什么可以同时出现在不同层。

## 贯穿案例

把金额为 100 的 Sample 分别交给 buggy 和 fixed Target，会得到两个 Trial。如果 buggy 脚本正常启动并返回运费 10，这个 Trial 就已经跑完，即使答案错了，也不能为了「希望它答对」再启动一次。如果 Python 子进程因为临时资源错误没能启动，Harness 才可以动用预先声明的基础设施恢复预算，创建 Attempt 2。等恢复成功后，Attempt 2 会成为唯一的 canonical Attempt，而 Attempt 1 仍要保留在证据里。

## 核心概念与边界

**Sample** 是 Dataset 中一份带稳定身份的输入和 Reference。Planner 把 Sample × Target × Repetition 展开后，才得到 **Trial**。每个 Trial 都是统计时要计算的一次观察，而且在执行前就已经进入计划分母。**Attempt** 则记录 Harness 为了跑完某个 Trial，实际在基础设施上尝试了几次，包括每次的序号、错误码和是否为 canonical。

重复次数不能算作 Attempt。让随机模型重复运行 5 次，会生成 5 个 Trial，因为计划把每一次都当成独立观察。某个 Trial 因为网络握手失败而恢复 2 次，统计时仍然只能算 1 次。如果 retry 原本就是 Target 算法的一部分，比如 Agent 会在 Loop 内再次调用模型，就应该让它留在同一次 Target 行为里，并通过 Trace 暴露出来，Eval Harness 不能暗中多加 Attempt。

## 机制图

![Sample、Trial 与 Attempt 层级](../assets/diagrams/foundations/03-trial-attempt.svg)

## 调用链与状态变化

1. Planner 在运行前生成稳定 Trial ID，格式包含 run、Target、Sample 与重复序号。
2. Runner 创建 Attempt 1，调用 Target Adapter。
3. Adapter 返回正常结果时，Attempt 状态为 `succeeded` 且成为 canonical；Trial 状态为 `completed`。
4. Adapter 抛出被声明为基础设施错误的异常时，Attempt 为 `infra_failed`；若还有预算，Runner 创建下一个 Attempt。
5. 所有恢复机会耗尽后，Trial 为 `blocked`，没有 canonical Attempt，也不能伪造 Observation Bundle。
6. 产品失败由 Adapter 作为正常返回的一种结果类型传回——它仍产生 canonical Attempt，随后由 Scorer 判断失败。

[`run_trial`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/runner.py) 直接实现了这套状态机，而 [`tests/test_runner.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_runner.py) 则分别用测试锁住三条规则：基础设施可以按预算恢复，产品失败不能由 Harness 重试，canonical 必须唯一。

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

Trial 不保存「最终分数」，因为 Harness 要先完成执行，再把证据交给评分阶段。Attempt 也不保存 Dataset 权重，因为负责基础设施恢复的这一层不该决定怎样统计。canonical 指向协议允许送入后续证据链的唯一一次执行，并不代表「表现最好的一次」，所以你必须在看到结果之前定好选择规则。

## 设计取舍

最简单的本地 Harness 可以同步执行，再从内存里的结果选出 canonical。分布式系统还得处理 Lease、Fencing Token 和幂等提交，否则旧 Worker 超时后，新 Worker 虽然已经接管，旧 Worker 仍可能迟到并写入结果。首版 Reference Harness 没有声称已经解决分布式一致性，它只规定「一个 Trial 最多有一个 canonical」，这样既把语义说清楚，也不会让复杂基础设施遮住真正的统计问题。

Harbor 锁定版本里的 [`Trial` 抽象基类](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/trial/trial.py#L86-L125) 展示了 Agent Trial 从创建到结束怎样变化，这是**上游源码事实**。Reference Harness 单独划出 Attempt 这一层，是本仓库的**教学实现**，不能把其中字段逐项套到 Harbor 的内部结构上。

## 失败语义

- 超时、进程无法启动、临时工作区失败：基础设施错误，可按预算增加 Attempt。
- 程序返回非零且表示被测测试失败：产品失败，Trial 完成，不由 Harness 重试。
- 两个 Attempt 都标 canonical：Trial `invalid`，后续 Score 不可信。
- 只有失败 Attempt：Trial `blocked`，不是 Score 0。
- 运行后才删除困难 Trial：破坏预声明分母，整次 Metric 无效。

## 动手实验

运行 `python -m pytest tests/test_runner.py -q`，然后打开测试里的 `FlakyTarget` 和产品失败 Target，先自己判断每种情况会创建几个 Attempt、哪一个是 canonical，以及 Trial 最后处于什么状态，再对照断言。最后运行 shipping 示例，统计 `run.json` 里每个 Trial 实际留下了几个 Attempt。

## 预期输出与答案

基础设施第一次失败、第二次成功时，你会看到 2 个 Attempt，其中第二个是 canonical，Trial 为 completed。产品失败时，只有 1 个 succeeded/canonical Attempt，Trial 仍是 completed，同时记录 `product_failed=true`。如果基础设施用完所有恢复机会仍然失败，Attempt 数会等于预算，没有任何一个是 canonical，Trial 为 blocked。shipping 正常运行时，每个 Trial 都只有一个 Attempt，即使 buggy 最后有一个 Score 判为失败也不会增加。

## 常见误解

如果认为「只要最后成功，前面的 Attempt 就可以删掉」，你会一并丢掉可靠性和成本证据。把更多 Attempt 当成更多样本，则会制造伪重复。直接给 blocked 记 0 分看似保守，其实是把平台故障算到了产品头上。如果再规定「模型为了自洽而重试也必须拆成 Attempt」，Target 的内部策略和 Harness 的基础设施恢复就又混在了一起。

## 如何核对

先读 [`models.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/models.py)，看各层状态怎样枚举，再运行 `eval-harness-ref inspect`，分别查看计划里有多少 Trial、最后生成多少 Observation Bundle。随后检查 Metric，确认它从 Trial 清单取得 denominator，而没有拿 Bundle 数量充当分母。上游 SWE-bench 的 [`infra_failure.py`](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/swebench/harness/infra_failure.py#L79-L86) 还提供了另一处源码证据，说明环境型评测会单独处理基础设施失败。

## 与其他 Harness 的关系

benchmark 型 Harness 常把请求重试藏进 Model Adapter，声明式应用评测可能直接把每个 Test Case 称作一条结果，Agent 环境 Harness 则通常会完整管理 Trial 从创建到结束的过程。比较这些实现时，你要追踪「统计分母何时确定」「产品错误能不能重试」以及「哪个结果会进入评分」。如果只对齐 `retry` 这个配置名，找不到真正的答案。

## 本篇不能证明什么

把这三层分清，并不会自动算出最佳重试预算，更不能保证分布式执行恰好一次。它能证明的范围很具体：在已经声明的本地协议内，Harness 恢复基础设施时没有暗中增加成功样本，也没有删掉失败的 Trial。

[上一章](02-task-dataset-target-environment.md) · [下一章](04-trace-artifact-observation.md)
