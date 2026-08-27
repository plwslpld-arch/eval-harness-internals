# Eval-to-RL：评测信号怎样进入训练而不污染发布门禁

[上一节](07-quality-gates.md) · [下一节](../harnesses/lm-evaluation-harness/README.md)

## 本篇要解决什么问题

Eval Harness 算出 Score，收下 preference、failure trace 和人工反馈后，你可以把这些记录转成 Best-of-N、DPO（直接偏好优化）或 GRPO（组相对策略优化）所用的数据。

RFT（强化微调）同样可以使用评测器给出的奖励信号，但如果反复拿发布集和 Judge 去调模型，原来那次评测就不再独立。这条界线很硬。训练阶段要提供 reward，checkpoint 选择要挑出候选模型，Release Eval（发布评测）则要独立检验最终候选版本，如果三个环节共用一套未隔离的数据，你就不能再声称结果能够泛化。本篇会把 Release Eval 放在最后，再沿着 `Evaluator → RewardAdapter → 训练 → 独立 Release Eval` 一步步把链路接起来，并说清每一层把什么交给下一层。

继续往下读之前，你要先知道 Scorer、Metric、Gate 和 Judge 各自管什么，然后再判断 Harness 输出能不能直接变成 reward，以及 adapter 还必须补上哪些语义。读完本篇后，你还应该能够设计 holdout，让数据泄漏和 Goodhart 不容易混进最终结论。

## 核心机制

![Eval-to-RL 与独立发布评测](../assets/diagrams/foundations/07-eval-to-rl.svg)

Evaluator 产生 ObservationBundle 和 ScoreRecord 时会带上完整 lineage，RewardAdapter（奖励适配器）不能只从里面抽出 `score.value`，还必须说清哪些状态可用、unscorable/uncertain 怎样处理、值域和方向是什么、组件怎样加权、pair preference 怎样表示，并记下版本和防泄漏标签。训练系统拿到 adapter 输出后执行 SFT/DPO/GRPO/RFT，期间可以让 development evaluator 提供 reward，也可以用它选 checkpoint，但最终 candidate 必须回到从未参与调优的 release split，交给独立的 Release Eval 重新评测，再让 Gate 根据这次评测的证据判断能不能过。

不同算法吃的信号并不一样：Best-of-N 只要把同一 prompt 的多个候选排好序，DPO 则需要 chosen/rejected 成对出现，还要知道这个偏好有多可信，GRPO/RFT 通常还依赖可验证 reward 和同组采样。开放式 Judge reward 更容易被投机，所以还要加强校准和抗投机能力。缺了就要直说。某项能力如果还不具备，就标成 partial/unavailable，Adapter 不能凭空补出一份信号。

## 完整流程

1. Dataset 治理先划分 train/dev/release，按用户、时间、任务家族等泄漏边界分组，而不是随机打散相似样本。
2. Eval Harness 在 train/dev 上产生 Trial、Trace、Artifact 与 Score。RewardAdapter 验证 scorer identity 和状态，只转换合格记录。
3. 对 pair preference，保留共同 Sample、候选 identity、展示顺序和 margin。对 scalar reward，保留值域、组件和裁剪/归一化规则。
4. 训练算法更新模型。每个 checkpoint 保存训练数据/adapter/reward model 版本，避免只记录最终模型名。
5. Dev eval 用于调参和 checkpoint selection，因此其指标已受到选择偏差，不能再当最终无偏结论。
6. 选定 candidate 后冻结训练，运行独立 release eval。Release Dataset、Scorer/Judge 和 Gate 不向训练循环提供逐样本反馈。
7. Gate 比较 candidate/baseline，检查关键风险和不确定性。通过后才进入组织发布流程。
8. 生产 incident、用户反馈与新失败回流到未来数据，但先进入治理/标注/版本流程，不直接改写当前 release 结论。

## 关键数据与不变量

每条 RewardRecord 至少要能指回 trial_id、bundle digest、score_id 和 scorer/reward adapter version，同时记下值、状态、split 和用途，这样你才知道这份奖励从哪里来、准备用到哪里。训练可以使用 `passed/failed` 或连续 value，但不能默认把 invalid/unscorable 翻成 0，Release Sample ID 也不得进入训练日志或 prompt 调优日志。如果你看过 release 的失败样本后再去调 Judge prompt，这一轮 release 同样已被污染。

训练 reward 可以和 release metric 相关，但不应该让两者完全共用同一个来源，因为可验证的程序 reward 虽然不容易受主观判断影响，模型却可能钻它的漏洞，而 Judge reward 能够覆盖开放任务，却可能遭到 reward hacking。评估训练信号时，不能只相信同一把尺子。加上独立人工审查和多维关键 Gate，可以降低模型只顾着最大化单一 proxy 的风险。

## 动手实验

先用 shipping 的六条 Score 写一个 RewardAdapter，让 passed→1、failed→0，遇到其他状态就拒绝转换。然后列出它能够支持 Best-of-N 或监督筛选的部分，并解释为什么每个 Sample 只有一个输出时，还组不出 DPO pair。最后给退款 Agent 设计 chosen/rejected，在相同输入下放入「未授权退款」和「升级人工」两个候选，再说清 preference 从哪里来，以及安全项为什么不能由其他得分补偿。

```bash
uv run eval-harness-ref run reference/examples/refund-agent/eval.yaml --output output/refund-rl
uv run eval-harness-ref inspect output/refund-rl
```

## 预期输出与答案

Shipping Score 可以转成 scalar reward，但它没有记录同一 prompt 下多个候选彼此怎样排序，所以 DPO 能力应标成 unavailable，除非你另行采样并把 pair 记下来。在退款示例里，面对尚未获批的大额请求，应该把「升级人工」标为 chosen，把「未授权退款」标为 rejected。Scorer 如果是 unscorable，或者 Judge 报错，Adapter 就要拒绝这条记录，不能擅自把它当成负样本。

一旦拿 Dev 集挑选 checkpoint，你的选择过程就已经影响了这批数据，不能再把它当作独立 release 证据来报告。到了这一步，就别再把用过的 Dev 集当成新数据。最后的 Gate 必须在已隔离的 release split 上运行，同时保留 Baseline 配对和关键安全检查。

## 如何核对

先对照 [基础篇 Eval-to-RL](../foundations/07-eval-to-rl-and-release-eval.md) 看各个环节由谁负责，再去 [`models.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/models.py) 里检查 RewardAdapter 需要引用哪些 lineage 字段，最后运行退款案例，看现有 Score 状态能不能支持这次转换。

## 本篇不能证明什么

即使隔离了数据，也用 RewardAdapter 和独立 Gate 分开了训练与发布，你仍然不能据此保证训练一定稳定、算法一定收敛、reward 没有漏洞，或线上长期不会漂移。这些机制能减少明显的泄漏和证据混用，训练和生产还得分别做专项验证。

[上一节](07-quality-gates.md) · [下一节](../harnesses/lm-evaluation-harness/README.md)
