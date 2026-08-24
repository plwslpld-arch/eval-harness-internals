# 实验一：运行一份确定性 Eval

[上一节](../cases/contract-review-agent.md) · [下一节](02-add-a-target-adapter.md)

## 本篇要解决什么问题

第一次动手不接模型 API，而是完整跑通 Dataset → Trial → Attempt → Artifact → Score → Metric → Gate。这样任何失败都能在本地复现，不会被网络、额度或模型漂移掩盖。你将运行运费案例，并从报告反向追一条失败证据。

## 核心机制

![确定性 Eval 的最小闭环](../assets/diagrams/foundations/02-eval-spec-flow.svg)

配置先固定两个 Target 和三个 Sample；Planner 生成六个 Trial；本地脚本输出 fee；Scorer 比较 expected；Gate 要求 100%。输出目录是一次 Run 的证据根，后续 inspect/score/gate 都只消费它。

## 完整流程

1. 在仓库根目录确认 Python 3.12 与 uv 可用。
2. 运行案例到新的输出目录，不复用旧 Run。
3. 执行 inspect，记录 Trial、Bundle 与 Score 数量。
4. 打开 evidence.json，找到 `amount-100` + `buggy` Trial。
5. 沿 canonical Attempt、Bundle、Score、Metric 到 Gate 写出链路。
6. 对照 Dataset 和脚本手算 fee。

```bash
uv sync
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/lab-01
uv run eval-harness-ref inspect output/lab-01
```

## 关键数据与不变量

计划 Trial 数必须是 6；每个完成 Trial 只有一个 canonical Attempt；Artifact digest 与 bytes 匹配；两个 Target 的 Metric denominator 各为 3；Score failed 与 Attempt succeeded 可以同时成立，因为执行成功不等于产品通过。

## 动手实验

把 `output/lab-01/artifacts` 中任意文件追加一个字符，再运行：

```bash
uv run eval-harness-ref inspect output/lab-01
```

不要修报告，先解释失败发生在证据、评分还是 Gate 层。

## 预期输出与答案

首次运行输出 buggy failed、fixed passed；inspect 显示计划 6、Bundle 6、Score 6。金额 100 的 buggy Attempt 是 succeeded/canonical，但 Score failed。篡改后 inspect 报 Artifact 摘要不一致，这是证据完整性失败；旧 HTML 仍在也不能作为有效结论。

## 如何核对

```bash
uv run pytest tests/test_shipping_e2e.py tests/test_cli.py -q
```

检查测试对 Gate、分母、报告和 Trace 文件数量的断言。

## 本篇不能证明什么

本实验不运行真实模型、容器或生产计价服务，只证明本地 Fixture 和 Reference Harness 的声明行为。

[上一节](../cases/contract-review-agent.md) · [下一节](02-add-a-target-adapter.md)
