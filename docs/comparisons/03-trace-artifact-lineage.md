# 横向比较三：Trace、Artifact 与血缘

[上一节](02-runner-concurrency-cache-retry.md) · [下一节](04-scorer-judge-outcomes.md)

## 本篇要解决什么问题

OpenAI Evals 有 Recorder Event，Inspect 有 EvalLog/SampleLog，Promptfoo 有 EvaluateResult 与 trace-aware assertions，DeepEval 有 TestRun/trace，Harbor 有 trajectory、logs 和 Trial 目录。它们都“记录运行”，但字段、完整性和用途不同。本篇比较它们怎样回连 Sample、Target、评分与产物，并给出最小 Observation Bundle。

## 核心机制

![Trace、Artifact、Observation 与 Score 血缘](../assets/diagrams/foundations/04-lineage.svg)

Trace 是按时间/因果记录的事件；Artifact 是可能较大的不可变 bytes；ObservationBundle 是 Scorer 被允许看到的冻结视图；Score 引用 Bundle digest。将四者分开，可以追加日志而不把所有内容塞进事件，也能对评分输入做最小化和摘要核验。

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
3. Attempt 结束后选择唯一 canonical；非 canonical Trace 仍审计，但不进入主 Score。
4. 构建 ObservationBundle，列出允许 Scorer 读取的事件和 Artifact，计算 digest。
5. ScoreRecord 固定 scorer identity、canonical Attempt 与 Bundle digest。
6. Inspect/验证时重算 Artifact digest、核对 parent、sequence、Trial/Attempt 归属和 Score 引用。

## 关键数据与不变量

事件 ID 在 Trace 内唯一，sequence 连续，parent 必须先出现；Artifact path 不能越界，digest 必须匹配 bytes；Bundle 只能绑定 canonical Attempt；Score 不能引用不存在 Bundle。秘密与隐藏 chain-of-thought 不应进入 Trace，敏感输出需最小化、分级与保留期限。

## 动手实验

运行 lineage 与安全测试：

```bash
uv run pytest tests/test_lineage.py tests/test_runtime_extensions.py -k "trace or artifact" -q
```

把一个 parent 改为未知 ID、把 Artifact path 改为 `../secret`、再篡改 bytes，分别指出在哪一层失败。

## 预期输出与答案

未知 parent 在 Trace 写入/导入时失败；路径越界在 ArtifactRef 验证时失败；bytes 篡改在 inspect 重算 digest 时失败。三者都是证据无效，不应继续评分并给产品 0 分。

## 如何核对

对照 OpenAI Evals Recorder、Inspect EvalLog 与 Harbor Result 课程；再阅读 [`tracing.py`](../../src/eval_harness_reference/tracing.py)、[`artifacts.py`](../../src/eval_harness_reference/artifacts.py) 和 lineage 测试。

## 本篇不能证明什么

结构完整和 digest 正确不能证明事件由可信采集器产生、时间戳准确或环境没有隐藏副作用。血缘提供可核对链，不等于远程证明。

[上一节](02-runner-concurrency-cache-retry.md) · [下一节](04-scorer-judge-outcomes.md)
