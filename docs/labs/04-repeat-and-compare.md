# 实验四：重复运行并进行配对比较

[上一节](03-write-a-scorer.md) · [下一节](05-evaluate-an-agent-trace.md)

## 本篇要解决什么问题

「Candidate 高于 Baseline」听起来像一句简单结论，但只有把两边共享的 Sample/repetition 对齐后计算配对差值，这个结论才有明确的统计对象。本实验会运行 shipping、执行 compare 并核对三个 pair，同时解释重复 Trial 与基础设施 Attempt 为什么必须分开计数。

## 核心机制

![配对比较与 Bootstrap](../assets/diagrams/foundations/06-comparison-gate.svg)

Planner 每增加一次 repetition，就会创建一个身份独立的随机 Trial，虽然这个确定性案例会输出相同结果，但身份仍然不能合并，而 compare 使用 sample_id + repetition 对齐 candidate/baseline，基础设施 retry 则只为原 Trial 增加 Attempt，因此不会产生新的 pair——差别就在这里。Bootstrap 重采样的是这些 pair 的差值，固定 seed 是为了让教学结果能够稳定复现。

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

计划 pair 数来自 Dataset × repetitions，哪怕部分结果缺失，有效 pair 的交集也不能静默替代原计划数。Candidate/Baseline 必须使用相同的 Scorer 与环境，seed、iterations 和 pair key 共同标识这次分析，而多个 repetition 在同一 Sample 内通常相关，所以数据结构更复杂时，应采用 cluster 方法处理这种相关性。

## 动手实验

先手算 99/100/101 三个样本的 Score 对和差值，再把配置中的 repetitions 改为 2 并运行到新目录，提前预测 Trial、Metric denominator 与 pair_count。最后加入一次假设的 infra retry，说明这三个数量中哪些会变化，以及为什么。

## 预期输出与答案

一次 repetition 的 compare 输出是这样：

```text
配对 Trial：3
平均差值：0.3333
95% Bootstrap 区间：[0.0000, 1.0000]
```

这三个数字要放在一起读。pair_count=3 是因为每个 Target 各运行 3 个 Sample，并按照相同身份配成 3 对，而平均差值 0.3333 来自差值序列 `[0,1,0]`，其中只有金额 100 对应的那一对分出了胜负。

真正该停下来看的，是 **[0.0000, 1.0000] 跨过了 0** 这个区间，因为根据三个已知样本的机制，fixed 确实优于 buggy，但这么少的数据还撑不起「差异显著」的统计结论。样本量不足时，Bootstrap 会如实给出宽区间，提醒读者别把一个好看的均值当成充分证据。

把 repetition 改成两次后，Trial 会变成十二个，每个 Target 的 denominator 与 pair_count 都会变成 6，而 Infra retry 只增加某个 Trial 的 Attempt 数，既不改变计划分母，也不增加 pair_count。这正是「重试不改变统计对象」在结果数据里的含义，统计对象没有变。

## 如何核对

```bash
uv run pytest tests/test_metrics.py tests/test_cli.py -k "bootstrap or compare" -q
```

阅读 comparison.json 并把每个统计量与手算对齐。

## 本篇不能证明什么

三个边界样本加上基础 Bootstrap，仍不足以支持对更广泛场景的泛化判断。配对过程即使完全正确，也无法修复 Dataset 偏差或无效 Scorer，因为这两类问题发生在统计计算之前。

[上一节](03-write-a-scorer.md) · [下一节](05-evaluate-an-agent-trace.md)
