# 05｜Scorer、Judge、Score 与 Metric：先判单次，再描述总体

[上一章](04-trace-artifact-observation.md) · [下一章](06-uncertainty-comparison-gate.md)

## 本篇要解决什么问题

评测项目常用「指标」同时指三件事：判断一条回答、计算一组平均值，以及决定能不能发布。这样一来，Judge 的一次主观判断很容易被当成总体质量，缺失的输出也可能悄悄变成 0。要把这条链路理清，你得分开看谁负责评分、单个 Trial 得到了什么结果，以及多个 Trial 合起来说明什么。

## 学完你能解释什么

- Scorer、LLM-as-Judge、ScoreRecord 和 MetricEstimate 的责任差异；
- 为什么确定性证据应优先于模型自评；
- `failed`、`uncertain`、`unscorable` 与 `invalid` 为什么不能都压成 0；
- 为什么 Metric 的分母来自 Trial Plan，而不是成功返回的 Score 数。

## 贯穿案例

shipping 的 Scorer（评分器）从 Observation 里读出 `fee`，再与 Sample 预先写好的期望值比较，相等就记 passed/1，不相等就记 failed/0。规则只看留下来的证据，所以 Target 背后跑的是脚本还是模型，都不会改变判法。聚合三个 Sample 时，Metric 的分母始终是计划中的三个 Trial，即使某个 Bundle 没有 `fee`，对应 Score 也只能记为 unscorable，Gate 会因为缺证而无法判断，却不能顺手把分母减成二。

## 核心概念与边界

**Scorer** 是可以单独版本化的函数，它读取 Observation Bundle，再产出 ScoreRecord（评分记录）。**LLM-as-Judge**（大语言模型裁判）只是在 Scorer 里面调用模型，并没有跳出评分流程另占一层。

模型的判断会随提示词和采样变化，因此你还得准备 Rubric（评分标准）、采样设置和校准集，并处理偏差与分歧。**ScoreRecord** 记下单个 Trial 已经发生的评分，包括状态、值、理由、Scorer 身份和证据血缘。等每次评分都落下来以后，**MetricEstimate**（指标估计值）才聚合预先声明的 Trial/Score 集合，同时保存分子、分母、估计值和 score_ids。

如果能直接检查环境事实，测试、规则和终态断言通常比模型自评更可靠。Judge 更适合判断没有唯一答案的文本质量、语义是否符合要求，以及必须参照 Rubric 才能下结论的结果，不过它仍要允许输出 uncertain，并持续拿人工标注或确定性证据做校准。模型自己说「我完成了」，只算 Target 的一段输出，不能拿来给自己作证。

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

值和状态必须一起保存，因为它们回答的是两个问题：规则算出了多少，以及这次评分能不能用。`value=0` 可以表示规则明确判错，却说不出证据缺失或协议已经失效。Gate 得先看状态，确认这个数能不能继续拿来推断。reason 只方便人来核对，替代不了结构化状态。

## 设计取舍

二元规则简单，也容易复现，但有些质量很难只用通过或失败说清楚。连续分数能拉开更细的差别，可它究竟代表什么，又会受到阈值、尺度和校准方式影响。你可以让多个 Scorer 分别检查正确性、安全和格式，再交给非补偿 Gate 单独拦住关键风险，否则一次安全失败很可能被较高的正确率平均掉。Judge 能省下一部分人工，仍然要冻结模型、prompt、Rubric 和随机设置，并定期拿人工样本对照。

DeepEval 的 [`BaseMetric`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/metrics/base_metric.py#L54-L93) 怎样抽象 Metric/Judge，属于**上游源码事实**。Promptfoo 的 [`runAssertion`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/assertions/index.ts#L683-L703) 怎样分派 Assertion，也是**上游源码事实**。这里把两者都放到 Scorer 的职责下理解，属于我们的**机制解释**，不代表它们使用相同的状态枚举。

## 失败语义

- 可观察值与 Reference 不符：`failed`，可计入明确失败。
- 需要字段没有采集：`unscorable`，必须暴露缺证问题。
- Judge 两次判断冲突且无仲裁：`uncertain`，不能挑有利一次。
- Scorer 版本或 Bundle digest 不匹配：`invalid`，整个 Score 不应聚合。
- 计划 100 个 Trial 只产生 90 个 Score：Metric 分母仍为 100，并单独报告缺失。

## 动手实验

运行 shipping 示例并打开 `evidence.json`，复制一份文件，从其中一个 `target_completed` 事件里删掉 output，然后在测试代码里让 `FieldMatchesExpectedScorer` 给这个 Bundle 评分。接着保留完整的 3 个计划 Trial，只提供其中 2 条 passed Score，再调用 `aggregate_pass_rate`。

## 预期输出与答案

Bundle 少了字段时，Scorer 应产出 `unscorable`，并把 value 设为 null，不能默认判成 failed。两条 passed Score 对应三个计划 Trial 时，Metric 应当算成 2/3，不能算 2/2。把 unscorable Score 一并交给 Gate 后，结果应是 inconclusive，因为现有证据既撑不起通过，也不足以确认失败。

## 常见误解

如果你认为「Judge 给了数字就很客观」，就会漏掉校准过程和模型偏差。把 unscorable 记成 0 看起来保守，却会把产品质量问题和 Harness 自己没采到证据混在一起。只盯着平均分还会遮住关键风险和分组差异，直接比较两个同名 metric 也一样危险，因为数据、Scorer 或分母的定义可能早已变了。

## 如何核对

运行 `python -m pytest tests/test_scoring.py tests/test_metrics.py tests/test_gates.py -q`，重点检查缺字段时记什么状态、聚合时用哪个分母、重复 score_id 是否被拦下，以及无效证据能不能通过 Gate。随后阅读锁定的 DeepEval 实现，判断上游所说的 Metric 在哪些情况下既负责本篇的 Scorer 工作，又负责汇总 Score。

## 与其他 Harness 的关系

在 lm-evaluation-harness 里，Task 通常既构造请求，也聚合 metric。Inspect AI 会明确露出 Scorer 和 Metric，Promptfoo 则让 Assertion 面向测试配置，DeepEval 又用 Metric 类判断单个案例，其中也包括 Judge。名字相同，所处的层级未必相同，所以比较这些工具时，你得继续问一句：它接收的是一条 Observation，还是一组 Score？

## 本篇不能证明什么

评分血缘完整、状态也记对了，仍然证明不了 Rubric 有效、Judge 没有偏差，或者 Dataset 能代表真实线上流量。高分是否覆盖了必须守住的业务风险，也要由领域专家继续复核评分目标。这套链路能做的事情很具体：不让互不兼容的证据悄悄挤成一个看起来很精确的数字。

[上一章](04-trace-artifact-observation.md) · [下一章](06-uncertainty-comparison-gate.md)
