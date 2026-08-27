# 07｜Eval-to-RL 与独立 Release Eval：改进闭环不能吃掉验收集

[上一章](06-uncertainty-comparison-gate.md) · [下一章](../learning-paths.md)

## 本篇要解决什么问题

评测发现失败样本后，人们往往会用它生成偏好对、验证器奖励或在线强化学习任务。问题在于，同一批样本和 Scorer 一旦既用于训练、选择 checkpoint，又被拿来证明发布质量，模型可能只是学会了通过已知门禁。Eval-to-RL 的关键不在于把分数接到训练 API，而在于隔离三类决定的证据：训练 reward、checkpoint 选择，以及独立 Release Eval。

## 学完你能解释什么

- Evaluator、RewardAdapter、DPO/GRPO/RFT 和独立发布评测怎样形成完整链路；
- 为什么并非所有 Score 都能直接变成 reward；
- 开发集、训练反馈集、选择集和独立留出集怎样分工；
- 为什么改进循环可以快，而发布 Gate 必须保持独立。

## 贯穿案例

shipping 中金额 100 的失败可以进入训练难例。用于 DPO 时，可以构造「免运费」正确输出优于「收 10 元」错误输出的偏好对。用于 GRPO/RFT 时，则可以让确定性规则产生 0/1 reward。发布评测不能继续只用 99、100、101 这三个已经被优化器反复看过的样本，因此还要冻结未参与训练的边界组合、数据类型和异常路径，让 Candidate 在一次新运行中独立接受同一业务不变量的检查。

## 核心概念与边界

**Evaluator** 产生带血缘的 Score 和失败簇。随后，**RewardAdapter** 按照明确规则，把评测语义转换成训练接口能够接收的标量 reward、偏好对、验证器结果，或者标记为不可用。**DPO** 消费偏好数据，**GRPO/RFT** 则常常消费可验证轨迹或模型生成轨迹上的奖励。训练期间可以用 **checkpoint choice eval** 选择候选，并允许结果影响优化路径。等候选身份冻结后，**independent release eval** 才使用隔离留出集和独立运行，判断它能否进入下一环境。

RewardAdapter 必须声明自己的能力合同。确定性测试通过时，通常可以安全地映射成对应的验证器 reward。Judge 给出的 uncertain 不能硬压成 0/1，而需要跨样本聚合的公平性 Metric，也不能在没有解释的情况下分摊到每条轨迹。某些 Score 还包含人工标注过程中的隐私数据，因而可能被禁止进入训练。遇到无法表达的情况应写 `unavailable`，只能表达一部分语义时则写 `partial`。

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

复用同一个 Scorer 有助于保持目标一致，却也会放大奖励黑客风险。因此，Release Eval 应增加独立的评测切面、不同实现或人工抽查。完全隐藏留出集可以降低泄漏，代价是维护成本更高、反馈更慢，所以实践中可以用开发集快速迭代，并周期性刷新独立集。自动 reward 便于扩大训练数据规模，人工偏好则能覆盖更细腻的语义——但两者都必须留下来源与授权记录。

OpenAI Evals 的锁定 [`eval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py#L46-L85) 展示样本 Eval 抽象，这是**上游源码事实**。本仓库再通过 RewardAdapter 把 Score 连接到 DPO/GRPO/RFT，这部分属于**架构机制解释**。OpenAI Evals 的这个文件本身并未提供这里描述的训练适配器实现。

## 失败语义

- Judge uncertain 被强制转成负 reward：Adapter 语义无效，应拒绝导出。
- 同一客户的近重复样本跨训练与留出集：实体泄漏，Release Eval invalid。
- 训练循环根据留出结果多次调参：留出集转化为开发集，必须更换独立集。
- checkpoint 在开发集提升、独立 Gate 失败：有效的负面发布结论，不得用训练 reward 覆盖。
- Reward 很高但真实终态不满足：奖励黑客，需要环境事实 Scorer 和新回归样本。

## 动手实验

从 shipping 的 `report.json` 选出 failed Score，沿 observation_bundle_digest 找到金额 100 的输出与 expected。然后写一张表，分别判断它能否转换为：DPO 偏好对、GRPO 标量 reward、独立发布 Score。再把一个 unscorable Score 放进同一张表。

## 预期输出与答案

金额 100 的样本错误明确，而且拥有确定性 Reference，因此可以生成 chosen=`fee:0`、rejected=`fee:10`，也可以映射为 0 reward。无论最后采用哪一种训练数据形式，都必须完整保留它的来源血缘。因为这个样本已经被用于训练过程，所以不能再充当独立发布评测中的证据。unscorable 也不能直接映射为失败 reward，应标记 unavailable，并先修复观测链。独立发布 Score 必须来自冻结 Candidate 在未参与训练的 Dataset 上运行的新 Trial。

## 常见误解

把 Eval 分数直接当成 reward，会忽略粒度和状态。仅仅划分 train/test 也阻止不了所有泄漏，因为同实体样本、近重复内容和反馈循环仍可能跨过边界。Release Eval 做得晚，不代表它天然独立。如果结果持续用于指导调参，这批数据实际上已经承担开发集的角色。RL 提升 reward 只说明优化目标上的变化，不能直接证明产品的外部有效性。

## 如何核对

从任一训练样本反查原 Score、Bundle 和 Scorer 版本，并确认 RewardAdapter 的每一种状态映射都有测试。还要检查 SplitManifest 是否按实体分组，从而确认独立集没有进入训练、prompt 选择或阈值调节。Reference Harness 当前只提供 Eval 证据，并未实现训练，这是一条有意保留的边界，并非遗漏声明。

## 与其他 Harness 的关系

主流 Eval Harness 通常聚焦评测执行、评分或 CI，训练框架则更关注优化过程。两类系统衔接时，显式 Adapter 比共享一个数据文件更重要，因为 Adapter 能说明语义究竟怎样转换。Agent Environment Harness 还可以提供能够验证终态的 reward，LLM-as-Judge Harness 则更依赖校准与人工仲裁。无论怎样组合工具，独立 Release Eval 都应保留专属于发布判断的 Dataset、运行和 Gate 血缘。

## 本篇不能证明什么

本篇没有实现 DPO、GRPO 或 RFT 训练，也不声称某种算法必然提升真实质量。它给出的是证据隔离合同。训练信号可以源自 Eval，但用于发布的结论必须来自训练之外的独立评测。

[上一章](06-uncertainty-comparison-gate.md) · [下一章](../learning-paths.md)
