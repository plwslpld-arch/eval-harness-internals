# 04｜Trace、Artifact 与 Observation：让分数能回到证据

[上一章](03-sample-trial-attempt.md) · [下一章](05-scorer-judge-score-metric.md)

## 本篇要解决什么问题

报告写着「通过 92%」，仍然不足以让结果可核对。读者还需要知道每个 Score 依据哪次执行、看了哪些事件、读取了哪个文件、文件后来是否被改写，以及评分完成后能否沿引用回到原始观察。Trace、Artifact 与 Observation Bundle 提供了三层结构，它们把「日志很多」转成一条能够反查的证据血缘。

## 学完你能解释什么

- 事件流、文件产物和评分输入为什么要分开；
- Trace 的父子关系和序号怎样表达因果，而不仅是时间戳；
- 内容摘要怎样检测 Artifact 被替换；
- 为什么 Score 必须绑定 Observation Bundle 和 canonical Attempt。

## 贯穿案例

shipping Target 返回 `{"fee": 10}` 时，Runner 会写入 Trial 开始和 Target 完成两个事件，而后一个事件的 payload 同时保存 output 与 expected，原始输出还会作为内容寻址 Artifact 保存。Bundle 随后把事件、Artifact 摘要和 canonical Attempt 绑定起来，因为 Scorer 只读取 Bundle，不再调用 Target，所以后续执行 `score` 时无需重跑脚本也能得到同一结果。

## 核心概念与边界

**TraceEvent** 记录运行中可排序、可连接的事实，至少需要稳定的 event_id、sequence、type、parent_event_id 和 payload。**Artifact** 用来保存不适合直接内联在事件中的字节对象，例如 Diff、日志、截图、测试报告或环境终态，它们通过 SHA-256 摘要和相对路径被引用。**Observation Bundle** 是评分输入的快照，它声明「针对这个 Trial 的这个 canonical Attempt，评分器可以看哪些事件和产物」。

Trace 的范围不包括隐藏思维链，因此 Eval Harness 应记录外部可观察的模型消息、工具调用、状态变化和输出，但它不需要求、也不应假装获取模型的内部推理。Artifact 也有明确边界——只有同时带着摘要、类型和来源关系，附件才有资格进入评分。

## 机制图

![Trace、Artifact、Observation、Score、Metric 与 Gate 血缘](../assets/diagrams/foundations/04-lineage.svg)

## 调用链与状态变化

1. Runner 为 canonical Attempt 产生有序事件；TraceWriter 拒绝重复 event_id 和先于父事件出现的子事件。
2. 大对象进入 ArtifactStore，相同字节得到相同摘要并复用同一个内容地址。
3. Bundle Builder 验证 Trial 只有一个 canonical Attempt，再把事件和 ArtifactRef 规范化哈希。
4. Scorer 读取 Bundle，ScoreRecord 保存 Bundle digest、canonical_attempt_id 和 scorer_id。
5. Metric 保存参与聚合的 score_ids，Gate 保存 metric_ids；报告因此可以从决定逐层反查。

Reference Harness 分别在 [`tracing.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/tracing.py)、[`artifacts.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/artifacts.py) 和 [`reporting.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/reporting.py) 实现这三段。

## 关键数据结构

```text
TraceEvent(event_id, sequence, type, parent_event_id, payload)
ArtifactRef(kind, digest, relative_path)
ObservationBundle(bundle_id, digest, trial_id,
                  canonical_attempt_id, events, artifacts)
ScoreRecord(..., observation_bundle_digest, scorer_id)
```

时间戳可用于性能分析，但不应代替 sequence 和 parent 关系，因为不同机器的时钟可能漂移。`relative_path` 让报告能够迁移——如果在公开文档和证据里写本机绝对路径，结果既难以复现，也可能泄露用户名。digest 必须覆盖真正进入评分的内容，因为只哈希文件名并不能检测文件内容的替换。

## 设计取舍

JSONL 适合追加事件、逐行恢复和命令行检查，代价是跨事件约束需要另外验证。完整输出如果同时放进事件和 Artifact，存储上会有重复，但小型教学实现可以借此同时展示可读 payload 与内容寻址。生产系统可以让事件只保存 ArtifactRef，但必须确保 Scorer 实际读取的内容已纳入 Bundle digest。

Inspect AI 的锁定 [`EvalLog`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/log/_log.py#L1141-L1181) 属于 Eval Log 模型的**上游源码事实**。OpenAI Evals 的 [`RecorderBase`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L54-L93) 与 [`Event`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L44-L51) 展示了另一种事件记录边界，这也是**上游源码事实**。本篇把两者放在证据血缘下统一解释，这一步才属于**机制解释**。

## 失败语义

- 子事件引用尚未出现的父事件：Trace `invalid`。
- Artifact 文件缺失或摘要不匹配：Bundle 不能评分；不能只相信报告里的旧值。
- Trial 有零个或多个 canonical Attempt：Bundle 构造失败。
- Scorer 需要字段但事件和 Artifact 都未提供：Score `unscorable`，不是 0。
- Trace 包含秘密或不必要个人数据：属于安全失败，应在保存前过滤并阻断发布。

## 动手实验

先运行 shipping 示例，再执行：

```bash
eval-harness-ref inspect output/shipping
eval-harness-ref score output/shipping
```

查看 `evidence.json` 的第一个 Bundle，找到 Artifact digest 与文件相对路径。复制该 Artifact 的内容并计算 SHA-256，再将结果与文件名对比。然后临时移动一个 Artifact，再运行 `inspect` 观察证据检查失败，实验完成后要把文件恢复原位。

## 预期输出与答案

正常时，`inspect` 会报告 6 个 Trial、6 个 Bundle 和 6 条 Score，其中 Artifact 文件名应当等于 `sha256:` 后面的 64 位十六进制摘要。只要缺少任意一个已引用 Artifact，`inspect` 就应以非零状态退出并显示「运行证据无效」，而不能继续打印原 Gate。`score` 会从冻结 Bundle 重算 6 条评分，整个过程不会产生新的 Attempt。

## 常见误解

「日志存在就能审计」遗漏了身份和因果关系，而「数据库记录不可变所以不用摘要」也没有考虑管理员、迁移和导出边界。只用最终回答评分，工具副作用与环境终态就会消失。如果试图通过保存全部内部推理来换取透明，又会引入隐私、安全和来源无法验证等问题。

## 如何核对

运行 `python -m pytest tests/test_lineage.py tests/test_cli.py -q`。检查测试是否覆盖父子顺序、事件去重、Artifact 去重、canonical Attempt 绑定和缺失文件。再从 `report.json` 的 Gate 找 metric_id，从 Metric 找 score_ids，从 Score 找 observation_bundle_digest，确认链条可逆。

## 与其他 Harness 的关系

Promptfoo 常围绕测试结果和 Trace 类型组织应用评测，Inspect AI 的 Eval Log 更完整地承载样本与事件，Agent Environment Harness 还需保存容器日志、补丁和终态。它们的实现密度差别很大，却都要回答同样的最小问题：Scorer 究竟看见了什么，证据属于哪次运行，内容在评分后又是否发生变化。

## 本篇不能证明什么

完整血缘能够证明报告与已保存证据之间的一致性，也能在评分规则变化后确认重算仍然读取了同一份已冻结的内容，并核对证据引用在重算期间没有发生漂移，但它无法继续证明 Dataset 正确、Reference 无偏，或被测环境没有未记录的外部副作用。证据链回答的是「结论来自哪里」，至于「这个问题问得是否正确」，还需要从评测设计中另外找证据。

[上一章](03-sample-trial-attempt.md) · [下一章](05-scorer-judge-score-metric.md)
