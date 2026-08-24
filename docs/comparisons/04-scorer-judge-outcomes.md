# 横向比较四：Scorer、Judge 与 Outcome

[上一节](03-trace-artifact-lineage.md) · [下一节](05-metric-statistics-uncertainty.md)

## 本篇要解决什么问题

lm-eval 的 process_results、Inspect Scorer、OpenAI Evals match record、Promptfoo Assertion、DeepEval Metric 和 Harbor Verifier 都把运行观察转成结果，但输出语义从 exact match、连续 score 到 reward map 不等。更容易混淆的是“评分失败”和“评分器失败”。本篇用统一 Outcome 状态比较确定性规则、模型 Judge 和环境 Verifier。

## 核心机制

![Scorer 与 Gate 的分层状态](../assets/diagrams/foundations/05-scoring.svg)

Scorer 接收 Observation 和冻结参考，返回 ScoreRecord；Judge 是 Scorer 可调用的测量依赖；Metric 聚合多个 Score；Gate 应用政策。ScoreStatus 至少区分 passed、failed、uncertain、unscorable、invalid。一个数值 0 只能表示有效测量为 0，不能代替 error 或缺失。

| Harness | 评分对象 | 典型输出 | 错误边界 |
| --- | --- | --- | --- |
| lm-eval | doc + responses | metric item | request/processing/aggregation |
| Inspect | TaskState/Target | Score(value, answer, explanation) | scorer error/log status |
| OpenAI Evals | Sample/Completion | match/metrics events | Eval/Completion/Recorder error |
| Promptfoo | ProviderResponse + Assertion | GradingResult | assertion false vs handler/Judge error |
| DeepEval | LLMTestCase + Metric | MetricData | score<threshold vs metric.error |
| Harbor/TB | Environment final state | reward map | reward 0 vs verifier parse/transport error |

## 完整流程

1. 先定义 scoring unit 和允许观察，避免 Scorer 读取候选身份或隐藏标签。
2. 选择确定性规则优先；开放判断才使用 Judge，并固定 rubric/model/prompt/schema。
3. 将合法低分、uncertain、缺字段、Judge error 和 lineage invalid 映射为不同状态。
4. 保存 reason、组件 score、成本和 scorer identity；不只保存布尔 success。
5. Metric 按预声明 denominator 聚合，错误率单独报告。
6. Gate 对 invalid/unscorable 先做资格检查，再使用有效数值。

## 关键数据与不变量

Scorer identity 改变意味着测量合同改变。Threshold 属于政策或 Metric 配置，原始 score 应保留。多组件 reward 不能未经说明相加；critical component 可非补偿。Judge 投票数不增加 Trial 分母。Verifier reward 文件缺失不是 reward=0。

## 动手实验

对同一退款输出分别设计三种 Scorer：确定性 `decision` 精确匹配、Judge 评估解释质量、环境 Verifier 检查退款数据库。写出三者 Observation、错误和 ScoreStatus：

```bash
uv run pytest tests/test_scoring.py tests/test_gates.py -q
```

## 预期输出与答案

精确匹配缺字段为 unscorable；Judge 超时是 Judge error/unscorable；数据库显示未授权退款是有效 failed；数据库不可访问是 verifier error。只有有效 failed 才是产品负样本，其他状态阻断或降低证据资格。

## 如何核对

回看 Promptfoo 断言、DeepEval Metric 和 Harbor Verifier 课程，再核对 [`scorers/rules.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/scorers/rules.py) 与 [`scorers/judge.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/scorers/judge.py)。

## 本篇不能证明什么

统一状态不能证明不同工具的分数同量纲，也不能让主观 Judge 自动变客观。映射只让差异可见，效度仍需单独验证。

[上一节](03-trace-artifact-lineage.md) · [下一节](05-metric-statistics-uncertainty.md)
