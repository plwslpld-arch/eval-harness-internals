# 03｜Recorder 与 Metric 边界：事件很多，推断仍要另建合同

[上一节](02-completion-sample-run.md) · [下一节](../../contents.md)

## 本篇要解决什么问题

OpenAI Evals 里的 Recorder（记录器）能记下 sampling、match、function_call、cond_logp、metrics、error 和任意 extra，LocalRecorder 还可以写入 JSONL，并在 HTTP 失败后改存到本地。但事件已经写下来，不代表你就知道它们之间有没有因果顺序、哪次执行才是 canonical，或者还有多少样本没评分。Recorder 也不会替你给出 accuracy 的分母和发布结论，因此这一篇要把记录层和推断层分开，这两层不能互相顶替。

## 先建立源码地图

锁定的 `record.py` 把 [`RecorderBase`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L54-L93)、[`Event`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L44-L51)、default recorder ContextVar 和 [`record_event`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L157-L185) 放在一起。其中 [`LocalRecorder`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L316-L355) 与 [`HttpRecorder`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L374-L413) 用不同方式存事件，你选哪一个，证据最后就会落到哪里。CLI 用 [`build_recorder`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/cli/oaieval.py#L242-L266) 挑选后端，之后由 [`run()`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/cli/oaieval.py#L118-L157) 补上 token usage 并写入 final report，match helper 则在 [`api.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/api.py#L55-L93) 里。

## 完整调用链

![OpenAI Evals Recorder 事件模型](../../assets/diagrams/harnesses/openai-evals/recorder.svg)

1. CLI 根据 dry-run、record_path、remote URL 等选择 Recorder。每个 Recorder 持有 RunSpec。
2. Eval 进入 `as_default_recorder(sample_id)`，ContextVar 暂存当前 Recorder 与 sample_id；离开上下文后恢复旧值。
3. CompletionFn/Eval 调用全局 helper，最终进入 `record_event(type, data, sample_id)`；没有显式或上下文 sample_id 时抛错，防止事件成为孤儿。
4. LocalRecorder 把 Event 写入本地 JSONL；HTTP Recorder 发送远端，异常时写 local fallback 并提示。
5. Eval.run 返回 final report，而 CLI 从 sampling events 可累计 token usage，再单独调用 `record_final_report`。
6. 消费者可按 type 查询 events，但 Metric 的聚合公式主要由 Eval 返回 dict 决定，Recorder 不验证分母或统计假设。

## 关键数据结构

Event 会把 run、sample、type 和 data 连到同一条记录上。具体写什么由事件类型决定：sampling data 可以带 prompt/sampled/usage，match 可以带 correct/expected/picked/sampled/options，function_call 可以带 name/arguments/return，error 记消息和异常，metrics 则由 Eval 自己填键值。

RunSpec 保存运行头，final report 给出聚合后的输出，但代码没有强制它们通过 ScoreRecord 和 MetricEstimate 相互引用。final report 也未必会列出每个 Metric 用过哪些 Event ID，所以证据 Adapter 要留住原始 Event，同时另行生成 Observation 与 Score 之间的明确血缘。

## 实现取舍与失败语义

通用 Event API 允许实验快速记下各种事实，但调用者要自己约定 type/data schema，不同 Eval 写出来的事件因此可能同名不同义。ContextVar 比全局变量更适合并发上下文，不过你仍要测它能不能正确穿过线程和异步任务边界。Local fallback 让记录更不容易丢，却会把证据分到不同位置。如果远端和本地都留下了记录，后续汇总时就必须去重，并标明数据真正落到了哪个 sink。

记录服务挂了，说明 Harness 的基础设施出了故障，不能因此改写模型 Score，而如果 sampling event 已经存在，match 却没有出现，这条样本可能处于 unscored 状态，你不能默认它失败，也不能让它悄悄退出分母。final report 若只给平均值，却没有列出 Sample 事件，它能提供的证据就只能标成 partial，而 Recorder 自己也不执行发布 Gate，所以阈值判断应当交给独立的政策层。

## 动手实验

给你 100 个 raw_sample、90 个 sampling、80 个 match=true、10 个 match=false、5 个 error，再加上 5 个只有 sampling 却没有 match 的事件。请据此分别设计事件完整性报告、Score 状态映射、Metric denominator 和 Gate 输入，并说明 HTTP fallback 重复上传后要用什么依据去重。

再把这些字段映射到 Reference Harness 的 TraceEvent、ObservationBundle、ScoreRecord 与 MetricEstimate，标出 unavailable/partial。

## 预期输出与答案

计划里共有 100 个 Sample，所以分母是 100，其中 80 个 passed、10 个 failed、5 个 error，error 还要按类别分别映射为 blocked 或 invalid，另有 5 个 unscored。如果只用 90 个 match 算出 88.9%，你不能立刻宣布通过，因为做质量决策时必须把这 10% 的缺口摆在明面上。去重时至少要结合 run_id、sample_id 以及 event identity 或内容摘要，不能只因事件文本相同就删除。

把 Event 映射成 TraceEvent 时只能标为 partial，因为原始事件不一定记了父子关系和 sequence。sampling 与 match 虽然可以合成 Observation，但其中还是没有 canonical Attempt digest，而 match 转成 Score 之后，final report metric 若没有 score_ids，同样只能标成 partial。核心 Recorder 也不执行 Gate，你要在独立政策层补上这一步。

## 如何核对

依次阅读 [`as_default_recorder`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L91-L96)、[`record_event`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L157-L185)、[`LocalRecorder`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L316-L355) 和 [`HttpRecorder` 的 fallback](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L374-L413)，再在 [`cli/oaieval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/cli/oaieval.py#L118-L157) 核对 final report 与 token usage 是入口后处理，而不是 Recorder 自动推断。

## 本篇不能证明什么

你能读取 JSONL，fallback 也确实执行成功，依然不足以证明证据没有缺口、事件未被改写，或者 Metric 统计有效，因为 Recorder 只是把观察存下来。要做出质量结论，你还得补上身份、血缘、分母、不确定性和 Gate Policy。

[上一节](02-completion-sample-run.md) · [下一节](../../contents.md)
