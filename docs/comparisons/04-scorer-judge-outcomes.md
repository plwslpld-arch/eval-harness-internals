# 横向比较四：Scorer、Judge 与 Outcome

[上一节](03-trace-artifact-lineage.md) · [下一节](05-metric-statistics-uncertainty.md)

## 本篇要解决什么问题

lm-eval 的 process_results、Inspect Scorer（评分器）、OpenAI Evals match record、Promptfoo Assertion、DeepEval Metric 和 Harbor Verifier（验证器）都会读取运行中观察到的内容，再给出结果，可这些结果可能是 exact match、连续 score，也可能是 reward map，表达的意思并不相同。这里最容易犯的错，是把「产品没通过评分」和「评分器自己没跑成」混在一起，所以这一篇会先把结果归到统一的 Outcome 状态，再比较确定性规则、模型 Judge 和环境 Verifier 怎样判断。

## 核心机制

![Scorer 与 Gate 的分层状态](../assets/diagrams/foundations/05-scoring.svg)

Scorer 读入 Observation 和已经冻结的参考，再返回 ScoreRecord。它可以调用 Judge（裁判模型）完成开放式判断，Metric 随后汇总多个 Score，Gate 最后按照政策检查汇总结果。ScoreStatus 至少要分清 passed、failed、uncertain、unscorable 和 invalid，因为数值 0 只能说明一次有效测量确实得到 0，不能拿来顶替 error 或缺失。

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

Scorer identity 一旦变化，系统实际采用的测量合同也就变了。Threshold 归政策或 Metric 配置管理，不能回头覆盖原始 score。多个组件给出的 reward 没有预先说明就不能直接相加，critical component 还可以执行非补偿规则，而 Judge 多投几次票也不能增加 Trial 分母。Verifier reward 文件缺失时，同样不能写成 reward=0。

## 动手实验

针对同一份退款输出，分别设计三种 Scorer：先用确定性的 `decision` 做精确匹配，再让 Judge 评估解释质量，最后由环境 Verifier 检查退款数据库，同时写明三者各自可以读取哪些 Observation、可能遇到什么错误，以及应该返回哪种 ScoreStatus：

```bash
uv run pytest tests/test_scoring.py tests/test_gates.py -q
```

## 预期输出与答案

精确匹配找不到所需字段时，应当记为 unscorable。Judge 超时属于 Judge error/unscorable，只有数据库明确显示发生了未授权退款，才能算有效的 failed，数据库无法访问则属于 verifier error。只有有效 failed 才能成为产品负样本，其他状态要么阻断评测，要么让这份证据失去资格。

## 如何核对

回看 Promptfoo 断言、DeepEval Metric 和 Harbor Verifier 课程，先查清产品失败与测量失败分别怎样写入记录，再核对 [`scorers/rules.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/scorers/rules.py) 与 [`scorers/judge.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/scorers/judge.py)。

## 本篇不能证明什么

统一状态只能把差异摆到明面上，既不能证明不同工具给出的分数处在同一量纲，也不能让主观 Judge 自动变得客观。效度还得另行验证。

[上一节](03-trace-artifact-lineage.md) · [下一节](05-metric-statistics-uncertainty.md)
