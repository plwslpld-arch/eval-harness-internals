# OpenAI Evals 源码课程：Registry 怎样驱动 Eval 与事件记录

[上一节](../inspect-ai/03-scorer-log-retry.md) · [下一节](01-registry-eval-spec.md)

## 本篇要解决什么问题

OpenAI Evals 的经典实现围绕 Registry（注册表）、EvalSpec、CompletionFn（补全函数）和 Recorder 运转。命令行虽然只收到几个字符串，程序跑起来后却要逐个把它们解成 Eval 类、数据路径、模型调用对象和日志后端。如果只看 YAML，你容易把配置当成已经执行的运行，但只盯着某个 Eval 子类，又会漏掉运行身份和统一记下的事件。因此这组课程会顺着 `oaieval.run` 往下走，看配置键怎样一步步变成 final report。

本课锁定在 `8eac7a7de5215c907fbddc30efdaf316913eccdd`。这份源码保留了较早的 CompletionFn/Eval Registry 设计，也加入了 SolverEval 等扩展，所以课程只用它讲清一套由配置驱动的 Eval Harness 怎样工作，不会拿这些公开接口去推测 OpenAI 现在所有内部评测系统。

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

`EvalSpec` 记下 key、class、args 和 registry_path，`CompletionFnSpec` 记下类与参数，`RunSpec` 再把 completion_fns、EvalSpec 和 run_id 组成运行头。`Event` 至少要连上 run_id/sample_id/type/data/time，CompletionFn Protocol 则接收 prompt 并返回 CompletionResult。这份结果最后会变成 match 还是其他 metric，得由 Eval 做决定。

这里的 Sample event 与 Reference Harness TraceEvent 有些像，但前者没有强制记录 parent/sequence、canonical Attempt 或 Observation Bundle digest，正好少了关键血缘，因此课程只能把这项能力标成 partial。两边确实都写 JSONL，但存储格式一样不等于证据合同也一样。

## 实现取舍与失败语义

Registry 让新增 Eval 或模型配置时少改代码，也让同一个类可以带着不同 args 反复实例化。可这样一来，运行身份就散在 YAML、路径优先级、解引用链和 CLI override 里，要复现时一处都不能漏。Recorder 通过 ContextVar 暗中带上 sample_id，Eval 代码的确会更简洁，但实现者得小心处理异步边界、线程边界和上下文缺失。

HTTP Recorder 失败后可以改用 LocalRecorder，避免远端日志服务一出故障，证据就全部丢失。但这个动作只恢复记录层，不能因此让产品 Sample 重答。此外，核心对象没有把 CompletionFn 的网络 retry 和 Eval 的 Sample 语义明确分成 Trial 与 Attempt 两层。

## 动手实验

写一份运行身份清单，收入 Eval key、Registry 路径与 commit、解析后的 Eval class/args、CompletionFn key/class/args、数据文件摘要以及 Recorder 类型与路径，然后再指出如果只保存 CLI 字符串，其中哪些信息会消失。

执行：

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

如果只留下 `oaieval model eval-name`，你会同时丢掉 Registry 路径优先级、spec 解引用、CLI override、模型实际版本、数据内容摘要和 Recorder fallback。所以要想复现这次运行，记录里必须有解析后的 RunSpec 与真正用到的资源版本。

只有四篇正文、图示、锁定链接和上下导航都齐全，课程门禁才会放行，这一检查过程不需要 OpenAI API key，也不会真正调用外部模型。

## 如何核对

从 [`cli/oaieval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/cli/oaieval.py) 顺序追 `get_eval`、`make_completion_fn`、RunSpec、`build_recorder`、`get_class`、`eval.run` 和 `record_final_report`。再到 [`registry.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py) 核对 Registry 怎样加载不同资源目录和拒绝重复 key。

## 本篇不能证明什么

即使 Registry 和 Recorder 都留下了完整记录，你也不能由此证明 Eval 数据有效、CompletionFn 就是所声明的模型，或者这些事件已经足够审计 Agent 的副作用。final report 也不能直接当作发布 Gate，因为本课只讲配置怎样驱动整套机制，不把它扩大成生产质量证明。

[上一节](../inspect-ai/03-scorer-log-retry.md) · [下一节](01-registry-eval-spec.md)
