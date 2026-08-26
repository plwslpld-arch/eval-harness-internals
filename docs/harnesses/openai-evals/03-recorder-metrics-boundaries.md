# 03｜Recorder 与 Metric 边界：事件很多，推断仍要另建合同

[上一节](02-completion-sample-run.md) · [下一节](../../contents.md)

## 本篇要解决什么问题

OpenAI Evals 的 Recorder 可以记录 sampling、match、function_call、cond_logp、metrics、error 和任意 extra，LocalRecorder 还能写 JSONL，并在 HTTP 失败时回落本地。不过，记录到了事件并不会自动说明事件是否有因果顺序、哪次执行是 canonical、还有多少样本未评分，也不会给出最终 accuracy 的分母或发布结论，所以本节要划清记录层与推断层的边界——两层不能互相代替。

## 先建立源码地图

[`RecorderBase`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L54-L93)、[`Event`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L44-L51)、default recorder ContextVar 与 [`record_event`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L157-L185) 都在锁定 `record.py` 中，而 [`LocalRecorder`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L316-L355) 和 [`HttpRecorder`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L374-L413) 是两种不同的事件落地方式，选择哪一种会改变证据最终写到哪里。CLI 通过 [`build_recorder`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/cli/oaieval.py#L242-L266) 选择后端，token usage 的补充与 final report 的写入则发生在 [`run()`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/cli/oaieval.py#L118-L157)，match helper 位于 [`api.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/api.py#L55-L93)。

## 完整调用链

![OpenAI Evals Recorder 事件模型](../../assets/diagrams/harnesses/openai-evals/recorder.svg)

1. CLI 根据 dry-run、record_path、remote URL 等选择 Recorder。每个 Recorder 持有 RunSpec。
2. Eval 进入 `as_default_recorder(sample_id)`，ContextVar 暂存当前 Recorder 与 sample_id；离开上下文后恢复旧值。
3. CompletionFn/Eval 调用全局 helper，最终进入 `record_event(type, data, sample_id)`；没有显式或上下文 sample_id 时抛错，防止事件成为孤儿。
4. LocalRecorder 把 Event 写入本地 JSONL；HTTP Recorder 发送远端，异常时写 local fallback 并提示。
5. Eval.run 返回 final report，而 CLI 从 sampling events 可累计 token usage，再单独调用 `record_final_report`。
6. 消费者可按 type 查询 events，但 Metric 的聚合公式主要由 Eval 返回 dict 决定，Recorder 不验证分母或统计假设。

## 关键数据结构

Event 把 run、sample、type 和 data 连在一起，其中 sampling data 可以包含 prompt/sampled/usage，match 可以包含 correct/expected/picked/sampled/options，而 function_call 可以包含 name/arguments/return，error 用来保存消息和异常，metrics 则是 Eval 自由提供的键值。

RunSpec 负责保存运行头，final report 负责给出聚合输出，但两者之间没有强制的 ScoreRecord/MetricEstimate 引用链。由于 final report 不一定列出参与每个 Metric 的 Event ID，证据 Adapter 既要保留原始 Event，也要另外生成显式的 Observation 与 Score 血缘。

## 实现取舍与失败语义

通用 Event API 让实验可以快速记录任意事实，代价是 type/data schema 由调用者自行约定，因此跨 Eval 的语义可能并不一致。ContextVar 比全局变量更适合并发上下文，但跨线程或异步任务的传播仍然需要测试。Local fallback 能增强持久性，但证据位置会分叉。远端和本地都会留下各自记录，后续汇总时必须去重并标记实际 sink。

记录服务失败属于 Harness 基础设施故障，不应该改变模型 Score。Sampling event 已经存在但 match 缺失时，样本可能处于 unscored 状态，既不能默认算作失败，也不能悄悄从分母中消失。如果 final report 只有平均值而没有 Sample 事件清单，它的证据能力只能算 partial，而 Recorder 本身也没有发布 Gate，任何阈值决策都应交给独立政策层。

## 动手实验

给定 100 个 raw_sample、90 个 sampling、80 个 match=true、10 个 match=false、5 个 error，以及 5 个只有 sampling 而没有 match 的事件，请分别设计事件完整性报告、Score 状态映射、Metric denominator 和 Gate 输入，并说明 HTTP fallback 重复上传时应该怎样去重。

再把这些字段映射到 Reference Harness 的 TraceEvent、ObservationBundle、ScoreRecord 与 MetricEstimate，标出 unavailable/partial。

## 预期输出与答案

计划中的 Sample 分母是 100，其中 80 passed、10 failed、5 error，后者还要按错误类别映射为 blocked/invalid，另有 5 unscored。如果只在 90 个 match 上算出 88.9%，不能据此直接宣布通过，因为质量决定必须暴露这 10% 的缺失。去重至少要使用对应的 run_id + sample_id + event identity/内容摘要，不能仅凭事件文本相同就删除。

Event 到 TraceEvent 的映射只能算 partial，因为父子关系和 sequence 未必存在。sampling/match 可以组成 Observation，但仍然缺少 canonical Attempt digest，match 可以转换成 Score，而 final report metric 如果没有 score_ids，也仍然只能标为 partial。核心 Recorder 中没有 Gate。

## 如何核对

依次阅读 [`as_default_recorder`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L91-L96)、[`record_event`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L157-L185)、[`LocalRecorder`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L316-L355) 和 [`HttpRecorder` 的 fallback](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py#L374-L413)，再在 [`cli/oaieval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/cli/oaieval.py#L118-L157) 核对 final report 与 token usage 是入口后处理，而不是 Recorder 自动推断。

## 本篇不能证明什么

JSONL 可以读取、fallback 也执行成功，并不能证明证据完整、事件未经改写或 Metric 统计有效，因为 Recorder 提供的只是观察存储。要形成质量结论，仍需补齐身份、血缘、分母、不确定性和 Gate Policy。

[上一节](02-completion-sample-run.md) · [下一节](../../contents.md)
