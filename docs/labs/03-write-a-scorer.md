# 实验三：编写一个确定性 Scorer

[上一节](02-add-a-target-adapter.md) · [下一节](04-repeat-and-compare.md)

## 本篇要解决什么问题

如果 Scorer（评分器）只把 Target 给出的「success」字段读出来再照抄，就等于让被测系统给自己判分，判分者和被测对象之间也就没有边界了。这个实验从 FieldMatchesExpectedScorer 开始，让 Scorer 根据已经冻结的 Observation（观测）和 Reference 自己下判断，然后再补齐集合匹配、缺字段、无效血缘和多值 Reference 这几种情况。

## 核心机制

![Observation 到 Score 的转换](../assets/diagrams/foundations/05-scoring.svg)

Scorer 拿到 ObservationBundle 之后，只能去合同指定的事件或 Artifact 里找证据，再根据这些证据生成 ScoreRecord。每条 Score 都要带上 trial_id、canonical_attempt_id、bundle digest 和 scorer_id，你才能根据记录查回当时用的观测与规则，也能在评分规则升级后，交给另一版 Scorer 重算同一份 Bundle。结果有效却不符合规则，就记为 failed；没有可用观测，就记为 unscorable；如果血缘出错，则记为 invalid。

## 完整流程

1. 写 scoring unit、所需字段、Reference、值域和状态表；
2. 从 Bundle 倒序找 `target_completed`，只读取允许字段；
3. 构造稳定 score_id，覆盖 Bundle、Scorer 与规则配置；
4. 缺 output/expected/field 返回 unscorable，不伪造 0；
5. 合法值满足规则返回 passed/value=1，否则 failed/value=0；
6. 为 passed、failed、missing 和 identity 写测试。

```bash
uv run pytest tests/test_scoring.py tests/test_models.py -q
```

## 关键数据与不变量

只要 Scorer identity 变了，score_id 就得跟着变；如果只是调整 threshold，则必须留住原始 value，不能把实际测到的值和发布政策塞进同一个字段。Score 只能指向 canonical Attempt。多值 Reference（参考答案）则会列出允许的答案和它们各自适用的条件，你不能随手拿第一个答案来判分，reason 也只写能够核对的解释，不采集隐藏思维链。

## 动手实验

先设计 `FieldInAllowedSetScorer(field="risk_band", allowed={"medium","high"})`，再依次喂给它准备好的 high、low 和缺字段结果，然后写出各自的 status/value/reason。随后把 allowed 改成 `{low}`，看看规则已经变了以后，旧 Score 还能不能代表同一次测量，并说明你的依据。

## 预期输出与答案

high 应该得到 passed/1，low 应该得到 failed/0，缺字段时则是 unscorable/None。结论很直接。allowed 集合是 Scorer 合同的一部分，你一旦改了它，旧 Score 就不再代表同一次测量，必须换用新的 scorer_id/score_id 重新评分。只有 Gate threshold 变了时，原 Score 才可能继续复用。

## 如何核对

阅读 [`scorers/rules.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/scorers/rules.py) 和 [`test_scoring.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_scoring.py)，手工确认每个 Score 字段能回到 Bundle。

## 本篇不能证明什么

确定性规则每次都能稳定复现，只能说同样的输入会得到同样的判断，却不能证明它真的测到了你关心的能力，也不能保证它覆盖了业务里最难的边界。关键词和集合规则都可能漏掉语义，所以你还要拿真实样本反复验证它是否符合领域需求，并随着业务变化持续更新，必要时再用校准过的 Judge（裁判模型）补上它测不到的部分。

[上一节](02-add-a-target-adapter.md) · [下一节](04-repeat-and-compare.md)
