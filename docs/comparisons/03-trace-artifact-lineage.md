# 横向比较三：Trace、Artifact 与血缘

[上一节](02-runner-concurrency-cache-retry.md) · [下一节](04-scorer-judge-outcomes.md)

## 本篇要解决什么问题

OpenAI Evals 使用 Recorder Event，Inspect 保存 EvalLog/SampleLog，Promptfoo 提供 EvaluateResult 与 trace-aware assertions，DeepEval 记录 TestRun/trace，Harbor 则留下 trajectory、logs 和 Trial 目录。它们看起来都在「记录运行」，但字段范围、完整程度和使用目的并不相同，因此本篇会比较这些记录怎样回连 Sample、Target、评分与产物，并从中整理出最小 Observation Bundle。

## 核心机制

![Trace、Artifact、Observation 与 Score 血缘](../assets/diagrams/foundations/04-lineage.svg)

Trace 按时间与因果关系记录事件，Artifact 保存可能很大的不可变 bytes，ObservationBundle 则冻结 Scorer 被允许看到的视图，而 Score 只引用对应的 Bundle digest。把四者分开之后，系统既能持续追加日志而不用把所有内容塞进事件，也能限制评分输入并核验摘要——证据链因此更清楚。

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

事件 ID 必须在 Trace 内唯一并保持 sequence 连续，而且 parent 要先于子事件出现，Artifact path 不能越界，digest 也必须与 bytes 匹配。Bundle 只能绑定 canonical Attempt，而 Score 不能引用不存在的 Bundle。秘密与隐藏 chain-of-thought 不应进入 Trace，敏感输出还要经过最小化处理，并设置分级规则与保留期限。

## 动手实验

运行 lineage 与安全测试：

```bash
uv run pytest tests/test_lineage.py tests/test_runtime_extensions.py -k "trace or artifact" -q
```

依次把一个 parent 改成未知 ID，把 Artifact path 改成 `../secret`，再篡改实际 bytes，并分别指出每种改动会在哪一层被拒绝。

## 预期输出与答案

未知 parent 会在 Trace 写入或导入时失败，路径越界会被 ArtifactRef 验证拦下，而 bytes 篡改会在 inspect 重算 digest 时暴露。三种情况都会让证据失效，因此此时不应继续评分，更不能给产品记 0 分。

## 如何核对

先对照 OpenAI Evals Recorder、Inspect EvalLog 与 Harbor Result 课程，辨认三套记录各自能覆盖到哪里，再阅读 [`tracing.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/tracing.py)、[`artifacts.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/artifacts.py) 和 lineage 测试。

## 本篇不能证明什么

结构完整且 digest 正确，只能说明现有证据彼此对应，不能证明事件来自可信采集器、时间戳准确，或者环境里没有隐藏副作用。血缘只能提供一条可供事后检查的对应关系，它并不等于对采集环境作出了远程证明。

[上一节](02-runner-concurrency-cache-retry.md) · [下一节](04-scorer-judge-outcomes.md)
