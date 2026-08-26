# 实验三：编写一个确定性 Scorer

[上一节](02-add-a-target-adapter.md) · [下一节](04-repeat-and-compare.md)

## 本篇要解决什么问题

Scorer 不应读取 Target 的“success”字段后照抄，而要根据冻结 Observation 和 Reference 独立判断；因此，本实验从 FieldMatchesExpectedScorer 出发，设计一个集合匹配 Scorer，并正确处理缺字段、无效血缘和多值 Reference。

## 核心机制

![Observation 到 Score 的转换](../assets/diagrams/foundations/05-scoring.svg)

Scorer 输入 ObservationBundle，查找明确事件/Artifact，输出 ScoreRecord；Score 必须绑定 trial_id、canonical_attempt_id、bundle digest 与 scorer_id——有效不匹配是 failed，没有可用观察是 unscorable，血缘错误是 invalid。

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

Scorer identity 改变时 score_id 应变，threshold 不应丢掉原 value，Score 不能引用非 canonical Attempt；同时，多值 Reference 是允许集合与条件，不是随便取第一个答案。reason 是可核对解释，不采集隐藏思维链。

## 动手实验

设计 `FieldInAllowedSetScorer(field="risk_band", allowed={"medium","high"})`，输入输出依次为 high、low、缺字段，写出 status/value/reason；然后把 allowed 改为 `{low}`，解释旧 Score 能否继续使用。

## 预期输出与答案

high → passed/1；low → failed/0；缺字段 → unscorable/None。allowed 集合是 Scorer 合同的一部分，修改后旧 Score 不再代表同一测量，应以新 scorer_id/score_id 重评分；如果只改变 Gate threshold，才可能复用原 Score。

## 如何核对

阅读 [`scorers/rules.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/scorers/rules.py) 和 [`test_scoring.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_scoring.py)，手工确认每个 Score 字段能回到 Bundle。

## 本篇不能证明什么

确定性规则稳定不表示构念有效；关键词或集合规则可能遗漏语义，需要领域验证或校准 Judge 补充。

[上一节](02-add-a-target-adapter.md) · [下一节](04-repeat-and-compare.md)
