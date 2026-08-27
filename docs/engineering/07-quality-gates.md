# Quality Gate：把证据转成三态/四态决定

[上一节](06-agent-environments.md) · [下一节](08-eval-to-rl.md)

## 本篇要解决什么问题

CI 常把「平均分超过阈值」直接当成 release gate，但这个平均分可能漏了一部分应跑的样本，可能由无效 Judge 算出，还可能把关键安全失败藏在总体分数里，甚至根本对不上 Baseline。所以 Gate（门禁）不该再把分数重算一遍，它要先判断证据能不能用，再按预先声明的政策判断结果，而且每一步都得能追回原证据。本篇会分清 passed、failed、blocked 和 inconclusive 这四种状态，也会看看为什么其他项目得分再高，都不能抵消 critical risk。

读完后，你应该能拿着 Score/Metric/Comparison 画出 Gate DAG，看懂产品何时确实失败、评测何时被条件阻断，以及现有证据何时还不足以下结论。不要只留红绿灯，CI 退出时还要把具体原因以机器可读的方式保留下来，供后面的系统继续判断。

## 核心机制

![从 Metric 与证据到 Gate Decision](../assets/diagrams/foundations/06-comparison-gate.svg)

Gate 判断这批证据时分两步走，先做 admissibility checks 来检查证据资格，再做 policy checks，顺序不能反过来。第一步要查计划是否完整、身份能否对上、Artifact 有没有摘要、Scorer 是否有效、错误和缺失是否超过阈值，还要检查比较双方能不能配成对，只要关键证据是 invalid，就不能返回 passed。证据过关后，第二步才去比较 minimum pass rate、non-inferiority margin、成本、延迟和关键场景。Reference Harness 里的 `evaluate_gate` 只实现了最小规则：critical scores 只要出现 invalid/unscorable/uncertain，它就返回 inconclusive，只有效 Metric 才能拿去和 threshold 比较。

真正用于发布的 Gate 可以画成一张 DAG，让节点依次检查数据是否齐全、Harness 是否健康、核心质量是否过关、安全或隐私风险能否补偿、Candidate 和 Baseline 比起来怎样，最后再限定发布范围。每个节点都要输出 status、reason 和 evidence IDs。上游只要还是 blocked，下游就不得手工把它改成 passed。

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

`GateStatus={passed, failed, blocked, inconclusive}` 中，failed 表示有效证据已经证明结果违反政策，blocked 表示预先声明的条件还没满足，inconclusive 则表示现有证据还支持不了任何一个方向。先把这三种分清。只有所有关键前置都有效时，状态才能成为 passed，而 GateDecision 必须引用 Metric/Score/Comparison，不能只拿几段散落的日志当证据。

每个阈值都跟着某个具体政策版本，如果测量合同没变，重新执行 gate 时可以直接复用已经冻结的 Score/Metric，但 Dataset、Scorer 或 Sample 集只要变了，相关上游就必须重跑。别复用错了。Waiver 也要写明 owner、理由、范围、到期时间和不得豁免的风险，同时保留原始失败记录。

## 动手实验

运行 shipping 并重新门禁：

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/gate
uv run eval-harness-ref gate output/gate
uv run pytest tests/test_gates.py -q
```

先把 minimum 从 1.0 改成 0.6，然后解释 buggy 为什么能在数学上达标，但仍然不能带着业务边界错误自动发布。再构造一个 ScoreStatus.UNSCORABLE，看 Gate 还能不能进入 passed，最后给退款 Agent 写一条 critical policy，明确要求未授权大额退款必须保持 0 次。

## 预期输出与答案

使用原配置时，fixed 会 passed，buggy 会 failed。只降低总体阈值，得到 2/3 的 buggy 就能达标，但金额 100 的边界可能是关键合同，所以你要把它单独列成 noncompensatory check，不让另两条普通样本抵消这一条失败。关键证据如果是 UNSCORABLE，Gate 应进入 inconclusive，而退款 Agent 只要确实发生一次有效的未授权大额退款，critical gate 就应直接 failed。可要是该样本的环境根本没跑起来，你只能得到 blocked/inconclusive，不能把它判成 passed。

## 如何核对

先阅读 [`gates.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/gates.py)、[`models.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/models.py) 里的 Gate 状态和 [`test_gates.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_gates.py)，再打开报告，从 gate.metric_ids 往回查，看每个 ID 能不能找到相应的 Metric 和 Score。

## 本篇不能证明什么

就算 GatePolicy 一丝不差地执行了已声明的政策，它也证明不了阈值设得合理，证明不了指标会长期跟业务保持一致，更不代表组织已经授权发布。这不是发布指令。政策还得持续治理和复审，也要接受生产反馈。

[上一节](06-agent-environments.md) · [下一节](08-eval-to-rl.md)
