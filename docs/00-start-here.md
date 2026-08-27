# 从这里开始：第一次把 Eval 跑成完整证据链

[返回目录](contents.md) · [进入第一章](foundations/01-agent-vs-eval-harness.md)

## 这套教材回答什么

你可能已经会调用模型、写几条测试样本，甚至能得到一个准确率，但一个可信 Eval Harness 还要继续追问：测的是哪个系统版本，哪些 Sample 在运行前进入计划，超时重试有没有把失败洗掉，Scorer 看了什么证据，分母为什么是这个数，Candidate 相对 Baseline 的差异有多稳定，缺证据时 Gate 为什么没有通过？

为了让这些问题都能落到可检查的记录上，本仓库把一次评测拆成下面这条对象链，每个对象只承担一段明确的责任。

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

先不要急着背类名，因为读到任何一个对象时，你都可以沿着三个问题往下追：它为哪种错误负责，身份在何处固定，后续又怎样反向核对。

## 贯穿全书的第一个问题

规则规定订单金额达到 100 元时免运费，而 buggy 程序写成 `amount > 100`，fixed 程序写成 `amount >= 100`，再把金额 99、100、101 三个 Sample 分别交给两个 Target 执行一次，运行前就能确定一共有 6 个 Trial。

金额 100 的 buggy Trial 虽然正常完成了进程，却返回了错误答案，因此它会留下 Trial completed、Attempt succeeded/canonical、Score failed、Metric 2/3 和 Gate failed 这一串彼此不冲突的状态。先把这个分层立住，后面的证据链才不会混在一起。

## 第一次运行

准备好 Python 3.12 和 `uv` 以后，直接执行下面这组命令，就能得到一份不依赖模型凭据的确定性运行结果。

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

再运行 `score` 和 `gate` 时，程序不会重跑 Target，而会从冻结证据重新计算，并分别写出 `rescore.json` 与 `regate.json`。如果重算后的结果发生变化，就应先检查证据或 Scorer 身份——不要从几份报告里挑一个更好看的数字。

## 阅读约定

- Python 标识符和上游项目名称保留英文，首次出现给出中文解释；
- “源码事实”必须落到锁定 commit 的永久链接；
- 跨多个调用点重建的责任边界标为“机制解释”；
- 本仓库缩小的伪代码和 Reference Harness 标为“教学简化”；
- 公开源码不足时明确写“不可核对”，不猜闭源内部实现；
- 每篇核心课都给实验、预期输出和答案，你不需要等待逐题互动才能继续。

## 接下来怎么走

如果你是第一次系统学习，可以从[Agent Harness 与 Eval Harness](foundations/01-agent-vs-eval-harness.md)开始，按顺序读完七篇基础课。已经做过评测工程的读者可以直接去[学习路线](learning-paths.md)，根据手头的问题选择源码、Agent 环境或 Eval-to-RL 路径。
