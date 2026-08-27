# 06｜不确定性、比较与 Gate：从分数到可执行决定

[上一章](05-scorer-judge-score-metric.md) · [下一章](07-eval-to-rl-and-release-eval.md)

## 本篇要解决什么问题

Candidate（候选版本）得分 82%，Baseline（基线版本）得分 80%，这就足以支持发布吗？两个点估计回答不了，因为你还不知道双方测的是不是同一批样本，也不知道差异是否只由少数样本拉开。重复运行之间可能彼此相关，证据可能缺失，关键安全检查甚至可能已经失败，而且有人还可能看完结果才临时挑一个判定阈值。必须把统计比较和决策政策分开，否则一个百分比就会把这些问题全遮住。

## 学完你能解释什么

- 为什么同一 Sample 上的 Baseline/Candidate 应保持配对；
- Bootstrap 区间表达什么、不表达什么；
- Metric、ComparisonResult 与 GateDecision 的区别；
- 为什么 Gate 需要 passed、failed、blocked、inconclusive 四种结果。

## 贯穿案例

shipping 一共有三个 Sample，buggy 通过 2/3，fixed 通过 3/3，因此点估计相差 1/3。两个 Target 跑的是完全相同的 Sample 和 repetition，所以可以先算出每一对 Score 的差，再对这些差值重采样。这里只有三个样本，无论怎么算区间，都变不出真实业务里的确定性，不过配对至少不会把样本本身的难度差异错算成模型差异。发布 Gate 还会另行检查 fixed pass-rate 是否达到 1.0，并确认整次运行里没有 unscorable 证据。

## 核心概念与边界

**MetricEstimate**（指标估计值）告诉你某个 Target 在一组计划 Trial 上测出了什么。**ComparisonResult** 再把 Candidate 和 Baseline 放到一起，看效果相差多少、方向如何，以及这个差异有多不确定。

预先声明的 **GatePolicy** 读取有效 Metric、比较结果和关键检查，最后由 **GateDecision**（门禁决策）记下这次运行究竟是通过、失败、被阻断还是无法判断，同时保存判定依据。

`blocked` 表示计划预先要求的条件还没满足，例如运行环境不可用，或者唯一的 Metric 没有生成。`inconclusive` 表示已经拿到运行证据，但证据仍不足以判断通过或失败，例如关键 Score 处于 uncertain。failed 说明有效证据明确达不到政策要求，passed 才说明所有声明过的条件都满足了。这四种结果会引向不同的后续动作，压成布尔值以后就分不清了。

## 机制图

![成对比较与质量门禁](../assets/diagrams/foundations/06-comparison-gate.svg)

## 调用链与状态变化

1. 依据 Sample ID 和 repetition key 连接 Baseline 与 Candidate Trial，保留无法配对的缺失记录。
2. 对每对 Score 计算差值；若一个实体产生多个相关样本，还需在实体或 cluster 层重采样。
3. 用固定 seed 的 paired Bootstrap 反复抽取配对，得到效果量分布和区间。
4. Gate 先检查证据可用性与关键非补偿条件，再读取 Metric 或 Comparison。
5. GateDecision 保存 metric_ids、状态与原因；Reporter 不得把它扩大为真实生产发布授权。

在 Reference Harness 里，[`paired_bootstrap`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/comparison.py) 负责做统计比较，[`evaluate_gate`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/gates.py) 则负责执行政策，两层各管一件事。

## 关键数据结构

```text
MetricEstimate(metric_id, numerator, denominator, value, score_ids)
ComparisonResult(baseline_id, candidate_id, mean_difference,
                 interval_low, interval_high, pairs, seed)
GateDecision(gate_id, status, metric_ids, reason)
```

计算区间时还要保存 iterations、按什么单位重采样，以及遇到缺失值怎么办，否则两个都叫「95% 区间」的结果，背后可能用的是完全不同的假设。GatePolicy 也得版本化，因为阈值、关键检查和例外流程如果只藏在 CI 脚本的一行 if 里，事后就很难查清某次决定到底遵循了哪套规则。

## 设计取舍

非配对比较写起来简单，但双方跑同一个 Dataset 时，这种做法会白白丢掉样本之间原有的对应关系。配对比较通常更容易看出差异，代价是你必须把双方身份逐一对齐，并认真处理每一项缺失。Bootstrap（自助法）能把复杂分布直观地摆出来，却不能让小样本凭空变得可靠，也修不好 Dataset 自带的偏差。质量 Gate 可以只检查绝对阈值，也可以再要求 Candidate「不劣于 Baseline」。关键安全风险通常要用非补偿规则拦住，因为再高的平均正确率也抵消不了这类失败。

lm-evaluation-harness 的 [`evaluator.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L429-L468) 和 `evaluator_utils.py` 怎样运行任务、整理结果，属于**上游源码事实**。本仓库则把发布 Gate 单独建成一层，这是面向质量工程的**教学实现**，不表示上游也提供了相同的 Gate API。

## 失败语义

- Baseline 与 Candidate Sample 集不一致：比较 blocked，不能比较两个孤立平均值冒充配对。
- 区间跨越预声明的最小效果边界：结果 inconclusive，不等于 Candidate 一定更差。
- 关键安全 Score invalid/unscorable：Gate inconclusive 或 blocked，绝不能 passed。
- 有效 pass-rate 低于阈值：Gate failed。
- 看到 82% 后把阈值从 85% 改为 80%：政策污染，需新版本与独立运行。

## 动手实验

运行 `python -m pytest tests/test_metrics.py tests/test_gates.py tests/test_scoring.py -q`，再在 Python REPL 中对 `[0, 0, 1]` 这组三个配对差值调用 `paired_bootstrap(seed=7)` 两次。随后把 seed 改为 8，比较点估计与区间。

## 预期输出与答案

seed 和 iterations 相同时，两次运行应生成完全相同的结果，这只能证明算法回放稳定。如果输入、配对键或算法版本变了，即使碰巧算出同一个数字，也不能说两次分析是同一次。改变 seed 可能会改变有限 Bootstrap 样本给出的区间，但原始配对差的均值仍是 1/3。在 shipping 中，fixed Gate 应为 passed，buggy Gate 应为 failed。只要任一关键 Score 改成 unscorable，相关 Gate 就必须返回 inconclusive，不能撇开它，再用剩余样本算出 100%。

## 常见误解

如果看到「区间不重叠」就直接宣布可以发布，你会漏掉政策约束和多重比较。增加样本只能帮你控制一部分随机方差，不会自动洗掉数据里的系统偏差。较大的 p 值也说明不了两者相同，因为没能拒绝差异，并不等于已经证明等价。Gate failed 是有效证据支持的负面结论，程序执行故障则是另一回事。

## 如何核对

先看 [`tests/test_metrics.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_metrics.py) 有没有锁住计划分母，再看 [`tests/test_gates.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_gates.py) 能不能拦住无效证据。你还可以从 `report.json` 手工取出 Score，重算 numerator/denominator，然后核对 Gate 给出的原因，确认里面的阈值与配置一致。

## 与其他 Harness 的关系

Promptfoo 常把评测接进 CI，再用阈值下判断。DeepEval 更适合用测试断言做回归，benchmark Harness 关心怎样聚合结果和生成排行榜，平台型产品则可能提供实验比较。界面可以各不相同，但你始终要能分开复核统计估计和政策决定，并看清哪些证据缺了、哪些结果彼此依赖。

## 本篇不能证明什么

在本地跑一次 Bootstrap，再加一道阈值 Gate，还算不上完整的统计审查，更不会自动获得真实生产发布的授权。这里展示的只是一个最小闭环：从预先声明 Trial 开始，把 Baseline 和 Candidate 的 Score 配好对，最后生成 Decision，把结论和依据都写清楚，也让每个状态都能查回证据。分布漂移、多重检验和长期风险预算还没有处理。你仍要拿新的运行证据检验外部有效性，并在这套系统之外完成风险接受和组织审批。

[上一章](05-scorer-judge-score-metric.md) · [下一章](07-eval-to-rl-and-release-eval.md)
