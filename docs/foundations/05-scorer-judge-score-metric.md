# 05｜Scorer、Judge、Score 与 Metric：先判单次，再描述总体

[上一章](04-trace-artifact-observation.md) · [下一章](06-uncertainty-comparison-gate.md)

## 本篇要解决什么问题

评测项目常把「指标」一词同时用于判断一句回答、计算一组平均值和决定是否发布。这样做很容易把 Judge 的一次主观判断当成总体质量，也可能让缺失输出悄悄变成 0。要理清这条链路，就得把执行评分的组件、单个 Trial 的评分事实，以及跨 Trial 的统计估计分别说清楚。

## 学完你能解释什么

- Scorer、LLM-as-Judge、ScoreRecord 和 MetricEstimate 的责任差异；
- 为什么确定性证据应优先于模型自评；
- `failed`、`uncertain`、`unscorable` 与 `invalid` 为什么不能都压成 0；
- 为什么 Metric 的分母来自 Trial Plan，而不是成功返回的 Score 数。

## 贯穿案例

shipping 的 Scorer 会读取 Observation 中的 `fee`，再拿它与样本中预先声明的期望值比较。两者相等就得到 passed/1，不相等就得到 failed/0。这个判断只依赖留下来的证据，因此 Target 用脚本还是模型并不影响规则。聚合三个 Sample 时，Metric 的分母固定为三个计划 Trial。即使某个 Bundle 没有 `fee`，对应 Score 也只能记为 unscorable，分母仍然是三，而 Gate 会因为证据不完整而无法判断。

## 核心概念与边界

**Scorer** 是一个可以独立版本化的函数，它负责把 Observation Bundle 转换成 ScoreRecord。**LLM-as-Judge** 只是用模型实现的 Scorer，并没有在评分流程之外另起一个层级。因为模型判断会受提示词和采样影响，所以还要配套 Rubric、采样设置、校准集、偏差检查和分歧处理。**ScoreRecord** 记录单个 Trial 已经发生的评分事实，其中包含状态、值、理由、Scorer 身份和证据血缘。等这些单次事实齐备之后，**MetricEstimate** 才对预先声明的 Trial/Score 集合做聚合，并保存分子、分母、估计值和 score_ids。

如果环境事实能够直接验证，测试、规则或终态断言通常比模型自评更可靠。Judge 更适合评价多值文本质量、语义符合度，以及那些必须依照 Rubric 才能判断的结果。它的输出仍要允许 uncertain，并通过人工标注或确定性证据切面进行持续校准。模型声称「我完成了」只是一段 Target 输出，不能反过来充当独立评分证据。

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

值和状态必须同时保留，因为二者回答的是评分里的不同问题。`value=0` 可以表示规则已经明确判错，却表达不了证据缺失或协议无效。Gate 得先读取状态，才能知道这个数是否适合继续推断，而 reason 只是方便人类核对，不能顶替结构化状态。

## 设计取舍

二元规则简单且容易复现，却可能遗漏那些难以用通过或失败概括的质量。连续分数能表达更细的差别，但阈值、尺度和校准都会影响它的含义。多个 Scorer 可以分别检查正确性、安全和格式，再让非补偿 Gate 单独处理关键风险——否则一次安全失败可能被高正确率平均掉。Judge 虽然能降低人工成本，仍需要冻结模型、prompt、Rubric 和随机性，并定期拿人工样本做对照。

DeepEval 的 [`BaseMetric`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/metrics/base_metric.py#L54-L93) 展示 Metric/Judge 抽象，这是**上游源码事实**。Promptfoo 的 [`runAssertion`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/assertions/index.ts#L683-L703) 则展示 Assertion 如何分派。这里把二者放到统一的 Scorer 责任下理解，属于**机制解释**，并不表示它们拥有相同的状态枚举。

## 失败语义

- 可观察值与 Reference 不符：`failed`，可计入明确失败。
- 需要字段没有采集：`unscorable`，必须暴露缺证问题。
- Judge 两次判断冲突且无仲裁：`uncertain`，不能挑有利一次。
- Scorer 版本或 Bundle digest 不匹配：`invalid`，整个 Score 不应聚合。
- 计划 100 个 Trial 只产生 90 个 Score：Metric 分母仍为 100，并单独报告缺失。

## 动手实验

运行 shipping 示例后打开 `evidence.json`，将副本中某个 `target_completed` 事件的 output 移除，在测试代码里用 `FieldMatchesExpectedScorer` 对该 Bundle 评分。再对完整 3 个计划 Trial 中仅 2 条 passed Score 调用 `aggregate_pass_rate`。

## 预期输出与答案

缺字段的 Bundle 应产生 `unscorable`，对应 value 为 null，不能默认为 failed。两条 passed Score 对应三个计划 Trial 时，Metric 应当是 2/3，而非 2/2。如果把 unscorable Score 一起交给 Gate，结果应为 inconclusive，因为现有证据既不足以支持通过，也不足以确认失败。

## 常见误解

认为「Judge 给出数字就很客观」，会忽略校准过程与模型偏差。把 unscorable 记作 0 看似保守，却会混淆产品质量问题和 Harness 自身的可观测性问题。只看平均分还会遮住关键风险与分组差异，而直接比较同名 metric，也可能漏掉数据、Scorer 和分母定义的变化。

## 如何核对

运行 `python -m pytest tests/test_scoring.py tests/test_metrics.py tests/test_gates.py -q`，重点检查缺字段状态、计划分母、重复 score_id，以及不可用证据无法通过 Gate 的约束。随后阅读锁定的 DeepEval 实现，判断上游所谓 Metric 在什么情况下同时承担了本篇的 Scorer 和 Score 汇总责任。

## 与其他 Harness 的关系

lm-evaluation-harness 通常由 Task 构造请求并聚合 metric，Inspect AI 会明确暴露 Scorer 与 Metric，Promptfoo 则以 Assertion 面向测试配置。DeepEval 使用 Metric 类执行单案例判断，其中也包括 Judge。名称相同并不表示所在层级相同，因此比较这些工具时，应追问输入究竟是一条 Observation，还是一组 Score。

## 本篇不能证明什么

评分血缘和状态正确不能证明 Rubric 有效、Judge 无偏或 Dataset 代表真实线上流量，也无法说明高分是否覆盖了真正需要守住的业务风险，更不能替代领域专家对评分目标的复核。它能做的事情很具体——阻止不兼容的证据被静默压成一个看似精确的数字。

[上一章](04-trace-artifact-observation.md) · [下一章](06-uncertainty-comparison-gate.md)
