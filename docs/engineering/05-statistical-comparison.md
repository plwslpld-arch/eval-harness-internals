# 统计比较：先配对 Trial，再看效果量与区间

[上一节](04-llm-as-judge.md) · [下一节](06-agent-environments.md)

## 本篇要解决什么问题

Candidate（候选版本）的通过率是 82%，Baseline（基线版本）是 80%，从平均数看 Candidate 像是赢了，但你还不能据此决定发布。还要看两边是不是跑了同一批 Sample、重复次数能否对上、缺失是不是偏向某个 Target，还得查清这 2 个百分点由哪些任务拉出来，因为任何一项都可能改变结论。这还不够。

你还要检查区间是否跨过 0，以及关键风险有没有朝相反的方向变化，所以 Eval Harness 应当先算好指标，再让 Gate 判断能不能通过。本篇会用 Reference Harness 的配对 Bootstrap（自助法）以及 shipping 里的 candidate/baseline，把这条最小链路走一遍。

继续往下读之前，你要先知道 Trial 怎样计划、Metric 怎样得出，然后跟着本篇构造 pair key，逐对计算差值，并看懂均值差和置信区间。到这一步，你也应该能指出伪重复、可选停止和只挑赢家指标这几种常见错误。

## 核心机制

![Candidate 与 Baseline 配对比较](../assets/diagrams/foundations/06-comparison-gate.svg)

先把同一个 Sample/repetition 分别交给 Candidate 和 Baseline，这样两边面对同一份任务，再算差值时就能抵消一部分由任务难度带来的波动。Reference Harness 用 `sample_id:r{repetition}` 当 pair key，借它对齐两边的 Score value，只有两边 value 都有效时才计算这一对的差值。`paired_bootstrap` 拿到整组差值后做有放回采样，固定 seed 和 iterations，然后返回 pair_count、mean_difference 以及 2.5% 和 97.5% 分位数。

这里算出的只是教学用基础区间，还不足以直接套到真实实验里。真实实验里，task family、用户或会话往往会把多个样本聚在一起，重复运行同一个 Trial 也不会自动产生彼此独立的 Sample，所以你可能要改用 cluster bootstrap 或分层模型。先定方法。在看到结果前，就要把统计方法和产品所能接受的最小有意义差异一起预注册。

## 完整流程

1. 计划阶段固定 candidate/baseline Target、共享 Dataset、repetitions、pair key、主指标、次指标和缺失策略。
2. 两个 Target 运行时保持相同 Sample 顺序不是必要条件，但身份、环境和 Scorer 合同必须一致。
3. Score 层保留每个 Trial value 和状态；blocked/unscorable 先分层报告，不能在比较函数中悄悄删掉。
4. `compare_targets` 从 Evidence 找到 Trial 的 sample_id/repetition，从 Report 找到有效 score，形成两张 key → value 映射。
5. 取交集配对，计算 candidate - baseline 差值。若无共享键则直接失败。
6. Bootstrap 对 pair 差值重采样；seed 固定使教材测试可重复，并输出平均差与区间，不把区间端点解释为参数有 95% 概率位于其中。
7. Gate 将统计结果与预注册 margin、关键指标非劣要求、错误率和成本约束结合；不能用「均值为正」代替全部政策。
8. 报告展示 pair_count、缺失 pair、分层效果和单例回归，支持定位而非只公布赢家。

## 关键数据与不变量

先把单位分清。预先声明的 Trial 是统计单位，通常用 Sample + repetition 来配对，但如果同一个用户贡献了多个 Sample，bootstrap 真正应当聚类的对象可能是用户。Candidate 和 Baseline 两边的 Score 必须量纲相同，Scorer 版本也必须一致，而 pair_count 要等于两边有效结果的交集，同时还要另报计划中的 pair_count 和每项缺失的原因。所用的 Seed 和 iterations 也要记下来，它们同样会确定这次分析的身份。

别只盯着均值差。遇到二元指标，你还可以报差值、相对风险或 McNemar discordant pairs，遇到连续指标，则可以报均值差或中位数差。延迟和成本通常拖着长尾，这时还得看分位数，如果同时跟踪多个指标，就必须提前定好主次或校正方法，不能等结果出来后只挑那个显著的指标。

## 动手实验

先运行 shipping，再执行 compare：

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/compare
uv run eval-harness-ref compare output/compare --candidate-target fixed --baseline-target buggy --seed 17 --iterations 2000
uv run pytest tests/test_metrics.py tests/test_cli.py -k "bootstrap or compare" -q
```

先手算金额 99、100、101 这三个 pair 各差多少，再删掉 Candidate 的一个 Score，看看 pair_count 会怎样变，以及计划分母和 Gate 是否应该跟着变。

## 预期输出与答案

三对值分别是 0、1、0（fixed - buggy），所以 mean_difference 是 1/3，pair_count=3，但样本太少，Bootstrap 算出的区间可能仍然包含 0。这个例子只能告诉你效果朝哪个方向走，还支撑不了普遍结论。删掉一个 Candidate Score 后，有效 pair_count 会降到 2，但计划中的 Trial 分母不能随之缩小，因此报告要把缺失列清楚，Gate 也要进入 blocked/inconclusive，不能只拿剩下的两对去宣布更高胜率。

固定 seed 后，测试便能稳定复现结果，而换一个 seed 可能会让有限迭代算出的分位数轻微浮动，却不会改变最初算出的三对差值。

## 如何核对

先阅读 [`comparison.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/comparison.py) 和 [`pipeline.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/pipeline.py) 里的 `compare_targets`，再去看 [`test_metrics.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_metrics.py) 和 CLI compare 测试，最后动手把每个映射 key 对回相应的 Evidence Trial。

## 本篇不能证明什么

就算 Bootstrap 算出了一段小样本区间，它也修不了数据泄漏、系统性缺失、Scorer 无效、任务分布偏差和可选停止这些问题，更不能代替你判断领域风险或审阅关键案例。

[上一节](04-llm-as-judge.md) · [下一节](06-agent-environments.md)
