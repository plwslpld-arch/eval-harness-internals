# 实验六：构建一个不会吞掉缺证的 Release Gate

[上一节](05-evaluate-an-agent-trace.md) · [下一节](../appendices/glossary.md)

## 本篇要解决什么问题

最后一个实验把 Score 和 Metric 转成发布判断，并故意制造 unscorable evidence。目标不是得到绿色，而是确认 Gate 在证据不足时拒绝通过。你还将为退款 Agent 增加一条非补偿关键规则。

## 核心机制

![Gate 的资格检查与政策检查](../assets/diagrams/foundations/06-comparison-gate.svg)

Gate 先验证 evidence admissibility：Trial 完整、Artifact 有效、Score 不为 invalid/unscorable/uncertain、错误率在预算内；再应用 threshold。passed、failed、blocked、inconclusive 各有不同含义，不能都映射成一个布尔 success。

## 完整流程

1. 运行 shipping，保存原 Gate。
2. 用 score 命令从 Evidence 重评分，再 gate，不重跑 Target。
3. 构造一个缺少 expected field 的 Bundle/Score，观察 unscorable。
4. Gate 遇关键 unscorable 返回 inconclusive，而不是把它从分母删掉。
5. 为退款案例声明 `unauthorized_refund_count == 0` critical rule。
6. 输出 GateDecision 的 status、reason 和 metric/evidence IDs。

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/lab-06
uv run eval-harness-ref score output/lab-06
uv run eval-harness-ref gate output/lab-06
uv run pytest tests/test_gates.py -q
```

## 关键数据与不变量

GatePolicy 版本化；Metric denominator 来自计划；关键 failed 不可被普通高分补偿；invalid/unscorable 不能 passed；重新 gate 不修改原 Score。CI 退出码只是 transport，完整原因在 GateDecision。

## 动手实验

把 shipping minimum 从 1.0 降到 0.6，解释 buggy 的结果；再恢复 1.0。为退款 Agent 写伪 Gate DAG：`evidence-valid → unauthorized-refund → overall-accuracy → release`，分别给 ledger 缺失、发现越权退款和全部通过三种状态传播。

## 预期输出与答案

`score` 与 `gate` 从同一份冻结证据重算，输出应当是：

```text
重新评分：6 条
buggy:pass-rate：2/3
fixed:pass-rate：3/3
重新门禁：
buggy-release：failed
fixed-release：passed
```

注意 buggy 的 2/3。minimum=0.6 时这个数字是达标的——0.667 大于 0.6，
总体 Metric 说「通过」。但漏掉的恰好是金额 100 那个边界样本，也就是整个案例
最该守住的一条。**总体阈值达标和关键行为正确是两回事**，所以真实政策应当把
这个 Sample 或规则设成 critical，让它单独一票否决。Ledger 缺失使第一/第二节点 blocked 或 inconclusive；发现越权退款使 critical node 与 release failed；全部有效且满足阈值才 passed。

## 如何核对

阅读 [`gates.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/gates.py) 与 [`test_gates.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_gates.py)，确认所有状态分支有测试。核对 regate.json 没有重写 report.json。

## 本篇不能证明什么

Gate 按规则运行不表示规则合理、组织已批准部署或生产配置一致。它只给出可追溯质量决定。

[上一节](05-evaluate-an-agent-trace.md) · [下一节](../appendices/glossary.md)
