# 横向比较五：Metric、统计单位与不确定性

[上一节](04-scorer-judge-outcomes.md) · [下一节](06-agent-environment-final-state.md)

## 本篇要解决什么问题

工具通常都能输出 accuracy、mean score 或 pass rate，但不一定保存相同 denominator、聚类和缺失规则。lm-eval 聚合 request-level metric，Promptfoo 汇总测试/断言，DeepEval 把 Metric 阈值应用到 TestCase，Terminal-Bench 计算 Trial accuracy 与 pass@k。把这些数字放进一张榜单前，必须先问统计单位是什么。

## 核心机制

![Metric、比较与不确定性](../assets/diagrams/foundations/06-comparison-gate.svg)

统一路径是 ScoreRecord → MetricEstimate → ComparisonResult。Metric 预声明 numerator、denominator、权重和 cluster；Comparison 对共享 Sample/Trial 配对；区间反映有限样本波动。错误/缺失另行报告，不以 complete-case 平均替代计划分母。

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
6. 报告效果量、区间、分层和单例回归；Gate 使用最小有意义差异而非只看 p 值。

## 关键数据与不变量

Metric ID 需绑定 Scorer、Dataset split 和聚合规则。计划 denominator 不随成功执行数变化。重复 Trial 可以估计随机性，但同 Sample 内相关。pass@k 回答允许 k 次尝试时至少成功一次的概率，不等于单次线上成功率。区间算法与 seed 属于分析身份。

## 动手实验

给 10 个计划 Trial：7 pass、1 fail、1 target error、1 Judge error，分别计算完成项通过率、全计划已证实通过率和错误率：

```bash
uv run pytest tests/test_metrics.py -q
```

再解释为什么不能把两个错误删除后只报 7/8。

## 预期输出与答案

完成且有有效 Score 的通过率是 7/8=87.5%，全计划已证实通过率是 7/10=70%，Harness/Judge error 合计 20%。三者回答不同问题，应一起报告。7/8 单独出现会掩盖非随机缺失，Gate 应按错误预算处理。

## 如何核对

阅读 [`metrics.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/metrics.py)、[`comparison.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/comparison.py)，再对照 Terminal-Bench pass@k 与 lm-eval aggregation 课程。

## 本篇不能证明什么

正确 denominator 与区间仍不能修复无代表性 Dataset、标签错误、构念偏差或分布漂移。统计精确不等于业务有效。

[上一节](04-scorer-judge-outcomes.md) · [下一节](06-agent-environment-final-state.md)
