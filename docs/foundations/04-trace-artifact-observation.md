# 04｜Trace、Artifact 与 Observation：让分数能回到证据

[上一章](03-sample-trial-attempt.md) · [下一章](05-scorer-judge-score-metric.md)

## 本篇要解决什么问题

报告里就算写着「通过 92%」，你也没法立刻核对这个结果，因为还得查清每个 Score 来自哪次执行、看过哪些事件和文件，以及评分之后这些文件有没有被改写。Trace（轨迹）负责串起事件，Artifact（产物）负责保存大对象，两者先把执行证据留住。

到了评分前，Observation Bundle（观测包）再冻结 Scorer 能读取的内容，让你从一个分数一路查回当时真正观察到的证据。

## 学完你能解释什么

- 事件流、文件产物和评分输入为什么要分开；
- Trace 的父子关系和序号怎样表达因果，而不仅是时间戳；
- 内容摘要怎样检测 Artifact 被替换；
- 为什么 Score 必须绑定 Observation Bundle 和 canonical Attempt。

## 贯穿案例

shipping Target 返回 `{"fee": 10}` 时，Runner 先后写下 Trial 开始和 Target 完成两个事件，并在后一个事件的 payload 里同时留下 output 与 expected，同时把原始输出按内容地址存成 Artifact。Bundle 随后把这些事件、Artifact 摘要和 canonical Attempt 绑在一起，Scorer 只读这份 Bundle，不再调用 Target，因此以后执行 `score` 时不必重跑脚本，也能按同一份证据得到结果。

## 核心概念与边界

**TraceEvent** 记下运行中能够排序并相互连接的事实，至少要带稳定的 event_id、sequence、type、parent_event_id 和 payload。事件里不适合直接塞入的字节内容，例如 Diff、日志、截图、测试报告或环境终态，则交给 **Artifact** 保存，其他对象通过 SHA-256 摘要和相对路径引用它。到了评分前，**Observation Bundle** 再把允许 Scorer 读取的事件和产物冻结下来，并明确它们属于这个 Trial 的哪一个 canonical Attempt。

Trace 不包括隐藏思维链，因此 Eval Harness 应该记录外部看得见的模型消息、工具调用、状态变化和输出，却不能要求模型交出内部推理，更不能假装自己拿到了。Artifact 也有边界，附件只有带上摘要、类型和来源关系，才能进入评分。

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

时间戳可以拿来分析性能，却不能代替 sequence 和 parent 关系，因为不同机器的时钟可能并不一致。`relative_path` 让报告换到另一台机器后仍能找到文件。如果公开文档和证据写的是本机绝对路径，别人既难复现，还可能从中看到用户名。digest 则必须覆盖 Scorer 真正读到的内容，只对文件名做哈希，发现不了文件内容已经被换掉。

## 设计取舍

JSONL 很适合逐条追加事件，也方便逐行恢复和用命令行检查，不过它不会替你验证跨事件约束。把完整输出同时放进事件和 Artifact 会多存一份数据，但教学实现借此既能展示便于阅读的 payload，也能演示怎样按内容寻址。生产系统可以只在事件里保存 ArtifactRef，不过必须把 Scorer 实际读取的内容算进 Bundle digest。

Inspect AI 锁定提交里的 [`EvalLog`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/log/_log.py#L1141-L1181) 怎样组织 Eval Log，属于**上游源码事实**。OpenAI Evals 的 [`RecorderBase`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L54-L93) 和 [`Event`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L44-L51) 怎样划定事件记录的范围，同样属于**上游源码事实**。本篇把这两套做法放到一条证据血缘里讲，才是我们的**机制解释**。

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

打开 `evidence.json` 的第一个 Bundle，顺着 Artifact digest 找到对应的相对路径，然后复制文件内容并计算 SHA-256，看看结果是否与文件名一致。接着临时移动一个 Artifact，再运行 `inspect`，确认检查会因为找不到证据而失败。实验结束后记得把文件放回原位。

## 预期输出与答案

正常情况下，`inspect` 会报告 6 个 Trial、6 个 Bundle 和 6 条 Score，每个 Artifact 文件名都应等于 `sha256:` 后面的 64 位十六进制摘要。只要少了一个已经被引用的 Artifact，`inspect` 就应以非零状态退出并显示「运行证据无效」，不能再把原来的 Gate 打印出来。`score` 则从冻结的 Bundle 重算 6 条评分，不会产生新的 Attempt。

## 常见误解

「有日志就能审计」忽略了身份和因果关系，「数据库记录不会变，所以不用摘要」也没把管理员操作、迁移和导出算进去。如果只拿最终回答评分，你就看不到工具造成的副作用和环境终态。反过来，把全部内部推理存下来也换不来可靠透明，只会带来隐私、安全和来源无法核对等新问题。

## 如何核对

运行 `python -m pytest tests/test_lineage.py tests/test_cli.py -q`，看看测试有没有覆盖父子顺序、事件去重、Artifact 去重、canonical Attempt 绑定和文件缺失。然后从 `report.json` 的 Gate 找到 metric_id，再从 Metric 找 score_ids，最后从 Score 找 observation_bundle_digest，确认你确实能沿这条链查回去。

## 与其他 Harness 的关系

Promptfoo 常围绕测试结果和 Trace 类型来组织应用评测，Inspect AI 用 Eval Log 更完整地保存样本与事件，Agent Environment Harness 还得留下容器日志、补丁和终态。它们写得详略不同，但都绕不开三个问题：Scorer 当时究竟看见了什么，这些证据属于哪次运行，评分以后内容有没有变化。

## 本篇不能证明什么

完整血缘能帮你核对报告是否忠实反映已保存的证据，也能在评分规则改动后确认重算读的仍是同一份冻结内容，而且引用没有在重算途中漂移。不过，它证明不了 Dataset 选得正确、Reference 没有偏差，也证明不了环境里不存在尚未记录的外部副作用。证据链回答的是「结论从哪里来」，至于「问题问得对不对」，还得回到评测设计里找答案。

[上一章](03-sample-trial-attempt.md) · [下一章](05-scorer-judge-score-metric.md)
