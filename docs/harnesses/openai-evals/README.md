# OpenAI Evals 源码课程：Registry 怎样驱动 Eval 与事件记录

[上一节](../inspect-ai/03-scorer-log-retry.md) · [下一节](01-registry-eval-spec.md)

## 本篇要解决什么问题

OpenAI Evals 的经典实现围绕 Registry、EvalSpec、CompletionFn 和 Recorder 展开——命令行接收几个字符串，运行时却要把它们解析为 Eval 类、数据路径、模型调用对象和日志后端。新人若只看 YAML，会误以为配置本身就是执行；若只看某个 Eval 子类，又看不到运行身份和事件怎样统一记录，因此本课程追踪 `oaieval.run` 从配置键到 final report 的全过程。

锁定版本为 `8eac7a7de5215c907fbddc30efdaf316913eccdd`。这套源码包含较早的 CompletionFn/Eval Registry 设计，也有 SolverEval 等扩展，课程将它作为配置驱动 Eval Harness 的重要实现研究，不把其公开接口推断成 OpenAI 当前所有内部评测系统。

## 先建立源码地图

| 站点 | 锁定文件 | 责任 |
| --- | --- | --- |
| CLI | [`cli/oaieval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/cli/oaieval.py) | 参数、RunSpec、Eval/CompletionFn/Recorder 装配 |
| Registry | [`registry.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py) | 加载 YAML、解引用 spec、实例化类 |
| Eval | [`eval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py) | Sample 遍历、CompletionFn 使用与聚合返回 |
| Completion API | [`api.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/api.py) | CompletionFn Protocol 与匹配记录 helper |
| Recorder | [`record.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/record.py) | Sample 事件、Local/HTTP/DB 后端与 final report |

## 完整调用链

![OpenAI Evals 配置驱动调用链](../../assets/diagrams/harnesses/openai-evals/end-to-end.svg)

1. `oaieval.run` 创建或接收 Registry，追加自定义 registry paths，再通过 eval key 取得 EvalSpec。
2. CLI 合并 Eval 参数和 completion_args 后，将 CompletionFn 字符串按逗号拆分，再由 `registry.make_completion_fn` 解析为模型快捷实现、Registry CompletionFn 或 Solver。
3. 入口构造 RunSpec，选择 Dummy、Local、HTTP 或数据库 Recorder，并通过 Registry 取得 Eval class。
4. Eval class 用 completion_fn_instances、EvalSpec args、eval_registry_path 和 Registry 实例化，数据相对路径则会以该 Registry 的 data 目录为基准解析。
5. `eval.run(recorder)` 遍历样本时，每个 Sample 进入 `recorder.as_default_recorder(sample_id)` 上下文，Eval/CompletionFn 通过 helper 写 sampling、match、function_call、metrics 或 error 事件。
6. Eval 返回聚合结果 dict；CLI 随后可从 sampling 事件补充 token usage，再调用 `record_final_report`。

## 关键数据结构

`EvalSpec` 保存 key、class、args 与 registry_path；`CompletionFnSpec` 保存类和参数；`RunSpec` 把 completion_fns、EvalSpec 和 run_id 固定为运行头。`Event` 至少把 run_id/sample_id/type/data/time 关联起来，而 CompletionFn Protocol 接收 prompt 并返回 CompletionResult，Eval 决定怎样把结果转成 match 或其他 metric。

这里的 Sample event 与 Reference Harness TraceEvent 相似，但没有强制 parent/sequence、canonical Attempt 或 Observation Bundle digest——课程会把这一能力映射标为 partial，而不是因为都是 JSONL 就声称等价。

## 实现取舍与失败语义

Registry 降低新增 Eval/模型配置的代码耦合，也让同一类可以由不同 args 实例化；代价是运行身份分散在 YAML、路径优先级、解引用链和 CLI override。Recorder 使用 ContextVar 提供隐式 sample_id，Eval 代码简洁，但异步/线程边界和缺失上下文必须谨慎处理。

HTTP Recorder 失败可回落 LocalRecorder，保护证据不因远端日志服务故障完全丢失；这属于记录层恢复，不代表产品 Sample 可以重答，而 CompletionFn 的网络 retry 与 Eval 的 Sample 语义也未在核心对象里形成显式 Trial/Attempt 分层。

## 动手实验

写一份运行身份清单：Eval key、Registry 路径与 commit、解析后的 Eval class/args、CompletionFn key/class/args、数据文件摘要、Recorder 类型与路径，再指出仅保存 CLI 字符串会丢掉哪些信息。

执行：

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

仅保存 `oaieval model eval-name` 会丢 Registry 路径优先级、spec 解引用、CLI override、模型实际版本、数据内容摘要和 Recorder fallback；可复现记录必须保存解析后 RunSpec 与实际资源版本。

课程门禁只有在四篇正文、图示、锁定链接和上下导航完整时通过；它不需要 OpenAI API key，也不运行外部模型。

## 如何核对

从 [`cli/oaieval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/cli/oaieval.py) 顺序追 `get_eval`、`make_completion_fn`、RunSpec、`build_recorder`、`get_class`、`eval.run` 和 `record_final_report`。再到 [`registry.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py) 核对 Registry 怎样加载不同资源目录和拒绝重复 key。

## 本篇不能证明什么

Registry 与 Recorder 完整不能证明 Eval 数据有效、CompletionFn 是声明模型、事件足以审计 Agent 副作用，或 final report 可直接作为发布 Gate；它解释配置驱动机制，不扩大为生产质量证明。

[上一节](../inspect-ai/03-scorer-log-retry.md) · [下一节](01-registry-eval-spec.md)
