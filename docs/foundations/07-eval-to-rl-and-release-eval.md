# 07｜Eval-to-RL 与独立 Release Eval：改进闭环不能吃掉验收集

[上一章](06-uncertainty-comparison-gate.md) · [下一章](../learning-paths.md)

## 本篇要解决什么问题

评测发现失败样本后，最有价值的下一步往往是生成偏好对、验证器奖励或在线强化学习任务；但一旦同一批样本和 Scorer 被用于训练、选择 checkpoint，又继续用来声称发布质量，模型可能只学会通过已知门禁。Eval-to-RL 的关键不是把分数接到训练 API，而是保持训练 reward、checkpoint 选择和独立 Release Eval 三种决定的证据隔离。

## 学完你能解释什么

- Evaluator、RewardAdapter、DPO/GRPO/RFT 和独立发布评测怎样形成完整链路；
- 为什么并非所有 Score 都能直接变成 reward；
- 开发集、训练反馈集、选择集和独立留出集怎样分工；
- 为什么改进循环可以快，而发布 Gate 必须保持独立。

## 贯穿案例

shipping 的金额 100 失败可进入训练难例：对于 DPO，可构造“免运费”正确输出优于“收 10 元”错误输出的偏好对；对于 GRPO/RFT，可用确定性规则产生 0/1 reward。但发布评测不能只保留 99、100、101 这三个已被优化器反复看到的样本，所以应另外冻结未参与训练的边界组合、数据类型和异常路径，让 Candidate 在新运行中独立接受同一业务不变量检查。

## 核心概念与边界

**Evaluator** 产生带血缘的 Score 和失败簇；**RewardAdapter** 明确把评测语义转换为训练接口：标量 reward、偏好对、验证器结果或不可用。**DPO** 消费偏好数据；**GRPO/RFT** 常消费可验证或模型生成轨迹上的奖励。**checkpoint choice eval** 在训练过程中选择候选，允许影响优化路径；但 **independent release eval** 使用隔离留出集和独立运行，在候选冻结后决定是否进入下一环境。

RewardAdapter 必须声明能力合同。确定性测试通过可安全映射为验证器 reward；Judge 的 uncertain 不应硬压成 0/1；需要跨样本聚合的公平性 Metric 不能无解释地分摊到每条轨迹；带人工隐私数据的 Score 也可能禁止进入训练。不可表达时应写 `unavailable`，部分表达时写 `partial`。

## 机制图

![Eval-to-RL 与独立发布评测隔离](../assets/diagrams/foundations/07-eval-to-rl.svg)

## 调用链与状态变化

1. 开发 Eval 保存 Trial、Observation、Score 和失败原因；Failure Miner 按错误机制聚类，而不是只挑最低分。
2. RewardAdapter 检查 Scorer 身份、证据许可、粒度和不确定状态，输出偏好、标量 reward 或拒绝转换。
3. DPO/GRPO/RFT 使用这些数据更新模型或策略——训练日志与 reward 版本被保存，但不成为发布证据。
4. Checkpoint Eval 在开发/选择 Split 上比较多个候选，选出一个冻结 Candidate 身份。
5. 独立 Release Eval 在训练不可见的留出集和干净环境重跑 Candidate，对照 Baseline 与 Gate Policy。
6. 只有独立 Gate 的证据进入发布报告；生产事件随后可以回流为下一轮开发数据，但不能改写历史 Gate。

## 关键数据结构

| 对象 | 需要的字段 | 主要风险 |
| --- | --- | --- |
| RewardAdapterContract | scorer_id、输出类型、状态映射、限制 | 语义错误转换 |
| PreferencePair | prompt、chosen、rejected、来源 Score | 偏好泄漏或伪标签 |
| VerifierReward | Trial/Attempt/Bundle、reward、verifier 版本 | 奖励黑客 |
| SplitManifest | entity group、用途、版本、授权 | 样本或实体泄漏 |
| ReleaseEvalSpec | Candidate 身份、独立 Dataset、Gate | 训练后调阈值 |

## 设计取舍

复用同一个 Scorer 能保持目标一致，却也会放大奖励黑客风险；因此 Release Eval 应增加独立切面、不同实现或人工抽查——完全隐藏留出集降低泄漏，但维护成本高且反馈慢；可采用开发集快速迭代、周期性刷新独立集。自动 reward 规模大，人工偏好能覆盖细腻语义，两者都需要来源与授权记录。

OpenAI Evals 的锁定 [`eval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py) 展示样本 Eval 抽象，是**上游源码事实**。把 Score 经过 RewardAdapter 连接到 DPO/GRPO/RFT 是本仓库的**架构机制解释**；OpenAI Evals 该文件本身不提供这里描述的训练适配器。

## 失败语义

- Judge uncertain 被强制转成负 reward：Adapter 语义无效，应拒绝导出。
- 同一客户的近重复样本跨训练与留出集：实体泄漏，Release Eval invalid。
- 训练循环根据留出结果多次调参：留出集转化为开发集，必须更换独立集。
- checkpoint 在开发集提升、独立 Gate 失败：有效的负面发布结论，不得用训练 reward 覆盖。
- Reward 很高但真实终态不满足：奖励黑客，需要环境事实 Scorer 和新回归样本。

## 动手实验

从 shipping 的 `report.json` 选出 failed Score，沿 observation_bundle_digest 找到金额 100 的输出与 expected；写一张表，分别判断它能否转换为：DPO 偏好对、GRPO 标量 reward、独立发布 Score。再把一个 unscorable Score 放进同一张表。

## 预期输出与答案

明确错误且有确定性 Reference 的金额 100 样本可生成 chosen=`fee:0`、rejected=`fee:10`，也可映射为 0 reward；其来源血缘必须保留。它仍不能作为独立发布证据，因为已进入训练。unscorable 不能映射为失败 reward，应标记 unavailable 并修复观测链；独立发布 Score 必须来自冻结 Candidate 在未参与训练的 Dataset 上的新 Trial。

## 常见误解

“Eval 分数天然就是 reward”忽略粒度和状态；“只要划分 train/test 就不会泄漏”忽略同实体、近重复和反馈循环；“Release Eval 越晚越独立”不成立，若结果持续指导调参，它已经是开发集；“RL 提升 reward 就证明产品更好”把优化目标当外部有效性。

## 如何核对

从任一训练样本反查原 Score、Bundle 和 Scorer 版本，确认 RewardAdapter 的每个状态映射有测试；检查 SplitManifest 是否按实体分组，确认独立集没有进入训练、prompt 选择或阈值调节。Reference Harness 当前只提供 Eval 证据，不实现训练，这是有意的边界而非遗漏声明。

## 与其他 Harness 的关系

主流 Eval Harness 通常聚焦评测执行、评分或 CI；训练框架聚焦优化——二者之间最重要的是显式 Adapter，而不是共享一个数据文件。Agent Environment Harness 还能提供可验证终态 reward；LLM-as-Judge Harness 更需校准与人工仲裁。无论工具组合怎样，独立 Release Eval 都应保留自己的 Dataset、运行和 Gate 血缘。

## 本篇不能证明什么

本篇没有实现 DPO、GRPO 或 RFT 训练，也不声称某种算法必然提升真实质量。它给出的是证据隔离合同。训练信号可以源自 Eval，但用于发布的结论必须来自训练之外的独立评测。

[上一章](06-uncertainty-comparison-gate.md) · [下一章](../learning-paths.md)
