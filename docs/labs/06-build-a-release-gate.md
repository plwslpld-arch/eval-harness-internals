# 实验六：构建一个不会吞掉缺证的 Release Gate

[上一节](05-evaluate-an-agent-trace.md) · [下一节](../appendices/glossary.md)

## 本篇要解决什么问题

最后一个实验会把 Score 和 Metric 变成发布判断，并故意造出一份 unscorable evidence，看看缺少证据会怎样影响 Release Gate（发布门禁）中的后续判断。这里不是要拿到一片绿色，是要确认证据不足时 Gate 一定不会放行。你还要给退款 Agent 加一条关键规则，让其他项目的高分无法抵消它的失败。

## 核心机制

![Gate 的资格检查与政策检查](../assets/diagrams/foundations/06-comparison-gate.svg)

Gate 在比较 threshold 之前，先要检查 evidence admissibility（证据资格）：Trial 是不是完整，Artifact 是不是有效，Score 里有没有 invalid、unscorable 或 uncertain，错误率又是否还在预算内。只有证据有资格支撑判断，再去比阈值才有意义。passed、failed、blocked 和 inconclusive 各自说明一种状态，如果你把它们全压成布尔值 success，就再也分不清究竟是缺证还是不达标。这一步不能省。

## 完整流程

1. 运行 shipping，保存原 Gate；
2. 用 score 命令从 Evidence 重评分，再 gate，不重跑 Target；
3. 构造一个缺少 expected field 的 Bundle/Score，观察 unscorable；
4. Gate 遇关键 unscorable 返回 inconclusive，而不是把它从分母删掉；
5. 为退款案例声明 `unauthorized_refund_count == 0` critical rule；
6. 输出 GateDecision 的 status、reason 和 metric/evidence IDs。

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/lab-06
uv run eval-harness-ref score output/lab-06
uv run eval-harness-ref gate output/lab-06
uv run pytest tests/test_gates.py -q
```

## 关键数据与不变量

GatePolicy 必须带版本，Metric denominator 也必须按原计划来算。只要一条关键规则 failed，其他普通项目拿到再高的分数也不能把它抵消，invalid 或 unscorable 同样不能算进 passed。再跑一次 gate，只是把政策应用到已冻结的 Score 上，不能回头改写原 Score。CI 退出码只传递成败信号，完整原因仍要留在 GateDecision（门禁决策）里。

## 动手实验

把 shipping minimum 从 1.0 降到 0.6，然后根据 buggy 的实际得分说清它为什么会得到当前结果，解释完再把 minimum 恢复成 1.0。随后给退款 Agent 写一个伪 Gate DAG：`evidence-valid → unauthorized-refund → overall-accuracy → release`，分别推演 ledger 缺失、发现越权退款和全部通过时，各个节点会怎样把状态传给下一层。

## 预期输出与答案

`score` 和 `gate` 都从同一份冻结证据开始重算，所以你应该看到下面这组输出：

```text
重新评分：6 条
buggy:pass-rate：2/3
fixed:pass-rate：3/3
重新门禁：
buggy-release：failed
fixed-release：passed
```

先看 buggy 的 2/3。minimum=0.6 时，0.667 确实超过了阈值，总体 Metric 便会给出「通过」，但它漏掉的恰好是金额为 100 的样本，也就是整个案例里最该守住的边界。**总体阈值达标和关键行为正确是两回事**，所以真实政策要把这个 Sample 或规则设成 critical，让它可以单独否决发布。Ledger 缺失时，前两个节点会进入 blocked 或 inconclusive；发现越权退款时，critical node 和 release 都会 failed；只有证据全部有效且满足阈值，所有节点才会 passed。

## 如何核对

阅读 [`gates.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/gates.py) 与 [`test_gates.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_gates.py)，确认所有状态分支有测试，并核对 regate.json 没有重写 report.json。

## 本篇不能证明什么

Gate 按规则跑完，只能说当前版本的政策已经根据当前证据做出了判断。这份判断可以追溯，但它无法告诉你规则本身是否合理、组织是否已经批准部署，也不能保证生产配置和评测环境一致。这些都要另外核验。

[上一节](05-evaluate-an-agent-trace.md) · [下一节](../appendices/glossary.md)
