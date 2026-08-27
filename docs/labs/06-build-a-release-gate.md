# 实验六：构建一个不会吞掉缺证的 Release Gate

[上一节](05-evaluate-an-agent-trace.md) · [下一节](../appendices/glossary.md)

## 本篇要解决什么问题

最后一个实验要把 Score 和 Metric 转成发布判断，并故意制造一份 unscorable evidence，观察缺证如何沿着 Gate 传播——目标并非得到一片绿色，而是确认 Gate 在证据不足时会拒绝通过，同时你还要为退款 Agent 增加一条不能被总体高分补偿的关键规则。

## 核心机制

![Gate 的资格检查与政策检查](../assets/diagrams/foundations/06-comparison-gate.svg)

Gate 在应用 threshold 之前，要先检查 evidence admissibility，包括 Trial 是否完整、Artifact 是否有效、Score 是否避开 invalid/unscorable/uncertain，以及错误率是否仍在预算内。只有证据具备判断资格，阈值比较才有意义，而 passed、failed、blocked、inconclusive 分别描述不同状态，如果全都压成一个布尔 success，缺证和不达标就会变得无法区分，这一步不能省。

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

GatePolicy 必须版本化，Metric denominator 必须来自原计划，而关键规则一旦 failed，就不能被其他普通项的高分补偿，invalid/unscorable 也不能进入 passed。重新执行 gate 只是在冻结 Score 上应用政策，不能修改原 Score，而 CI 退出码只负责传递成败信号，完整原因仍保存在 GateDecision 中。

## 动手实验

把 shipping minimum 从 1.0 降到 0.6，具体解释清楚 buggy 为什么会得到当前结果，然后把它恢复为 1.0，随后再为退款 Agent 写一个伪 Gate DAG：`evidence-valid → unauthorized-refund → overall-accuracy → release`，分别推演 ledger 缺失、发现越权退款和全部通过时的状态传播。

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

先看 buggy 的 2/3。当 minimum=0.6 时，0.667 的确超过了阈值，因此总体 Metric 会给出「通过」，但问题在于，漏掉的恰好是整个案例里金额 100 这个最该守住的边界样本。**总体阈值达标和关键行为正确是两回事**，所以真实政策应把这个 Sample 或规则设为 critical，让它具备单独否决发布的能力。Ledger 缺失时，前两个节点会进入 blocked 或 inconclusive，发现越权退款时，critical node 与 release 都会 failed，只有证据全部有效且满足阈值时才会 passed。

## 如何核对

阅读 [`gates.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/gates.py) 与 [`test_gates.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_gates.py)，确认所有状态分支有测试，并核对 regate.json 没有重写 report.json。

## 本篇不能证明什么

Gate 按规则完成运行，只能说明当前证据经过了当前版本政策的判断。至于规则是否合理、组织是否已经批准部署，以及生产配置是否与评测环境一致，都需要另外核验，而它给出的只是可追溯质量决定。

[上一节](05-evaluate-an-agent-trace.md) · [下一节](../appendices/glossary.md)
