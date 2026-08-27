# 实验四：重复运行并进行配对比较

[上一节](03-write-a-scorer.md) · [下一节](05-evaluate-an-agent-trace.md)

## 本篇要解决什么问题

「Candidate（候选版本）高于 Baseline（基线版本）」听起来很简单，但你必须先把两边共享的 Sample/repetition 一一对齐，再计算每对的差值，这句话才有明确的统计对象。这个实验会跑一遍 shipping，然后用 compare 算出并核对三个 pair，你也会看到为什么重复 Trial 和基础设施 Attempt 必须分开数。

## 核心机制

![配对比较与 Bootstrap](../assets/diagrams/foundations/06-comparison-gate.svg)

Planner 每多跑一次 repetition，都会新建一个身份独立的随机 Trial，就算这个确定性案例每次给出同样的结果，这些 Trial 也不能合并。compare 按 sample_id + repetition 把 candidate 和 baseline 配成对，而基础设施 retry 只会给原 Trial 多加一个 Attempt，不会新增 pair。这就是两者的差别。Bootstrap（自助法）会对这些 pair 的差值重采样，而固定 seed 能让教学结果稳定复现。

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

计划要配出多少个 pair，由 Dataset 的样本数乘以 repetitions 得出，哪怕后来丢了部分结果，你也不能悄悄用剩下的有效 pair 交集代替原计划数。Candidate 和 Baseline 必须使用同一个 Scorer，也要跑在相同环境里，而 seed、iterations 和 pair key 一起标明了这次分析的身份。同一个 Sample 里的多个 repetition 通常会彼此相关，所以数据结构一旦变得更复杂，就要用 cluster 方法处理这种相关性。

## 动手实验

先手算 99、100、101 三个样本的 Score 对和它们之间的差值，再把配置中的 repetitions 改成 2，然后跑到一个新目录里，并在动手前预测 Trial、Metric denominator 和 pair_count 分别会变成多少。最后假设其中发生了一次 infra retry，判断这三个数量中哪些会变，再说明原因。

## 预期输出与答案

一次 repetition 的 compare 输出是这样：

```text
配对 Trial：3
平均差值：0.3333
95% Bootstrap 区间：[0.0000, 1.0000]
```

这三个数字必须放在一起看。每个 Target 都跑了 3 个 Sample，而 compare 又按相同身份把它们配成 3 对，所以 pair_count=3。平均差值 0.3333 则是从差值序列 `[0,1,0]` 算出来的，只有金额为 100 的那一对分出了胜负。

你真正该停下来看的，是 **[0.0000, 1.0000] 这个区间跨过了 0**，因为对这三个已知样本来说，fixed 的确优于 buggy，但这么少的数据还撑不起「差异显著」这个统计结论。样本太少时，Bootstrap 会如实给出一个很宽的区间，你也就不会把好看的均值当成充分证据。

把 repetition 改成两次以后，计划会建出十二个 Trial，每个 Target 的 denominator 和 pair_count 都会变成 6。Infra retry 只会给某个 Trial 增加 Attempt，它既不改计划分母，也不增加 pair_count。这就是「重试不改变统计对象」：Attempt 变多了，但计划里的统计对象一个也没多。

## 如何核对

```bash
uv run pytest tests/test_metrics.py tests/test_cli.py -k "bootstrap or compare" -q
```

阅读 comparison.json 并把每个统计量与手算对齐。

## 本篇不能证明什么

三个边界样本再加上基础 Bootstrap，还是撑不起对更广泛场景的泛化判断。就算每一对都配得完全正确，统计计算也修不好有偏差的 Dataset 或无效的 Scorer，因为这两类问题在开始计算之前就已经出现了。

[上一节](03-write-a-scorer.md) · [下一节](05-evaluate-an-agent-trace.md)
