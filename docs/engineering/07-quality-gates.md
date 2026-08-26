# Quality Gate：把证据转成三态/四态决定

[上一节](06-agent-environments.md) · [下一节](08-eval-to-rl.md)

## 本篇要解决什么问题

CI 常把“平均分大于阈值”直接当成 release gate，但这个平均值可能来自不完整的分母或无效 Judge，也可能掩盖关键安全项失败，甚至根本无法与 Baseline 比较。因此，Gate 的责任不是再算一次分，而是验证证据资格、应用预声明政策，并给出可追溯的决定。本篇会解释 passed、failed、blocked、inconclusive 四种状态，也会说明为什么其他项目分数再高，也不能补偿 critical risk。

读完后，你应该能够从 Score/Metric/Comparison 出发设计 Gate DAG，分清产品失败、评测阻断和证据不足，并让 CI 退出码保留比红绿灯更丰富的机器可读原因。

## 核心机制

![从 Metric 与证据到 Gate Decision](../assets/diagrams/foundations/06-comparison-gate.svg)

Gate 分为两个阶段，先做 admissibility checks，再做 policy checks。资格检查会核对计划完整性、身份一致、Artifact 摘要、Scorer 有效性、错误或缺失阈值以及比较配对，只要关键证据处于 invalid，就不能得到 passed。通过资格检查后，政策检查才会比较 minimum pass rate、non-inferiority margin、成本、延迟和关键场景，而 Reference Harness 的 `evaluate_gate` 给出了最小版本——只要 critical scores 包含 invalid/unscorable/uncertain，就返回 inconclusive，只有有效 Metric 才能继续与 threshold 比较。

真实 Gate 可以组织成一张 DAG，依次检查数据完整性、Harness 健康、核心质量、安全或隐私非补偿、Candidate vs Baseline 与发布范围，并让每个节点输出 status、reason 和 evidence IDs。只要上游处于 blocked，下游就不能手工把它改写成 passed。

## 完整流程

1. 在实验前定义 GatePolicy version：指标、阈值、margin、最小样本、允许 error rate、关键任务集合与非补偿规则。
2. 运行后验证计划 Trial 都有明确 outcome，Artifact/Trace/identity 有效，Scorer/Judge 校准版本符合政策。
3. 将 product failed 与 Harness error 分开统计。超过错误预算时 Gate blocked/inconclusive，不从分母删除。
4. 计算 Metric 和 Comparison，附带 denominator、区间、pair_count 与缺失。只接受预注册主分析。
5. 先执行 critical checks。安全、ACL、不可逆副作用等失败直接 failed，不允许普通准确率抵消。
6. 执行总体阈值、non-inferiority 与成本/延迟检查。部分范围发布必须有不扩张的机器可执行 scope。
7. GateDecision 保存 gate_id、policy version、status、metric/evidence IDs 和 reason。人类 waiver 只能按规则临时处理可豁免项，不能重写原 Gate。
8. CI 根据状态返回退出码并发布完整报告。生产发布仍需组织授权，Gate 结果不是部署动作本身。

## 关键数据与不变量

`GateStatus={passed, failed, blocked, inconclusive}`。其中 failed 表示有效证据违反了政策，blocked 表示预声明条件尚未满足，而 inconclusive 表示现有证据不足以支持任一方向。只有所有关键前置都有效，状态才能成为 passed，同时 GateDecision 必须引用 Metric/Score/Comparison，不能把散落的日志文本当作唯一证据。

阈值属于特定政策版本，只要测量合同没有变化，重新 gate 时就可以复用冻结的 Score/Metric，但一旦 Dataset、Scorer 或 Sample 集发生改变，相关上游就必须重新运行。Waiver 需要保存 owner、理由、范围、到期时间和非豁免风险，而且不能删除原始失败记录。

## 动手实验

运行 shipping 并重新门禁：

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/gate
uv run eval-harness-ref gate output/gate
uv run pytest tests/test_gates.py -q
```

把 minimum 从 1.0 改为 0.6 后，讨论 buggy 为什么可能在数学上通过，但业务边界错误仍然不该自动发布。接着构造一个 ScoreStatus.UNSCORABLE，观察 Gate 能否进入 passed，最后再为退款 Agent 写一条 critical policy，要求未授权大额退款必须为 0 次。

## 预期输出与答案

在原配置下，fixed 会 passed，buggy 会 failed。仅降低总体阈值会让取得 2/3 的 buggy 达标，但金额 100 的边界可能属于关键合同，所以应该把它单列为 noncompensatory check，不能让另外两条普通样本补偿。UNSCORABLE 的关键证据应让 Gate 进入 inconclusive，而退款 Agent 只要出现任一有效的未授权大额退款失败，critical gate 就应直接 failed。如果该样本的环境根本没有跑起来，结果只能是 blocked/inconclusive，而不是 passed。

## 如何核对

先阅读 [`gates.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/gates.py)、[`models.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/models.py) 中的 Gate 状态和 [`test_gates.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_gates.py)，然后打开报告，验证 gate.metric_ids 能否回到对应的 Metric 与 Score。

## 本篇不能证明什么

即使 GatePolicy 执行正确，也不能证明阈值合理、指标会与业务长期一致，或组织已经授权发布，因为它自动化的只是已声明政策与证据检查。政策本身仍然需要治理、复审和生产反馈。

[上一节](06-agent-environments.md) · [下一节](08-eval-to-rl.md)
