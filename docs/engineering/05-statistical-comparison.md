# 统计比较：先配对 Trial，再看效果量与区间

[上一节](04-llm-as-judge.md) · [下一节](06-agent-environments.md)

## 本篇要解决什么问题

Candidate 通过率 82%、Baseline 80%，能否发布？只看两个平均数无法回答。因为它们是否运行在相同 Sample 上、重复次数是否一致、缺失是否偏向某个 Target、2 个百分点来自哪些任务、区间是否跨过 0、关键风险是否反向，所以都决定结论。Eval Harness 的比较层必须在指标与 Gate 之间显式存在——本篇用 Reference Harness 的配对 Bootstrap 和 shipping candidate/baseline 演示最小实现。

前置知识是 Trial 计划和 Metric；读完后，你应能构造 pair key、计算每对差值、解释均值差与置信区间，并识别伪重复、可选停止和只挑赢家指标等常见错误。

## 核心机制

![Candidate 与 Baseline 配对比较](../assets/diagrams/foundations/06-comparison-gate.svg)

配对设计让每个 Sample/repetition 同时经历 Candidate 与 Baseline，所以差值抵消任务难度；Reference Harness 用 `sample_id:r{repetition}` 作为 pair key，把 Score value 对齐，只有两边都有有效 value 的 pair 进入差值；`paired_bootstrap` 对差值向量有放回采样，固定 seed 和 iterations，返回 pair_count、mean_difference、2.5% 与 97.5% 分位数。

Bootstrap 是教学级基础区间。真实实验可能有 task family、用户、会话等聚类，所以需要 cluster bootstrap 或分层模型；重复 Trial 也不是完全独立 Sample。统计方法必须在看结果前预注册，并与产品决策的最小有意义差异相连。

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

统计单位是预声明 Trial，配对单位通常是 Sample + repetition；若同一用户贡献多个 Sample，用户可能才是 bootstrap cluster。Candidate/Baseline Score 必须同量纲、同 Scorer 版本；pair_count 应等于有效交集，计划 pair_count 和缺失原因另行报告；Seed 与 iterations 是分析身份。

效果量不仅是均值差：二元指标可报告差值、相对风险或 McNemar discordant pairs；连续指标可报告均值/中位数差；延迟和成本常呈长尾，需要分位数；多指标必须声明主次或校正，禁止事后挑选唯一显著结果。

## 动手实验

先运行 shipping，再执行 compare：

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/compare
uv run eval-harness-ref compare output/compare --candidate-target fixed --baseline-target buggy --seed 17 --iterations 2000
uv run pytest tests/test_metrics.py tests/test_cli.py -k "bootstrap or compare" -q
```

手算三个 pair 的差值：金额 99、100、101；再删除 Candidate 的一个 Score，回答 pair_count、计划分母和 Gate 应怎样变化。

## 预期输出与答案

三对值分别是 0、1、0（fixed - buggy），mean_difference 为 1/3，pair_count=3，Bootstrap 区间因样本极小可能包含 0。这个例子显示效果方向。但不足以支撑普遍结论。删除一个 Candidate Score 后有效 pair_count 变 2，但计划 Trial 分母不变；报告必须显示缺失，Gate 应 blocked/inconclusive，而不是用剩余两对宣布更高胜率。

固定 seed 时测试结果稳定；改变 seed 可能轻微改变有限迭代分位数，但不会改变原始三对差值。

## 如何核对

阅读 [`comparison.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/comparison.py) 和 [`pipeline.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/pipeline.py) 的 `compare_targets`，再看 [`test_metrics.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_metrics.py) 与 CLI compare 测试。把每个映射 key 与 Evidence Trial 手工对齐。

## 本篇不能证明什么

Bootstrap 区间不修复数据泄漏、系统性缺失、无效 Scorer、任务分布偏差或可选停止——小样本区间也不能替代领域风险判断和关键案例审阅。

[上一节](04-llm-as-judge.md) · [下一节](06-agent-environments.md)
