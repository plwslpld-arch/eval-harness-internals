# 从这里开始：第一次把 Eval 跑成完整证据链

[返回目录](contents.md) · [进入第一章](foundations/01-agent-vs-eval-harness.md)

## 这套教材回答什么

你可能已经会调用模型、写几条测试样本，甚至能得到一个准确率。但一个可信 Eval Harness 还要回答：测的是哪个系统版本？哪些 Sample 在运行前进入计划？超时重试有没有把失败洗掉？Scorer 看了什么证据？分母为什么是这个数？Candidate 相对 Baseline 的差异有多稳定？缺证据时 Gate 为什么没有通过？

本仓库从这些问题出发，把一次评测拆成下面的对象链：

```text
EvaluationSpec
  → Sample × Target × Repetition
  → Trial
  → Attempt
  → TraceEvent / Artifact
  → ObservationBundle
  → ScoreRecord
  → MetricEstimate / Comparison
  → GateDecision / Report
```

先不要背类名。每读到一个对象，都问它为哪种错误负责、身份在何处固定、后续怎样反向核对。

## 贯穿全书的第一个问题

规则规定：订单金额达到 100 元时免运费。buggy 程序写成 `amount > 100`，fixed 程序写成 `amount >= 100`。Dataset 有金额 99、100、101 三个 Sample。对两个 Target 各执行一次，所以运行前就有 6 个 Trial。

金额 100 的 buggy Trial 会正常返回一个错误答案。这不是基础设施失败：Trial completed、Attempt succeeded/canonical、Score failed、Metric 2/3、Gate failed。这个分层是整套教材的起点。

## 第一次运行

安装 Python 3.12 和 `uv`，然后执行：

```bash
uv sync --frozen
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/shipping
uv run eval-harness-ref inspect output/shipping
```

依次查看：

1. `output/shipping/run.json`：每个 Trial 有几个 Attempt，哪个是 canonical；
2. `output/shipping/traces/`：事件怎样按因果顺序写入 JSONL；
3. `output/shipping/artifacts/`：输出字节怎样按 SHA-256 内容寻址；
4. `output/shipping/evidence.json`：Observation Bundle 怎样冻结评分输入；
5. `output/shipping/report.json`：Score、Metric 和 Gate 怎样保留引用。

再运行 `score` 和 `gate`。它们不会重跑 Target，而是从冻结证据重算，分别写出 `rescore.json` 与 `regate.json`。如果重算改变结果，应先检查证据或 Scorer 身份，而不是挑一个更好看的报告。

## 阅读约定

- Python 标识符和上游项目名称保留英文，首次出现给出中文解释；
- “源码事实”必须落到锁定 commit 的永久链接；
- 跨多个调用点重建的责任边界标为“机制解释”；
- 本仓库缩小的伪代码和 Reference Harness 标为“教学简化”；
- 公开源码不足时明确写“不可核对”，不猜闭源内部实现；
- 每篇核心课都给实验、预期输出和答案，你不需要等待逐题互动才能继续。

## 接下来怎么走

如果你是第一次系统学习，从[Agent Harness 与 Eval Harness](foundations/01-agent-vs-eval-harness.md)开始按顺序读七篇基础课。已经做过评测工程的读者可以去[学习路线](learning-paths.md)选择源码、Agent 环境或 Eval-to-RL 路径。
