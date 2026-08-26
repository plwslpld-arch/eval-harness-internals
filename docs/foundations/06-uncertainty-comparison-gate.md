# 06｜不确定性、比较与 Gate：从分数到可执行决定

[上一章](05-scorer-judge-score-metric.md) · [下一章](07-eval-to-rl-and-release-eval.md)

## 本篇要解决什么问题

Candidate 得分 82%，Baseline 得分 80%，能否发布？只看两个点估计无法回答：它们是否测了相同样本、差异是否由少数样本驱动、重复运行是否相关、有没有缺失证据、关键安全切面是否失败，以及阈值是不是看到结果后才选。比较和 Gate 必须把统计问题与决策政策分开。

## 学完你能解释什么

- 为什么同一 Sample 上的 Baseline/Candidate 应保持配对；
- Bootstrap 区间表达什么、不表达什么；
- Metric、ComparisonResult 与 GateDecision 的区别；
- 为什么 Gate 需要 passed、failed、blocked、inconclusive 四种结果。

## 贯穿案例

shipping 有三个样本。buggy 通过 2/3，fixed 通过 3/3，点估计差为 1/3；因为两个 Target 使用完全相同的 Sample 和 repetition，所以可以计算每一对的 Score 差，再对配对差值重采样。样本只有三个，区间不会神奇地提供真实业务确定性，但配对至少避免把样本难度差异误当模型差异；发布 Gate 还要求 fixed pass-rate 达到 1.0 且没有 unscorable 证据。

## 核心概念与边界

**MetricEstimate** 描述某个 Target 在一组计划 Trial 上的估计；**ComparisonResult** 描述 Candidate 相对 Baseline 的效果量、方向和不确定性。**GatePolicy** 是预先声明的决策函数，读取有效 Metric、比较和关键检查；**GateDecision** 是一次具体运行得到的通过、失败、阻断或无法判断，并保存依据。

`blocked` 表示计划条件没满足，例如环境不可用或唯一 Metric 缺失；`inconclusive` 表示已有运行证据却不足以作通过/失败推断，例如关键 Score uncertain。failed 表示有效证据明确未达政策，passed 才表示所有声明条件满足；四者不应压成布尔值。

## 机制图

![成对比较与质量门禁](../assets/diagrams/foundations/06-comparison-gate.svg)

## 调用链与状态变化

1. 依据 Sample ID 和 repetition key 连接 Baseline 与 Candidate Trial，保留无法配对的缺失记录。
2. 对每对 Score 计算差值；若一个实体产生多个相关样本，还需在实体或 cluster 层重采样。
3. 用固定 seed 的 paired Bootstrap 反复抽取配对，得到效果量分布和区间。
4. Gate 先检查证据可用性与关键非补偿条件，再读取 Metric 或 Comparison。
5. GateDecision 保存 metric_ids、状态与原因；Reporter 不得把它扩大为真实生产发布授权。

Reference Harness 的 [`paired_bootstrap`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/comparison.py) 和 [`evaluate_gate`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/gates.py) 分别承担统计与政策层。

## 关键数据结构

```text
MetricEstimate(metric_id, numerator, denominator, value, score_ids)
ComparisonResult(baseline_id, candidate_id, mean_difference,
                 interval_low, interval_high, pairs, seed)
GateDecision(gate_id, status, metric_ids, reason)
```

区间算法还应保存 iterations、重采样单位和缺失策略，否则同一个“95% 区间”可能来自完全不同假设；GatePolicy 要版本化，阈值、关键切面和例外流程不能只存在 CI 脚本的一行 if 中。

## 设计取舍

非配对比较实现简单，但同一 Dataset 下会浪费样本内相关信息；配对比较更敏感，却要求身份和缺失处理严格。Bootstrap 对复杂分布直观，但不是小样本的万能证明——也不能修复有偏 Dataset。质量 Gate 可以只看绝对阈值，也可同时要求“不劣于 Baseline”；关键安全风险通常采用非补偿规则，不能被高平均正确率抵消。

lm-evaluation-harness 的 [`evaluator.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L429-L468) 与 `evaluator_utils.py` 展示任务运行和结果整理的**上游源码事实**；本仓库把发布 Gate 独立建模，是面向质量工程的**教学实现**，不是声称上游自带同一 Gate API。

## 失败语义

- Baseline 与 Candidate Sample 集不一致：比较 blocked，不能比较两个孤立平均值冒充配对。
- 区间跨越预声明的最小效果边界：结果 inconclusive，不等于 Candidate 一定更差。
- 关键安全 Score invalid/unscorable：Gate inconclusive 或 blocked，绝不能 passed。
- 有效 pass-rate 低于阈值：Gate failed。
- 看到 82% 后把阈值从 85% 改为 80%：政策污染，需新版本与独立运行。

## 动手实验

运行 `python -m pytest tests/test_metrics.py tests/test_gates.py tests/test_scoring.py -q`，再在 Python REPL 中对 `[0, 0, 1]` 这组三个配对差值调用 `paired_bootstrap(seed=7)` 两次。随后把 seed 改为 8，比较点估计与区间。

## 预期输出与答案

相同 seed 和 iterations 应生成完全相同结果，证明算法回放稳定；改变 seed 可能改变有限 Bootstrap 样本的区间，但原始配对差的均值仍为 1/3。shipping 的 fixed Gate passed、buggy Gate failed；若任一关键 Score 改为 unscorable，相关 Gate 必须 inconclusive，而不是用剩余样本计算 100%。

## 常见误解

“区间不重叠就一定可发布”忽略政策和多重比较；“样本数大就没有偏差”混淆方差与系统偏差；“p 值大说明两者相同”把未拒绝当等价；“Gate failed 等于程序失败”混淆有效负面结论和执行故障。

## 如何核对

查看 [`tests/test_metrics.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_metrics.py) 是否锁住计划分母，查看 [`tests/test_gates.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_gates.py) 是否阻止无效证据通过；手工从 `report.json` 取 Score 重算 numerator/denominator，并确认 Gate 原因中的阈值与配置一致。

## 与其他 Harness 的关系

Promptfoo 常把评测接入 CI 并用阈值判断；DeepEval 适合测试断言式回归；benchmark Harness 更关注聚合与排行榜；平台型产品可能提供实验比较——无论界面如何，统计估计与政策决定都应可分开复核，并明确缺失和多重依赖。

## 本篇不能证明什么

一个本地 Bootstrap 和阈值 Gate 不构成完整统计审查，也不授权真实生产发布；它只展示从预声明 Trial、配对 Score 到可解释 Decision 的最小闭环——外部有效性、风险接受和组织审批仍在系统外。

[上一章](05-scorer-judge-score-metric.md) · [下一章](07-eval-to-rl-and-release-eval.md)
