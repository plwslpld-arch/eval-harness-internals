# 横向比较五：Metric、统计单位与不确定性

[上一节](04-scorer-judge-outcomes.md) · [下一节](06-agent-environment-final-state.md)

## 本篇要解决什么问题

这些工具通常都能输出 accuracy、mean score 或 pass rate，但它们未必使用相同的 denominator、聚类方式与缺失规则。lm-eval 聚合 request-level metric，Promptfoo 汇总测试与断言，DeepEval 把 Metric 阈值应用到 TestCase，而 Terminal-Bench 计算 Trial accuracy 与 pass@k，因此把这些数字放进同一张榜单之前，必须先问清统计单位究竟是什么。

## 核心机制

![Metric、比较与不确定性](../assets/diagrams/foundations/06-comparison-gate.svg)

统一分析路径从 ScoreRecord 走到 MetricEstimate，再形成 ComparisonResult，其中 Metric 要预先声明 numerator、denominator、权重和 cluster，Comparison 则按照共享 Sample/Trial 完成配对。区间只反映有限样本带来的波动。错误与缺失必须另行报告，不能用 complete-case 平均悄悄替代计划分母。

| 场景 | 推荐统计单位 | 常见错误 |
| --- | --- | --- |
| 单轮 benchmark | Sample/Document | 把多个 request 当独立样本 |
| 多次随机生成 | Sample 内 Trial | 把重复数当新任务覆盖 |
| Agent 终端任务 | Task 聚类下 Trial | 只报所有 Trial accuracy |
| 对话/用户日志 | 会话或用户 cluster | 把每 turn 当独立 |
| Judge 多次评分 | 原 Trial | 把 Judge 数扩为分母 |

## 完整流程

1. 计划阶段固定 analysis unit、重复、cluster、缺失和主指标。
2. Score 层保留每个 Trial 状态，避免只保存聚合。
3. Metric 用计划 ID 形成 denominator，分别输出 pass/fail/error/unknown。
4. Candidate/Baseline 用同 pair key 对齐，报告有效/缺失 pair。
5. 选择与设计匹配的 bootstrap/解析方法，固定 seed/iterations。
6. 报告效果量、区间、分层和单例回归，Gate 使用最小有意义差异而非只看 p 值。

## 关键数据与不变量

Metric ID 需要绑定 Scorer、Dataset split 与聚合规则，而且无论成功执行多少项，计划 denominator 都不能随之变化。重复 Trial 可以用来估计随机性，但同一 Sample 内的结果彼此相关，而 pass@k 回答的是允许 k 次尝试时至少成功一次的概率，并不等于单次线上成功率。区间算法和 seed 也属于分析身份。

## 动手实验

假设计划中共有 10 个 Trial，其中 7 个 pass、1 个 fail、1 个 target error、1 个 Judge error，请分别计算完成项通过率、全计划已证实通过率和错误率：

```bash
uv run pytest tests/test_metrics.py -q
```

算完之后，再解释为什么不能删掉两个错误，只留下看似更漂亮的 7/8。

## 预期输出与答案

在已经完成且获得有效 Score 的 Trial 中，通过率是 7/8=87.5%，而全计划已证实通过率只有 7/10=70%，Harness/Judge error 合计占 20%。这三个数字回答的是不同问题，所以必须一起报告。若只留下 7/8，非随机缺失就会被掩盖，Gate 也无法按错误预算正确处理。

## 如何核对

先阅读 [`metrics.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/metrics.py)、[`comparison.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/comparison.py)，弄清计划分母如何进入统计结果，再对照 Terminal-Bench pass@k 与 lm-eval aggregation 课程。

## 本篇不能证明什么

即便 denominator 与区间都计算正确，也无法修复 Dataset 缺乏代表性、标签错误、构念偏差或分布漂移——统计精确不等于业务有效。

[上一节](04-scorer-judge-outcomes.md) · [下一节](06-agent-environment-final-state.md)
