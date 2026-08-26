# 横向比较四：Scorer、Judge 与 Outcome

[上一节](03-trace-artifact-lineage.md) · [下一节](05-metric-statistics-uncertainty.md)

## 本篇要解决什么问题

lm-eval 的 process_results、Inspect Scorer、OpenAI Evals match record、Promptfoo Assertion、DeepEval Metric 和 Harbor Verifier 都会把运行观察转成结果，不过它们输出的可能是 exact match、连续 score 或 reward map，语义并不相同。真正容易出错的地方，是把“评分失败”与“评分器失败”混为一谈，因此本篇会用统一 Outcome 状态比较确定性规则、模型 Judge 和环境 Verifier。

## 核心机制

![Scorer 与 Gate 的分层状态](../assets/diagrams/foundations/05-scoring.svg)

Scorer 接收 Observation 与冻结参考后返回 ScoreRecord，Judge 是它可以调用的测量依赖，而 Metric 负责聚合多个 Score，Gate 再把政策应用到聚合结果上。ScoreStatus 至少要区分 passed、failed、uncertain、unscorable 和 invalid，因为数值 0 只能表示一次有效测量得到 0，不能拿来代替 error 或缺失。

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
2. 选择确定性规则优先，开放判断才使用 Judge，并固定 rubric/model/prompt/schema。
3. 将合法低分、uncertain、缺字段、Judge error 和 lineage invalid 映射为不同状态。
4. 保存 reason、组件 score、成本和 scorer identity，不只保存布尔 success。
5. Metric 按预声明 denominator 聚合，错误率单独报告。
6. Gate 对 invalid/unscorable 先做资格检查，再使用有效数值。

## 关键数据与不变量

Scorer identity 一旦改变，测量合同也随之改变，而 Threshold 属于政策或 Metric 配置，不能覆盖原始 score。多组件 reward 未经说明不能直接相加，critical component 还可以采用非补偿规则，同时 Judge 的投票次数不能增加 Trial 分母。Verifier reward 文件缺失也不等于 reward=0。

## 动手实验

针对同一份退款输出，分别设计三种 Scorer：用确定性 `decision` 做精确匹配，让 Judge 评估解释质量，再由环境 Verifier 检查退款数据库，并写出三者各自允许读取的 Observation、可能错误和 ScoreStatus：

```bash
uv run pytest tests/test_scoring.py tests/test_gates.py -q
```

## 预期输出与答案

精确匹配遇到字段缺失时应记为 unscorable，Judge 超时属于 Judge error/unscorable，数据库明确显示未授权退款才是有效 failed，而数据库不可访问属于 verifier error——只有有效 failed 才能成为产品负样本，其他状态要么阻断评测，要么降低证据资格。

## 如何核对

回看 Promptfoo 断言、DeepEval Metric 和 Harbor Verifier 课程，先辨认产品失败与测量失败如何落盘，再核对 [`scorers/rules.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/scorers/rules.py) 与 [`scorers/judge.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/scorers/judge.py)。

## 本篇不能证明什么

统一状态只能让差异显露出来，既不能证明不同工具的分数处在同一量纲，也不能让主观 Judge 自动变得客观。效度还得单独验证。

[上一节](03-trace-artifact-lineage.md) · [下一节](05-metric-statistics-uncertainty.md)
