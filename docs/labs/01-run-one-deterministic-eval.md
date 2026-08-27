# 实验一：运行一份确定性 Eval

[上一节](../cases/contract-review-agent.md) · [下一节](02-add-a-target-adapter.md)

## 本篇要解决什么问题

第一次动手先不接模型 API，你要从 Dataset（数据集）一直跑到 Trial（试验）、Attempt、Artifact、Score、Metric 和 Gate，把整条路走通。这样哪一步出错，你都能在本地稳定复现，不会让网络、额度或模型漂移把问题盖住。先跑运费案例，然后打开报告，从结论倒着查回产生这次失败的整条证据链。

## 核心机制

![确定性 Eval 的最小闭环](../assets/diagrams/foundations/02-eval-spec-flow.svg)

配置先把两个 Target 和三个 Sample 定下来，Planner 再据此建出六个 Trial，本地脚本逐个算出 fee，最后由 Scorer（评分器）拿它和 expected 比较。Gate 要求所有样本都通过。一次 Run 用到的根证据全部放在输出目录里，后面跑 inspect、score 或 gate 时都只读这份目录，所以你能沿同一条证据链把每个结论查回去。

## 完整流程

1. 在仓库根目录确认 Python 3.12 与 uv 可用；
2. 运行案例到新的输出目录，不复用旧 Run；
3. 执行 inspect，记录 Trial、Bundle 与 Score 数量；
4. 打开 evidence.json，找到 `amount-100` + `buggy` Trial；
5. 沿 canonical Attempt、Bundle、Score、Metric 到 Gate 写出链路；
6. 对照 Dataset 和脚本手算 fee。

```bash
uv sync
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/lab-01
uv run eval-harness-ref inspect output/lab-01
```

## 关键数据与不变量

计划里必须有 6 个 Trial，每个完成的 Trial 只能选定一个 canonical Attempt，Artifact（产物）的 digest 也必须和实际 bytes 对得上。两个 Target 各有 3 个 Metric denominator。Score failed 和 Attempt succeeded 可以同时出现：前者说产品结果没过关，后者只说程序顺利跑完了。这两件事不能混。

## 动手实验

从 `output/lab-01/artifacts` 中任选一个 Artifact 文件，在末尾追加一个字符，然后运行下面的检查命令。

```bash
uv run eval-harness-ref inspect output/lab-01
```

先别修报告，你要先说清楚问题究竟出在证据、评分还是 Gate 这一层。

## 预期输出与答案

第一次运行时，程序会打印报告路径，同时告诉你两个 Target 分别得到了什么结论。

```text
评测报告：output/lab-01/report.html
buggy-release：failed
fixed-release：passed
```

`inspect` 仍然读同一份证据目录，所以下面每个数字都必须能在目录里找到对应的证据。

```text
评测：shipping-boundary
计划 Trial：6
Observation Bundle：6
评分记录：6
buggy-release：failed
fixed-release：passed
```

计划里有 6 个 Trial，最后也收到 6 个 Bundle 和 6 条 Score。这三个数字对得上，说明每个 Trial 都留下了一份供 Scorer 复核的证据，中间没丢。金额为 100 的 buggy Trial 已经跑成 succeeded/canonical，对应的 Score 却仍是 failed，因为程序跑完只能说执行没出问题，不能说计算结果符合规则。报告会把这两层分开记。

篡改 Artifact 后再 `inspect`，会直接拒绝出结论。

```text
错误：运行证据无效：Artifact 摘要不一致：artifacts/ae82e58adceaf5a6…
```

这里程序报的是「运行证据无效」，不是「评分失败」，因为它在证据层就发现了问题，还根本没有进入评分。旧的 report.html 虽然还在原输出目录里，但它已经撑不起任何有效结论，因为报告是从证据推出来的，底层证据一改，原报告也就失效了。

## 如何核对

```bash
uv run pytest tests/test_shipping_e2e.py tests/test_cli.py -q
```

检查测试里的断言，看它们怎么核对 Gate、分母、报告和 Trace 文件的数量。

## 本篇不能证明什么

本实验没有运行真实模型、容器或生产计价服务，所以它只能证明本地 Fixture（测试夹具）和 Reference Harness 按声明的方式运行。

[上一节](../cases/contract-review-agent.md) · [下一节](02-add-a-target-adapter.md)
