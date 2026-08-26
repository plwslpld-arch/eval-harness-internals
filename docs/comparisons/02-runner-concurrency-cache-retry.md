# 横向比较二：Runner、并发、缓存与 Retry

[上一节](01-task-dataset-target.md) · [下一节](03-trace-artifact-lineage.md)

## 本篇要解决什么问题

吞吐相关功能在所有 Harness 中都存在，却有不同语义：lm-eval 批量请求，Inspect 以 task/sample 并发并管理 retry，Promptfoo 展开矩阵后检测串行特性，DeepEval 用 asyncio semaphore，Harbor 并发 Trial 并恢复目录。缓存有时保存模型响应，有时保存评分或完整 Trial；若只比较“支持并发/重试”，会掩盖正确性风险。

## 核心机制

![Runner 的串并行与恢复边界](../assets/diagrams/harnesses/promptfoo/runtime.svg)

统一拆为 Planner、Scheduler、Target call、Scorer call、Persistence 五层——并发发生在哪层、缓存键覆盖哪层、retry 恢复哪层，必须明确。产品失败只能进入 Score，不能由 Harness retry 改写，所以依赖前序状态的步骤必须串行。

| Harness | 并发单位 | 缓存重点 | 恢复/Retry 风险 |
| --- | --- | --- | --- |
| lm-eval | request batch | LM response/request | 批处理顺序与 request identity |
| Inspect | sample/task/model call | model/API 与 log | retry 与 sample limit |
| OpenAI Evals | Eval 自己的 sample 执行 | 实现依 Eval/CompletionFn | Recorder fallback 不等于产品 retry |
| Promptfoo | RunEvalOptions | Provider response/result | 会话变量强制串行，resume 坐标 |
| DeepEval | TestCase/Metric coroutine | Metric/TestRun | 有状态 Metric 并发污染 |
| Harbor/TB | Trial | 完整 Trial/result | 残留目录不能冒充完成 |

## 完整流程

1. 从计划全集计算工作项，固定 Trial denominator；
2. 标注状态依赖、速率限制和资源约束，决定 batch/并发上限。
3. 为 Target 与 Judge 分别定义 timeout、retry 和预算；不要共享一个“retries”；
4. 缓存 key 覆盖输入、Target/Scorer identity、配置与代码版本；缓存命中写入证据来源。
5. 持久化每个完成项；恢复时核对 config/digest 和完整结果，清理不完整 artifact。
6. 报告 pass/fail/infra_error/metric_error/cancelled，不因 continue-on-error 缩小分母。

## 关键数据与不变量

并发上限不是实验身份的全部，实际调度、排队和限流也可能影响延迟。Cache hit 仍属于原 Trial，不增加观察数；Target 内部 retry 是产品行为；Harness Attempt 是基础设施恢复；Judge retry 是评分恢复。Resume 不能改变 Target、Dataset、Scorer 或 Gate policy 后复用旧行。

## 动手实验

将 refund 案例的 `max_concurrency` 从 1 改为 2，运行并比较结果顺序与 Trial ID：

```bash
uv run eval-harness-ref run reference/examples/refund-agent/eval.yaml --output output/refund-concurrent
uv run pytest tests/test_runtime_extensions.py -k concurrency -q
```

再假设某 Target 使用前一条输出作为下一条输入，说明应如何修改计划。

## 预期输出与答案

有限并发不应改变计划顺序、Trial ID、Score 或 Gate，Runner 返回顺序仍与计划一致；有跨步骤状态时，应把相关序列建模为单个 Trial 内的 episode，或显式依赖 DAG 并串行，而不是让独立 Trial 偷偷共享全局变量。

## 如何核对

对照 Promptfoo、DeepEval 和 Harbor 的执行课程，再查看 [`runner.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/runner.py) 的 `run_trial_batch` 与并发测试。

## 本篇不能证明什么

本地线程测试不能证明真实 Provider 速率限制、跨进程幂等、缓存完整性或分布式 exactly-once。它只锁住最大并发与计划顺序。

[上一节](01-task-dataset-target.md) · [下一节](03-trace-artifact-lineage.md)
