# 05｜Scorer、Judge、Score 与 Metric：先判单次，再描述总体

[上一章](04-trace-artifact-observation.md) · [下一章](06-uncertainty-comparison-gate.md)

## 本篇要解决什么问题

评测项目常把“指标”一词同时用于判断一句回答、计算一组平均值和决定是否发布，所以结果是 Judge 的一条主观判断被当成总体质量，或缺失输出被无声写成 0。要避免这种混乱，必须把执行评分器的组件、单 Trial 评分事实和跨 Trial 统计估计拆开。

## 学完你能解释什么

- Scorer、LLM-as-Judge、ScoreRecord 和 MetricEstimate 的责任差异；
- 为什么确定性证据应优先于模型自评；
- `failed`、`uncertain`、`unscorable` 与 `invalid` 为什么不能都压成 0；
- 为什么 Metric 的分母来自 Trial Plan，而不是成功返回的 Score 数。

## 贯穿案例

shipping 的 Scorer 读取 Observation 中的 `fee` 和样本期望值——相等得到 passed/1，不等得到 failed/0。它不关心 Target 是脚本还是模型。对三个 Sample 聚合时，Metric 分母固定为三个计划 Trial；即使某个 Bundle 缺少 `fee`，分母仍为三，该条 Score 是 unscorable，并进一步使 Gate 无法判断，而不是从分母删除。

## 核心概念与边界

**Scorer** 是把一个 Observation Bundle 转换成 ScoreRecord 的可版本化函数；**LLM-as-Judge** 是使用模型实现的 Scorer，不是独立层级，它还需 Rubric、采样设置、校准集、偏差检查和分歧处理。**ScoreRecord** 是对单个 Trial 的评分事实，包含状态、值、理由、Scorer 身份和证据血缘；**MetricEstimate** 对预声明的 Trial/Score 集合做聚合，包含分子、分母、估计值和 score_ids。

环境事实可直接验证时，优先用测试、规则或终态断言；Judge 适合多值文本质量、语义符合度和需要 Rubric 的判断，但其输出应允许 uncertain，并与人工标注或确定性切面校准。模型说“我完成了”只是 Target 输出，不能作为自己的独立评分。

## 机制图

![Scorer、Judge、Score 与 Metric 的边界](../assets/diagrams/foundations/05-scoring.svg)

## 调用链与状态变化

1. Scorer 从 Bundle 中寻找被协议允许的观察字段，不直接重跑 Target。
2. 字段存在且满足规则时生成 passed Score；存在但不满足时生成 failed Score。
3. 关键字段缺失时生成 unscorable；协议或血缘破坏时应生成 invalid；Judge 无法稳定裁决时生成 uncertain。
4. Aggregator 以计划 Trial ID 为分母，验证 Score 没有引用计划外 Trial，也没有重复 score_id。
5. Metric 保存 numerator、denominator、value 和参与的 score_ids，供比较与 Gate 使用。

本仓库的 [`FieldMatchesExpectedScorer`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/scorers/rules.py) 与 [`aggregate_pass_rate`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/metrics.py) 是最小可运行实现。

## 关键数据结构

| 层 | 关键字段 | 不能缺少的身份 |
| --- | --- | --- |
| Scorer 配置 | field、Rubric、阈值、采样参数 | scorer_id 与版本 |
| ScoreRecord | status、value、reason | Trial、Attempt、Bundle、Scorer |
| MetricEstimate | numerator、denominator、value | metric_id 与 score_ids |

值和状态必须同时保留，因为 `value=0` 可能代表规则明确判错，却不能表达缺证据或协议无效；只有状态能告诉 Gate 这个数是否可用于推断。理由用于人类核对，不应取代结构化状态。

## 设计取舍

二元规则简单、可复现，却可能遗漏部分质量；连续分数更细，但阈值、尺度和校准会影响解释。多个 Scorer 可以分别测正确性、安全和格式，再由非补偿 Gate 处理关键风险——不应先把关键安全失败平均进高正确率。Judge 可以降低人工成本，但需要冻结模型、prompt、Rubric 和随机性，并定期与人工样本对照。

DeepEval 的 [`BaseMetric`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/metrics/base_metric.py#L54-L93) 展示 Metric/Judge 抽象，是**上游源码事实**；Promptfoo 的 [`runAssertion`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/assertions/index.ts#L683-L703) 展示 Assertion 分派。把二者映射到统一的 Scorer 责任是**机制解释**，并非断言其状态枚举相同。

## 失败语义

- 可观察值与 Reference 不符：`failed`，可计入明确失败。
- 需要字段没有采集：`unscorable`，必须暴露缺证问题。
- Judge 两次判断冲突且无仲裁：`uncertain`，不能挑有利一次。
- Scorer 版本或 Bundle digest 不匹配：`invalid`，整个 Score 不应聚合。
- 计划 100 个 Trial 只产生 90 个 Score：Metric 分母仍为 100，并单独报告缺失。

## 动手实验

运行 shipping 示例后打开 `evidence.json`，将副本中某个 `target_completed` 事件的 output 移除，在测试代码里用 `FieldMatchesExpectedScorer` 对该 Bundle 评分。再对完整 3 个计划 Trial 中仅 2 条 passed Score 调用 `aggregate_pass_rate`。

## 预期输出与答案

缺字段的 Bundle 应产生 `unscorable` 且 value 为 null，它不能被默认为 failed；两条 passed Score 配三个计划 Trial 时 Metric 为 2/3，而不是 2/2。若把 unscorable Score 一起交给 Gate，Gate 应为 inconclusive，因为证据不足以支持通过或明确失败。

## 常见误解

“Judge 给数字就很客观”忽略校准与模型偏差；“unscorable 按 0 最安全”混淆产品质量和 Harness 可观测性；“平均分足够”会掩盖关键风险与分组差异；“同名 metric 可直接比较”忽略数据、Scorer 和分母定义。

## 如何核对

运行 `python -m pytest tests/test_scoring.py tests/test_metrics.py tests/test_gates.py -q`，重点检查缺字段状态、计划分母、重复 score_id 和不可用证据不能过 Gate；再阅读锁定 DeepEval 实现，区分上游所谓 Metric 何时同时承担本篇的 Scorer 与 Score 汇总责任。

## 与其他 Harness 的关系

lm-evaluation-harness 常让 Task 构造请求并聚合 metric；Inspect AI 明确暴露 Scorer 与 Metric；Promptfoo 以 Assertion 面向测试配置；DeepEval 用 Metric 类执行包括 Judge 在内的单案例判断。名称相同不代表层级相同，比较时应问“输入是一条 Observation 还是一组 Score”。

## 本篇不能证明什么

评分血缘和状态正确不能证明 Rubric 有效、Judge 无偏或 Dataset 代表线上流量。它只阻止不兼容的证据被静默压成一个看似精确的数字。

[上一章](04-trace-artifact-observation.md) · [下一章](06-uncertainty-comparison-gate.md)
