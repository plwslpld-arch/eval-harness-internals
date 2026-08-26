# 统计比较：先配对 Trial，再看效果量与区间

[上一节](04-llm-as-judge.md) · [下一节](06-agent-environments.md)

## 本篇要解决什么问题

Candidate 通过率是 82%，Baseline 是 80%，这两个平均数看起来已经给出了赢家，但它们还回答不了能否发布。因为两边是否运行在相同 Sample 上、重复次数是否一致、缺失是否偏向某个 Target，以及这 2 个百分点究竟来自哪些任务，都会改变比较结果，所以区间是否跨过 0、关键风险是否反向也必须一起检查。Eval Harness 的比较层必须明确放在指标与 Gate 之间——本篇用 Reference Harness 的配对 Bootstrap 和 shipping candidate/baseline 演示这个最小实现。

在继续之前，你需要了解 Trial 计划和 Metric，而读完本篇后，应该能够构造 pair key、计算每对差值并解释均值差与置信区间，还能识别伪重复、可选停止和只挑赢家指标等常见错误。

## 核心机制

![Candidate 与 Baseline 配对比较](../assets/diagrams/foundations/06-comparison-gate.svg)

配对设计让每个 Sample/repetition 同时经历 Candidate 与 Baseline，因为两边面对的是同一份任务，所以计算差值时可以抵消一部分任务难度。Reference Harness 用 `sample_id:r{repetition}` 作为 pair key 来对齐 Score value，只有两边都有有效 value 的 pair 才会进入差值，而 `paired_bootstrap` 会对差值向量做有放回采样，并在固定 seed 和 iterations 后返回 pair_count、mean_difference、2.5% 与 97.5% 分位数。

这里的 Bootstrap 只是教学级基础区间。真实实验通常会按 task family、用户或会话形成聚类，而重复 Trial 也不等于彼此独立的 Sample，因此实际分析可能需要 cluster bootstrap 或分层模型。在看到结果之前就应预注册统计方法，并把它和产品决策中的最小有意义差异绑定起来。

## 完整流程

1. 计划阶段固定 candidate/baseline Target、共享 Dataset、repetitions、pair key、主指标、次指标和缺失策略。
2. 两个 Target 运行时保持相同 Sample 顺序不是必要条件，但身份、环境和 Scorer 合同必须一致。
3. Score 层保留每个 Trial value 和状态；blocked/unscorable 先分层报告，不能在比较函数中悄悄删掉。
4. `compare_targets` 从 Evidence 找到 Trial 的 sample_id/repetition，从 Report 找到有效 score，形成两张 key → value 映射。
5. 取交集配对，计算 candidate - baseline 差值。若无共享键则直接失败。
6. Bootstrap 对 pair 差值重采样；seed 固定使教材测试可重复，并输出平均差与区间，不把区间端点解释为参数有 95% 概率位于其中。
7. Gate 将统计结果与预注册 margin、关键指标非劣要求、错误率和成本约束结合；不能用“均值为正”代替全部政策。
8. 报告展示 pair_count、缺失 pair、分层效果和单例回归，支持定位而非只公布赢家。

## 关键数据与不变量

统计单位是预声明的 Trial，而配对单位通常是 Sample + repetition，但如果同一用户贡献了多个 Sample，真正适合作为 bootstrap cluster 的单位可能是用户。Candidate/Baseline Score 必须使用相同量纲和 Scorer 版本，pair_count 应当等于两边的有效交集，同时另行报告计划 pair_count 与缺失原因。Seed 与 iterations 也属于分析身份。

效果量不只有均值差，因为二元指标还可以报告差值、相对风险或 McNemar discordant pairs，而连续指标则可以报告均值差或中位数差。延迟和成本往往呈长尾分布，所以还需要查看分位数，而面对多个指标时必须提前声明主次或校正方法，不能等结果出来后只挑唯一显著的那个。

## 动手实验

先运行 shipping，再执行 compare：

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/compare
uv run eval-harness-ref compare output/compare --candidate-target fixed --baseline-target buggy --seed 17 --iterations 2000
uv run pytest tests/test_metrics.py tests/test_cli.py -k "bootstrap or compare" -q
```

先手算金额 99、100、101 这三个 pair 的差值，然后删除 Candidate 的一个 Score，看看 pair_count、计划分母和 Gate 应当怎样变化。

## 预期输出与答案

三对值分别是 0、1、0（fixed - buggy），因此 mean_difference 为 1/3、pair_count=3，而 Bootstrap 区间会因为样本极小而可能包含 0。这个例子能显示效果方向，却不足以支撑普遍结论。删除一个 Candidate Score 后，有效 pair_count 会变成 2，但计划 Trial 分母不能跟着缩小，所以报告必须明确显示缺失，Gate 也应进入 blocked/inconclusive，而不能拿剩余两对宣布更高胜率。

固定 seed 后，测试结果可以稳定复现，而改变 seed 可能会轻微影响有限迭代得到的分位数，却不会改变原始的三对差值。

## 如何核对

先阅读 [`comparison.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/comparison.py) 和 [`pipeline.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/pipeline.py) 中的 `compare_targets`，再查看 [`test_metrics.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_metrics.py) 与 CLI compare 测试，并把每个映射 key 与 Evidence Trial 手工对齐。

## 本篇不能证明什么

Bootstrap 区间无法修复数据泄漏、系统性缺失、无效 Scorer、任务分布偏差或可选停止，即使算出了小样本区间，也不能拿它替代领域风险判断和关键案例审阅。

[上一节](04-llm-as-judge.md) · [下一节](06-agent-environments.md)
