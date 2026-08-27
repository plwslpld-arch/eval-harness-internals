# 07｜Eval-to-RL 与独立 Release Eval：改进闭环不能吃掉验收集

[上一章](06-uncertainty-comparison-gate.md) · [下一章](../learning-paths.md)

## 本篇要解决什么问题

评测找出失败样本后，人们往往会拿这些样本生成偏好对、验证器奖励或在线强化学习任务。可同一批样本和 Scorer 如果既用于训练和选择 checkpoint，又用来证明发布质量，模型很可能只是学会了怎样通过一道已知门禁。这就污染了验收证据。Eval-to-RL 的关键不是把分数接上训练 API，而是把三类决定所依据的证据隔开：训练 reward、checkpoint 选择和独立 Release Eval（发布评测）。

## 学完你能解释什么

- Evaluator、RewardAdapter、DPO/GRPO/RFT 和独立发布评测怎样形成完整链路；
- 为什么并非所有 Score 都能直接变成 reward；
- 开发集、训练反馈集、选择集和独立留出集怎样分工；
- 为什么改进循环可以快，而发布 Gate 必须保持独立。

## 贯穿案例

shipping 里金额 100 的失败可以收进训练难例。做 DPO（直接偏好优化）时，你可以构造一个偏好对，让「免运费」这条正确输出优于「收 10 元」的错误输出。

做 GRPO（组相对策略优化）或 RFT（强化微调）时，则可以让确定性规则给出 0/1 reward。发布评测不能再只考 99、100、101 这三个已经被优化器反复看过的样本，还得冻结没有参与训练的边界组合、数据类型和异常路径，让 Candidate 在一次全新的运行里独立接受同一条业务规则检查。

## 核心概念与边界

**Evaluator**（评测器）产出带血缘的 Score，并把失败样本聚成簇。随后，**RewardAdapter**（奖励适配器）按照明确规则，把评测结果翻译成训练接口能接收的标量 reward、偏好对或验证器结果，实在不能转换就标记为不可用。**DPO** 读取偏好数据，**GRPO/RFT** 则常用可验证轨迹或模型生成轨迹上的奖励。训练期间可以运行 **checkpoint choice eval** 来挑选候选，并允许结果影响后续优化。等候选身份冻结以后，**independent release eval** 才在隔离的留出集上另跑一次，判断它能不能进入下一个环境。

RewardAdapter 必须明说自己能转换什么、不能转换什么。确定性测试通过后，通常可以安全地映射成相应的验证器 reward，但 Judge 给出的 uncertain 不能硬压成 0/1，需要跨样本聚合的公平性 Metric 也不能无缘无故摊到每条轨迹上。这两类结果不能混。有些 Score 还带着人工标注时产生的隐私数据，因此不能进入训练。完全表达不了就写 `unavailable`，只能保留部分含义就写 `partial`。

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

训练和发布复用同一个 Scorer，确实能让目标保持一致，却也会放大奖励黑客的风险，因此 Release Eval 还应加入独立的检查角度、不同实现或人工抽查。把留出集完全藏起来能减少泄漏，但维护更贵、反馈也更慢。代价很清楚。实践中通常让开发集承担快速迭代，再定期更新独立集。自动 reward 方便扩大训练数据，人工偏好能够表达更细腻的语义，不过两者都得留下来源和授权记录。

OpenAI Evals 锁定提交里的 [`eval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py#L46-L85) 怎样抽象样本 Eval，属于**上游源码事实**。本仓库再让 RewardAdapter 把 Score 接到 DPO/GRPO/RFT，这一步属于**架构机制解释**，因为 OpenAI Evals 的这个文件并没有实现这里描述的训练适配器。

## 失败语义

- Judge uncertain 被强制转成负 reward：Adapter 语义无效，应拒绝导出。
- 同一客户的近重复样本跨训练与留出集：实体泄漏，Release Eval invalid。
- 训练循环根据留出结果多次调参：留出集转化为开发集，必须更换独立集。
- checkpoint 在开发集提升、独立 Gate 失败：有效的负面发布结论，不得用训练 reward 覆盖。
- Reward 很高但真实终态不满足：奖励黑客，需要环境事实 Scorer 和新回归样本。

## 动手实验

从 shipping 的 `report.json` 里挑出 failed Score，再顺着 observation_bundle_digest 找到金额 100 时的输出和 expected。然后画一张表，分别判断这条 Score 能不能转成 DPO 偏好对、GRPO 标量 reward 和独立发布 Score，最后把一条 unscorable Score 也放进来比较。

## 预期输出与答案

金额 100 的样本错得很明确，而且带有确定性 Reference，因此可以生成 chosen=`fee:0`、rejected=`fee:10`，也可以映射成 0 reward。不管最后选择哪种训练数据形式，都必须完整留下它从哪条 Score 转换而来。这个样本既然已经进入训练，就不能再给独立发布评测作证。unscorable 同样不能直接映射成失败 reward。这时不能判错。应该先把它标记 unavailable，修好观测链。独立发布 Score 必须来自一个新的 Trial，由冻结的 Candidate 在从未参与训练的 Dataset 上运行得到。

## 常见误解

把 Eval 分数直接当成 reward，会把评分粒度和状态都丢掉。只划分 train/test 也挡不住所有泄漏，因为同一实体的样本、近重复内容和反馈循环仍可能越过边界。Release Eval 做得晚，不等于天然独立，只要结果一直用来指导调参，这批数据实际上就成了开发集。它已经不再独立。RL 把 reward 提高，只能说明优化目标上的数字变了，不能直接证明产品在真实场景里更有效。

## 如何核对

随便挑一条训练样本，反查它原来的 Score、Bundle 和 Scorer 版本，并确认 RewardAdapter 给每一种状态都写了转换测试。还要检查 SplitManifest 是否按实体分组，确认独立集没有混进训练、prompt 选择或阈值调节。Reference Harness 目前只提供 Eval 证据，没有实现训练，这是特意守住的边界，并非遗漏。

## 与其他 Harness 的关系

主流 Eval Harness 通常负责运行评测、打分或接入 CI，训练框架则盯着怎样优化模型。两类系统接起来时，明确写出的 Adapter 比共享一个数据文件更重要，因为 Adapter 会告诉你每种评分含义究竟怎样变成训练信号。Agent Environment Harness 还能提供验证终态后得到的 reward，LLM-as-Judge Harness 则更依赖校准和人工仲裁。工具可以自由组合，但独立 Release Eval 必须保留只用于发布判断的 Dataset、运行记录和 Gate 血缘。

## 本篇不能证明什么

本篇没有实现 DPO、GRPO 或 RFT 训练，也没有声称哪种算法必然提升真实质量。这里规定的是怎样隔离证据：训练信号可以来自 Eval，但用于发布的结论必须来自训练之外的一次独立评测。这条线不能越过。

[上一章](06-uncertainty-comparison-gate.md) · [下一章](../learning-paths.md)
