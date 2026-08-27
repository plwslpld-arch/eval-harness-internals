# 06｜不确定性、比较与 Gate：从分数到可执行决定

[上一章](05-scorer-judge-score-metric.md) · [下一章](07-eval-to-rl-and-release-eval.md)

## 本篇要解决什么问题

Candidate 得分 82%，Baseline 得分 80%，这足以支持发布吗？两个点估计回答不了，因为我们还不知道双方是否测了相同样本，也不知道差异是否由少数样本驱动。重复运行之间可能相关，证据可能缺失，关键安全切面也可能已经失败。甚至判定阈值都有可能是在看到结果之后才临时选定的。只有把统计比较和决策政策分开，这些问题才不会被一个百分比遮住。

## 学完你能解释什么

- 为什么同一 Sample 上的 Baseline/Candidate 应保持配对；
- Bootstrap 区间表达什么、不表达什么；
- Metric、ComparisonResult 与 GateDecision 的区别；
- 为什么 Gate 需要 passed、failed、blocked、inconclusive 四种结果。

## 贯穿案例

shipping 一共有三个样本，其中 buggy 通过 2/3，fixed 通过 3/3，所以点估计差为 1/3。两个 Target 使用完全相同的 Sample 和 repetition，因此可以先计算每一对 Score 的差，再对这些配对差值重采样。样本只有三个，任何区间都无法凭空提供真实业务确定性，不过配对至少避免了把样本难度差异误认成模型差异。发布 Gate 还会单独检查 fixed pass-rate 是否达到 1.0，以及整次运行中有没有 unscorable 证据。

## 核心概念与边界

**MetricEstimate** 描述某个 Target 在一组计划 Trial 上得到的估计。**ComparisonResult** 关注 Candidate 相对 Baseline 的效果量、方向和不确定性。预先声明的 **GatePolicy** 负责读取有效 Metric、比较结果与关键检查，而 **GateDecision** 记录一次具体运行究竟通过、失败、被阻断还是无法判断，并把依据一同保存下来。

`blocked` 表示计划要求的条件尚未满足，例如运行环境不可用或唯一 Metric 缺失。`inconclusive` 则表示已经拿到运行证据，却仍不足以推断通过或失败，例如关键 Score 处于 uncertain。failed 说明有效证据明确没有达到政策要求，passed 才说明所有声明条件都已满足。四种结果携带的行动含义不同——压成布尔值就会丢失这些差别。

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

区间算法还应保存 iterations、重采样单位和缺失策略，否则两个都叫「95% 区间」的结果，背后可能采用完全不同的假设。GatePolicy 也要版本化，因为阈值、关键切面和例外流程一旦只藏在 CI 脚本的一行 if 中，就很难复核某次决定当时遵循了什么规则。

## 设计取舍

非配对比较实现起来简单，但面对同一 Dataset 时，会浪费样本内部的相关信息。配对比较往往更敏感——代价是必须严格处理双方身份与每一项缺失。Bootstrap 能直观呈现复杂分布，却无法替小样本提供万能证明，也修复不了有偏的 Dataset。质量 Gate 可以只看绝对阈值，也可以同时要求「不劣于 Baseline」。关键安全风险通常采用非补偿规则，因为高平均正确率不能抵消这类失败。

lm-evaluation-harness 的 [`evaluator.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L429-L468) 与 `evaluator_utils.py` 展示任务如何运行、结果如何整理，这是**上游源码事实**。本仓库把发布 Gate 独立建模，属于面向质量工程的**教学实现**，并不声称上游自带相同的 Gate API。

## 失败语义

- Baseline 与 Candidate Sample 集不一致：比较 blocked，不能比较两个孤立平均值冒充配对。
- 区间跨越预声明的最小效果边界：结果 inconclusive，不等于 Candidate 一定更差。
- 关键安全 Score invalid/unscorable：Gate inconclusive 或 blocked，绝不能 passed。
- 有效 pass-rate 低于阈值：Gate failed。
- 看到 82% 后把阈值从 85% 改为 80%：政策污染，需新版本与独立运行。

## 动手实验

运行 `python -m pytest tests/test_metrics.py tests/test_gates.py tests/test_scoring.py -q`，再在 Python REPL 中对 `[0, 0, 1]` 这组三个配对差值调用 `paired_bootstrap(seed=7)` 两次。随后把 seed 改为 8，比较点估计与区间。

## 预期输出与答案

相同 seed 和 iterations 应生成完全相同的结果，这能证明这次算法回放保持稳定，但如果输入、配对键或算法版本发生变化，即使碰巧得到同一个数字，也不能据此认定两次分析拥有相同身份。改变 seed 可能改变有限 Bootstrap 样本给出的区间，但原始配对差的均值仍为 1/3。在 shipping 中，fixed Gate 为 passed，buggy Gate 为 failed。如果任一关键 Score 改成 unscorable，相关 Gate 必须返回 inconclusive，不能只拿剩余样本计算出 100%。

## 常见误解

认为「区间不重叠就一定可发布」，会漏掉政策约束和多重比较。样本数变大只能帮助控制部分随机方差，并不会自动消除数据里的系统偏差。较大的 p 值也不能说明两者相同，因为未拒绝不等于已经证明等价。Gate failed 表达的是有效证据下的负面结论，和程序执行故障并非同一回事。

## 如何核对

查看 [`tests/test_metrics.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_metrics.py) 是否锁住计划分母，再查看 [`tests/test_gates.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_gates.py) 是否阻止无效证据通过。还可以手工从 `report.json` 取出 Score，重算 numerator/denominator，并确认 Gate 原因中的阈值与配置一致。

## 与其他 Harness 的关系

Promptfoo 常把评测接入 CI，再用阈值作判断。DeepEval 适合测试断言式回归，benchmark Harness 更关注聚合与排行榜，平台型产品则可能提供实验比较。无论采用哪种界面，统计估计与政策决定都应该能够分开复核，同时明确缺失情况和多重依赖。

## 本篇不能证明什么

一个本地 Bootstrap 加上一道阈值 Gate，还构不成完整的统计审查，也不会自动授权真实生产发布。这里展示的只是从预声明 Trial、配对 Score 一路走到可解释 Decision 的最小闭环，它要求每个状态都能回到对应证据，却还没有处理分布漂移、多重检验或长期风险预算。后续还要检验外部有效性，并完成风险接受与组织审批，而这些工作仍然需要结合新的运行证据，在这套系统之外完成。

[上一章](05-scorer-judge-score-metric.md) · [下一章](07-eval-to-rl-and-release-eval.md)
