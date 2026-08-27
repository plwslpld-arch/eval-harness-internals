# 横向比较二：Runner、并发、缓存与 Retry

[上一节](01-task-dataset-target.md) · [下一节](03-trace-artifact-lineage.md)

## 本篇要解决什么问题

每套 Harness 都提供了与吞吐有关的功能，但 lm-eval 批量发送请求，Inspect 按 task/sample 并发并管理 retry，Promptfoo 展开矩阵后还要检查哪些特性必须串行，DeepEval 使用 asyncio semaphore，而 Harbor 并发执行 Trial 并负责恢复目录，它们解决的其实不是同一个问题。缓存也一样，有的只保存模型响应，有的保存评分甚至完整 Trial。只比较「是否支持并发或重试」，会把最要紧的正确性风险藏起来。

## 核心机制

![Runner 的串并行与恢复边界](../assets/diagrams/harnesses/promptfoo/runtime.svg)

把运行过程统一拆成 Planner、Scheduler、Target call、Scorer call 和 Persistence 五层之后，必须继续追问并发发生在哪一层、缓存键覆盖到哪一层，以及 retry 究竟恢复哪一层——这些位置一旦含混，速度提升就可能改写实验语义。产品失败只能进入 Score，不能被 Harness retry 洗掉，因此依赖前序状态的步骤必须保持串行。

| Harness | 并发单位 | 缓存重点 | 恢复/Retry 风险 |
| --- | --- | --- | --- |
| lm-eval | request batch | LM response/request | 批处理顺序与 request identity |
| Inspect | sample/task/model call | model/API 与 log | retry 与 sample limit |
| OpenAI Evals | Eval 自己的 sample 执行 | 实现依 Eval/CompletionFn | Recorder fallback 不等于产品 retry |
| Promptfoo | RunEvalOptions | Provider response/result | 会话变量强制串行，resume 坐标 |
| DeepEval | TestCase/Metric coroutine | Metric/TestRun | 有状态 Metric 并发污染 |
| Harbor/TB | Trial | 完整 Trial/result | 残留目录不能冒充完成 |

## 完整流程

1. 从计划全集计算工作项，固定 Trial denominator。
2. 标注状态依赖、速率限制和资源约束，决定 batch/并发上限。
3. 为 Target 与 Judge 分别定义 timeout、retry 和预算，不要共享一个「retries」。
4. 缓存 key 覆盖输入、Target/Scorer identity、配置与代码版本，缓存命中写入证据来源。
5. 持久化每个完成项，恢复时核对 config/digest 和完整结果，清理不完整 artifact。
6. 报告 pass/fail/infra_error/metric_error/cancelled，不因 continue-on-error 缩小分母。

## 关键数据与不变量

并发上限只是实验条件的一部分，因为实际调度、排队方式与限流策略同样会改变延迟表现。Cache hit 仍然归属于原 Trial，不能因此增加观察数，而 Target 内部 retry 属于产品行为，Harness Attempt 用来恢复基础设施，Judge retry 才是评分恢复。边界别混了。只要 Target、Dataset、Scorer 或 Gate policy 发生变化，Resume 就不能继续复用旧行。

## 动手实验

将 refund 案例的 `max_concurrency` 从 1 改为 2，运行并比较结果顺序与 Trial ID：

```bash
uv run eval-harness-ref run reference/examples/refund-agent/eval.yaml --output output/refund-concurrent
uv run pytest tests/test_runtime_extensions.py -k concurrency -q
```

接着假设某个 Target 会把前一条输出用作下一条输入，并据此说明计划需要怎样调整，才能让状态依赖保持显式。

## 预期输出与答案

有限并发不应改变计划顺序、Trial ID、Score 或 Gate，而且 Runner 的返回顺序仍要与计划一致。如果步骤之间共享状态，就应当把相关序列建模成单个 Trial 内的 episode，或者通过显式依赖 DAG 安排串行执行，而不能让名义上独立的 Trial 偷偷共用全局变量。

## 如何核对

先对照 Promptfoo、DeepEval 和 Harbor 的执行课程，看清三者分别在哪一层并发与恢复，再查看 [`runner.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/runner.py) 的 `run_trial_batch` 与并发测试。

## 本篇不能证明什么

本地线程测试只能锁住最大并发与计划顺序，无法证明真实 Provider 的速率限制、跨进程幂等、缓存完整性或分布式 exactly-once。证据到此为止。

[上一节](01-task-dataset-target.md) · [下一节](03-trace-artifact-lineage.md)
