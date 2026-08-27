# 从这里开始：第一次把 Eval 跑成完整证据链

[返回目录](contents.md) · [进入第一章](foundations/01-agent-vs-eval-harness.md)

## 这套教材回答什么

你可能已经会调模型、写测试样本，甚至跑出了一个准确率，但要让 Eval Harness 产生可信的结果，你还得追问：到底测了哪个系统版本，运行前把哪些 Sample 排进了计划，超时重试是否掩盖了失败，Scorer 看到了哪些证据，分母怎么算出来，Candidate 和 Baseline 的差异稳不稳定，以及证据不够时 Gate 为什么不能放行？

为了把这些问题逐一落到可检查的记录上，本仓库把一次评测拆成下面这条对象链，并规定每个对象管哪一段、留什么记录。

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

先别急着背类名。读到任何一个对象时，你都可以顺着三个问题往下查：它要处理哪类错误，身份在哪里定下来，后面的环节又怎样倒查回来。

## 贯穿全书的第一个问题

规则说订单满 100 元就免运费，buggy 程序却写成 `amount > 100`，fixed 程序则写成 `amount >= 100`。把 99、100、101 元这三个 Sample 分别交给两个 Target 跑一遍，你在运行前就能确定会产生 6 个 Trial。

金额为 100 元的 buggy Trial 虽然把进程正常跑完了，答案却是错的，所以记录中会同时出现 Trial completed、Attempt succeeded/canonical、Score failed、Metric 2/3 和 Gate failed。这些状态并不冲突。你先把它们分清，后面查证据链时才不会搅在一起。

## 第一次运行

准备好 Python 3.12 和 `uv` 以后，直接执行下面这组命令，不用提供模型凭据，也能稳定地复现同一份运行结果。

```bash
uv sync --frozen
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/shipping
uv run eval-harness-ref inspect output/shipping
```

接着依次查看以下文件。

1. `output/shipping/run.json`：每个 Trial 有几个 Attempt，哪个是 canonical；
2. `output/shipping/traces/`：事件怎样按因果顺序写入 JSONL；
3. `output/shipping/artifacts/`：输出字节怎样按 SHA-256 内容寻址；
4. `output/shipping/evidence.json`：Observation Bundle 怎样冻结评分输入；
5. `output/shipping/report.json`：Score、Metric 和 Gate 怎样保留引用。

后面再跑 `score` 和 `gate` 时，程序不会重跑 Target，只会读取已经冻结的证据并重新计算，然后分别写出 `rescore.json` 和 `regate.json`。如果重算后的结果变了，先去核对证据和 Scorer 的身份，别从几份报告里挑一个更好看的数字。

## 阅读约定

- Python 标识符和上游项目名称保留英文，首次出现给出中文解释；
- 「源码事实」必须落到锁定 commit 的永久链接；
- 跨多个调用点重建的责任边界标为「机制解释」；
- 本仓库缩小的伪代码和 Reference Harness 标为「教学简化」；
- 公开源码不足时明确写「不可核对」，不猜闭源内部实现；
- 每篇核心课都给实验、预期输出和答案，你不需要等待逐题互动才能继续。

## 接下来怎么走

如果你是第一次系统学评测，可以从[Agent Harness 与 Eval Harness](foundations/01-agent-vs-eval-harness.md) 起步，按顺序读完七篇基础课。如果你已经做过评测工程，就直接打开[学习路线](learning-paths.md)，按手头遇到的问题选源码、Agent 环境或 Eval-to-RL 路径。
