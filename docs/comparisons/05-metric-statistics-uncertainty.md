# 横向比较五：Metric、统计单位与不确定性

[上一节](04-scorer-judge-outcomes.md) · [下一节](06-agent-environment-final-state.md)

## 本篇要解决什么问题

这些工具通常都能给出 accuracy、mean score 或 pass rate，但计算时采用的 denominator、聚类方式和缺失规则未必相同。lm-eval 汇总 request-level metric，Promptfoo 汇总测试与断言，DeepEval 用 Metric 阈值判断 TestCase，Terminal-Bench 则计算 Trial accuracy 与 pass@k，所以你把这些数字排进同一张榜单之前，得先弄清各自按什么单位统计。

## 核心机制

![Metric、比较与不确定性](../assets/diagrams/foundations/06-comparison-gate.svg)

统一分析时，先把手里的 ScoreRecord 汇成 MetricEstimate，再用它生成 ComparisonResult。Metric 要预先写清 numerator、denominator、权重和 cluster，Comparison 则要按双方共有的 Sample/Trial 配对，免得比较对象错位。区间只能反映有限样本造成的波动，错误和缺失还得另报，不能悄悄用 complete-case 平均换掉计划分母。

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

Metric ID 要同时绑定 Scorer、Dataset split 和聚合规则，而且不管最后成功跑完多少项，计划好的 denominator 都不能跟着结果增减。重复运行 Trial 可以估计随机性，但同一 Sample 里的结果会彼此相关，不会变成相互独立的样本。pass@k 算的是允许尝试 k 次时至少成功一次的概率，不能拿它代替单次线上成功率。所用的区间算法和 seed 也得记进分析身份。

## 动手实验

假设计划里共有 10 个 Trial，其中 7 个 pass、1 个 fail、1 个 target error、1 个 Judge error，请你分别算出已完成项的通过率、整个计划中已经证实的通过率以及错误率：

```bash
uv run pytest tests/test_metrics.py -q
```

算完再想一想：为什么不能删掉两个错误，只留下看起来更漂亮的 7/8？

## 预期输出与答案

只看已经跑完并拿到有效 Score 的 Trial，通过率是 7/8=87.5%。回到整个计划，已经证实的通过率只有 7/10=70%，target/Judge error 合计占 20%。这三个数字回答的问题不同，报告时一个都不能少。要是只留下 7/8，报告就藏住了非随机缺失，Gate 也没法按错误预算判断该怎么办。

## 如何核对

先读 [`metrics.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/metrics.py) 和 [`comparison.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/comparison.py)，看代码怎样把计划分母带进统计结果，再对照 Terminal-Bench pass@k 与 lm-eval aggregation 课程检查一遍。

## 本篇不能证明什么

就算 denominator 和区间都算对了，也补不上 Dataset 缺乏代表性、标签错误、构念偏差或分布漂移这些缺口。统计结果精确，业务结论也未必有效。

[上一节](04-scorer-judge-outcomes.md) · [下一节](06-agent-environment-final-state.md)
