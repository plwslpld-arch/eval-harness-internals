# 实验三：编写一个确定性 Scorer

[上一节](02-add-a-target-adapter.md) · [下一节](04-repeat-and-compare.md)

## 本篇要解决什么问题

Scorer 如果只是读取 Target 给出的「success」字段并照抄，就等于让被测系统给自己判分——判分者和被测对象也就失去了边界，所以本实验从 FieldMatchesExpectedScorer 出发，要求 Scorer 根据冻结的 Observation 和 Reference 独立判断，再逐步补上集合匹配、缺字段、无效血缘和多值 Reference 的处理。

## 核心机制

![Observation 到 Score 的转换](../assets/diagrams/foundations/05-scoring.svg)

Scorer 接收 ObservationBundle 后，只从明确约定的事件或 Artifact 中取证，然后输出 ScoreRecord。每条 Score 都必须绑定 trial_id、canonical_attempt_id、bundle digest 与 scorer_id，这样才能沿着记录回到当时使用的观察和规则，也能让同一份 Bundle 在评分规则升级后接受另一版 Scorer 的独立重算。结果虽有效但不满足规则时记为 failed，没有可用观察时记为 unscorable，血缘错误则记为 invalid。

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

只要 Scorer identity 发生变化，score_id 就应随之变化，而调整 threshold 时仍要保留原始 value，不能把测量值和发布政策揉成同一个字段。Score 只能引用 canonical Attempt，而多值 Reference 表达的是允许集合与适用条件，不能随手取第一个答案，reason 也只记录可核对的解释，不采集隐藏思维链。

## 动手实验

设计 `FieldInAllowedSetScorer(field="risk_band", allowed={"medium","high"})`，依次输入准备好的 high、low 和缺字段三种结果，并写出对应的 status/value/reason。随后把 allowed 改为 `{low}`，判断旧 Score 在规则改变后是否还能代表同一次测量，并解释依据。

## 预期输出与答案

high 对应 passed/1，low 对应 failed/0，缺字段对应 unscorable/None。结论很直接。allowed 集合属于 Scorer 合同，因此修改后旧 Score 已经不能代表同一次测量，应使用新的 scorer_id/score_id 重评分。如果变化只发生在 Gate threshold，原 Score 才可能继续复用。

## 如何核对

阅读 [`scorers/rules.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/scorers/rules.py) 和 [`test_scoring.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_scoring.py)，手工确认每个 Score 字段能回到 Bundle。

## 本篇不能证明什么

确定性规则能够稳定复现，只说明同样的输入会得到同样的判断，并不能证明它测中了想要测的能力，也无法保证规则覆盖了业务里真正困难的边界。关键词或集合规则仍可能遗漏语义，因此还需要在真实样本上反复做领域验证和持续更新，必要时再用经过校准的 Judge 补充。

[上一节](02-add-a-target-adapter.md) · [下一节](04-repeat-and-compare.md)
