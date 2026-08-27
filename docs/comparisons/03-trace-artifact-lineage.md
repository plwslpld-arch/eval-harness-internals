# 横向比较三：Trace、Artifact 与血缘

[上一节](02-runner-concurrency-cache-retry.md) · [下一节](04-scorer-judge-outcomes.md)

## 本篇要解决什么问题

OpenAI Evals 用 Recorder Event 记运行过程，Inspect 保存 EvalLog/SampleLog，Promptfoo 给出 EvaluateResult 与 trace-aware assertions，DeepEval 记录 TestRun/trace，Harbor 则留下 trajectory、logs 和 Trial 目录。它们看起来都在「记录运行」，实际记下的字段、完整程度和用途却不一样，所以这一篇要看各家怎样用这些记录找回对应的 Sample、Target、评分与 Artifact（产物），再从中整理出最小 Observation Bundle。

## 核心机制

![Trace、Artifact、Observation 与 Score 血缘](../assets/diagrams/foundations/04-lineage.svg)

Trace（轨迹）按时间和因果关系记下事件，Artifact 保存体积可能很大的不可变 bytes，ObservationBundle（观测包）则固定 Scorer 可以读取哪些内容，Score 只引用对应的 Bundle digest。把四者分开以后，系统既能继续追加日志，不必把所有内容都塞进事件，也能管住评分输入并核验摘要，证据怎样一路传到分数就清楚了。

| Harness | 主要运行记录 | 强项 | 需额外补齐 |
| --- | --- | --- | --- |
| lm-eval | request/result/metric samples | benchmark 结果与请求 | Agent 副作用因果链 |
| Inspect | EvalLog/Sample/Model/Tool events | 丰富日志与安全审阅 | 外部 Artifact 政策视实现 |
| OpenAI Evals | Recorder Event/RunSpec | sample context 与后端 | parent/sequence 与 Artifact digest |
| Promptfoo | EvaluateResult/JSONL/trace | 应用断言与恢复 | Trial/Attempt 显式分层 |
| DeepEval | TestRun/MetricData/trace | Metric 解释与平台输出 | 冻结 Bundle identity |
| Harbor/TB | Trial dirs/trajectory/log/reward | 环境副作用与阶段证据 | 跨存储统一 digest/lineage |

## 完整流程

1. Trial 开始产生 root event，后续 model/tool/environment 事件带 event_id、sequence、parent 和时间。
2. 大日志、diff、截图、终态保存为 Artifact，事件只引用 digest/path。
3. Attempt 结束后选择唯一 canonical，非 canonical Trace 仍审计，不进入主 Score。
4. 构建 ObservationBundle，列出允许 Scorer 读取的事件和 Artifact，计算 digest。
5. ScoreRecord 固定 scorer identity、canonical Attempt 与 Bundle digest。
6. Inspect/验证时重算 Artifact digest、核对 parent、sequence、Trial/Attempt 归属和 Score 引用。

## 关键数据与不变量

每个事件 ID 在同一条 Trace 里都要唯一，sequence 不能断，parent 还得先于子事件出现。Artifact path 不能越界，digest 必须和实际 bytes 对得上。Bundle 只能绑定 canonical Attempt，Score 也不能引用一个并不存在的 Bundle。秘密和隐藏的 chain-of-thought 不该写进 Trace，系统还要尽量缩减敏感输出，并为它们规定级别和保留期限。

## 动手实验

运行 lineage 与安全测试：

```bash
uv run pytest tests/test_lineage.py tests/test_runtime_extensions.py -k "trace or artifact" -q
```

依次把一个 parent 改成未知 ID，把 Artifact path 改成 `../secret`，然后篡改实际 bytes，并分别找出系统会在哪一层拒绝这三种改动。

## 预期输出与答案

写入或导入 Trace 时，系统会拒绝未知 parent。ArtifactRef 验证会拦下越界路径，inspect 重算 digest 时则会发现 bytes 已被篡改。这三种情况都会让证据失效，此时应当停止评分，更不能把产品记成 0 分。

## 如何核对

先对照 OpenAI Evals Recorder、Inspect EvalLog 与 Harbor Result 课程，看三套记录各自能记到哪一步，再阅读 [`tracing.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/tracing.py)、[`artifacts.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/artifacts.py) 和 lineage 测试。

## 本篇不能证明什么

结构完整、digest 正确，只能说明手里的证据彼此对得上，不能证明事件来自可信的采集器、时间戳准确，也不能证明环境里没有藏着别的副作用。血缘只把这些对象的对应关系留下来，方便你事后复查，它无法远程证明采集环境可信。

[上一节](02-runner-concurrency-cache-retry.md) · [下一节](04-scorer-judge-outcomes.md)
