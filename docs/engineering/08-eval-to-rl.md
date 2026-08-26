# Eval-to-RL：评测信号怎样进入训练而不污染发布门禁

[上一节](07-quality-gates.md) · [下一节](../harnesses/lm-evaluation-harness/README.md)

## 本篇要解决什么问题

Eval Harness 产出的 Score、preference、failure trace 和人工反馈可以转化为 Best-of-N、DPO、GRPO 或 RFT 数据，但一旦反复使用发布集和 Judge 来优化模型，原来的评测就失去了独立性。训练 reward、checkpoint 选择与 release eval 分别承担不同责任，如果三者共享同一套未隔离数据，就不能再声称结果能够泛化。本篇将建立 `Evaluator → RewardAdapter → 训练 → 独立 Release Eval` 的闭环。

在继续之前，你需要了解 Scorer、Metric、Gate 和 Judge，而读完本篇后，应该能够判断 Harness 输出能否直接转成 reward、还缺少哪些 adapter 语义，并设计用于防止数据泄漏与 Goodhart 的 holdout。

## 核心机制

![Eval-to-RL 与独立发布评测](../assets/diagrams/foundations/07-eval-to-rl.svg)

Evaluator 会产生带完整 lineage 的 ObservationBundle 与 ScoreRecord，而 RewardAdapter 不能只是取出 `score.value`，它还要声明哪些状态可用、怎样处理 unscorable/uncertain、值域与方向、组件权重、pair preference、版本和防泄漏标签。训练系统消费 adapter 输出并执行 SFT/DPO/GRPO/RFT，训练期间可以用 development evaluator 提供 reward 和完成 checkpoint selection，但最终 candidate 必须回到从未参与优化的 release split 与独立 Gate 上接受评测。

不同算法需要的信号并不相同，因为 Best-of-N 只需要给同一 prompt 的多个候选排序，而 DPO 需要 chosen/rejected 对与偏好可信度，GRPO/RFT 则常常依赖可验证 reward 和同组采样。开放式 Judge reward 还需要更强的抗投机能力和校准。如果某项能力缺失，就应标记为 partial/unavailable——Adapter 不能凭空编造它。

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

RewardRecord 至少要引用 trial_id、bundle digest、score_id、scorer/reward adapter version、值、状态、split 和用途。训练可以消费 `passed/failed` 或连续 value，但 invalid/unscorable 不能默认转换为 0，同时 Release Sample ID 也不能出现在训练与 prompt 调优日志里。如果根据 release 失败样本调整 Judge prompt，同样会造成污染。

训练 reward 与 release metric 可以相关，却不应完全来自同一个来源，因为可验证程序 reward 虽然能抵抗主观漂移，却可能被模型利用漏洞，而 Judge reward 虽然覆盖开放任务，却可能遭到 reward hacking。独立人工审查与多维关键 Gate 可以降低模型只会最大化单一 proxy 的风险。

## 动手实验

用 shipping 的六条 Score 设计一个 RewardAdapter，其中 passed→1、failed→0，其他状态一律拒绝。接着写出它能够支持 Best-of-N 或监督筛选的部分，并解释为什么每个 Sample 只有一个输出时无法构造 DPO pair。最后为退款 Agent 设计 chosen/rejected，在固定输入下分别给出未授权退款和升级人工两个候选，并声明 preference 来源与安全非补偿规则。

```bash
uv run eval-harness-ref run reference/examples/refund-agent/eval.yaml --output output/refund-rl
uv run eval-harness-ref inspect output/refund-rl
```

## 预期输出与答案

Shipping Score 可以形成 scalar reward，但它没有同一 prompt 下多个候选之间的关系，所以 DPO 能力应为 unavailable，除非另行采样并记录 pair。在退款示例中，面对未获批准的大额请求，升级人工是 chosen，未授权退款是 rejected。如果 Scorer 处于 unscorable 或 Judge error，Adapter 应拒绝该记录，不能把它当成负样本。

Dev 集一旦用于选择 checkpoint，就已经受到选择过程影响，因此不能再作为独立 release 证据来报告，而最终 Gate 必须运行在隔离的 release split 上，并保留 Baseline 配对与关键安全检查。

## 如何核对

先从 [基础篇 Eval-to-RL](../foundations/07-eval-to-rl-and-release-eval.md) 核对责任划分，再用 [`models.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/models.py) 检查 RewardAdapter 应引用的 lineage 字段，最后运行退款案例，查看现有 Score 状态是否足以完成转换。

## 本篇不能证明什么

数据隔离、RewardAdapter 和独立 Gate 无法保证训练稳定、算法收敛、reward 没有漏洞，或线上长期不会漂移，因为这些机制只能减少明显的泄漏与证据混用。训练与生产仍需专项验证。

[上一节](07-quality-gates.md) · [下一节](../harnesses/lm-evaluation-harness/README.md)
