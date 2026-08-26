# 实验四：重复运行并进行配对比较

[上一节](03-write-a-scorer.md) · [下一节](05-evaluate-an-agent-trace.md)

## 本篇要解决什么问题

本实验把“Candidate 高于 Baseline”拆成共享 Sample/repetition 的配对差值；你将运行 shipping、执行 compare、核对三个 pair，并理解重复 Trial 与基础设施 Attempt 为什么不能混为一谈。

## 核心机制

![配对比较与 Bootstrap](../assets/diagrams/foundations/06-comparison-gate.svg)

Planner 的 repetition 产生独立随机 Trial（确定性案例中输出相同，只为演示身份），compare 用 sample_id + repetition 对齐 candidate/baseline。基础设施 retry 只增加 Attempt。它不产生新 pair，而 Bootstrap 对 pair 差值重采样，固定 seed 保持教学结果稳定。

## 完整流程

1. 运行两个 Target 的同一 Dataset；
2. 检查两边 Sample/repetition 集合相同；
3. Score 映射到 Trial，再映射 pair key；
4. 只对有效共享 key 计算 candidate-baseline；
5. 运行配对 Bootstrap，保存 seed/iterations/pair_count；
6. Gate 还需检查缺失和关键风险，不能只看 mean_difference。

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/lab-04
uv run eval-harness-ref compare output/lab-04 --candidate-target fixed --baseline-target buggy --seed 17 --iterations 2000
```

## 关键数据与不变量

计划 pair 数来自 Dataset × repetitions，有效 pair 交集不得静默替代计划数；Candidate/Baseline 使用同 Scorer 与环境，Seed、iterations 和 pair key 是分析身份，而多个 repetition 在 Sample 内相关，复杂数据需 cluster 方法。

## 动手实验

手算 99/100/101 的 Score 对和差值；再将配置 repetitions 改为 2 运行到新目录，预测 Trial、Metric denominator 与 pair_count；最后假设一次 infra retry，说明三个数量是否变化。

## 预期输出与答案

一次 repetition 的 compare 输出是这样：

```text
配对 Trial：3
平均差值：0.3333
95% Bootstrap 区间：[0.0000, 1.0000]
```

三个数字都要读懂。pair_count=3 是因为每个 Target 各跑 3 个 Sample，配成 3 对；
平均差值 0.3333 来自差值序列 `[0,1,0]`，只有金额 100 那一对分出了胜负。

真正该停下来看的是区间：**[0.0000, 1.0000] 跨过了 0**。fixed 确实比 buggy 好，
这一点从机制上是确定的，但三个样本撑不起「差异显著」这个统计结论；样本量不足时，
Bootstrap 会诚实地把区间摊开，而不是给你一个好看的窄区间。

把 repetition 改成两次，Trial 变十二个、每个 Target 的 denominator 变成 6、
pair_count 变成 6。而 Infra retry 只增加某个 Trial 的 Attempt 数——计划分母和
pair_count 一个都不动。这就是「重试不改变统计对象」的实际含义。

## 如何核对

```bash
uv run pytest tests/test_metrics.py tests/test_cli.py -k "bootstrap or compare" -q
```

阅读 comparison.json 并把每个统计量与手算对齐。

## 本篇不能证明什么

三个边界样本和基础 Bootstrap 不能支持广泛泛化；配对正确也不修复 Dataset 偏差或无效 Scorer。

[上一节](03-write-a-scorer.md) · [下一节](05-evaluate-an-agent-trace.md)
