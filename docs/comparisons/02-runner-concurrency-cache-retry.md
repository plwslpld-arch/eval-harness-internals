# 横向比较二：Runner、并发、缓存与 Retry

[上一节](01-task-dataset-target.md) · [下一节](03-trace-artifact-lineage.md)

## 本篇要解决什么问题

每套 Harness 都提供提升吞吐的办法，可它们动手的位置并不相同：lm-eval 批量发送请求，Inspect 按 task/sample 并发运行并管理 retry，Promptfoo 展开矩阵以后还要找出哪些特性只能串行执行，DeepEval 用 asyncio semaphore 控制并发，Harbor 则同时执行多个 Trial，并在中断后检查和恢复目录。缓存也有同样的差别，有的只存模型响应，有的连评分甚至整个 Trial 都存下来。如果只问「是否支持并发或重试」，真正影响结果是否可信的风险反而会被藏住。

## 核心机制

![Runner 的串并行与恢复边界](../assets/diagrams/harnesses/promptfoo/runtime.svg)

把运行过程拆成 Planner、Scheduler（调度器）、Target call、Scorer call 和 Persistence 五层以后，你还得继续问：系统在哪一层并发，缓存键能区分到哪一层，retry 又从哪一层重新开始？这些位置只要说不清，提速就可能连实验含义一起改掉。产品失败只能记进 Score，Harness retry 不能把它冲掉，所以依赖前一步状态的操作仍要串行执行。

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

并发上限只是实验条件的一部分，Scheduler 怎样安排工作、请求怎样排队、限流规则怎样生效，同样会改变延迟。命中 Cache 的结果仍归原 Trial，不能因此多算一次观察。Target 内部 retry 是产品自己的行为，Harness Attempt 用来恢复基础设施，Judge（裁判模型）的 retry 才是在恢复评分。这三条边界不能混。只要 Target、Dataset、Scorer 或 Gate policy 有一项发生变化，Resume 就不能沿用旧行。

## 动手实验

将 refund 案例的 `max_concurrency` 从 1 改为 2，运行并比较结果顺序与 Trial ID：

```bash
uv run eval-harness-ref run reference/examples/refund-agent/eval.yaml --output output/refund-concurrent
uv run pytest tests/test_runtime_extensions.py -k concurrency -q
```

然后假设某个 Target 会把前一条输出作为下一条输入，并说明计划该怎样调整，才能把这层状态依赖明确写出来。

## 预期输出与答案

有限并发不能改变计划顺序、Trial ID、Score 或 Gate，Runner 返回结果的顺序也要和计划一致。如果几个步骤共享状态，就把这段序列放进同一个 Trial 的 episode，或者用显式依赖 DAG 安排它们依次执行，不能让名义上相互独立的 Trial 暗中共用全局变量。

## 如何核对

先对照 Promptfoo、DeepEval 和 Harbor 的执行课程，查清三者分别在哪一层启动并发、又从哪一层恢复，然后查看 [`runner.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/runner.py) 的 `run_trial_batch` 与并发测试。

## 本篇不能证明什么

本地线程测试只能确认最大并发和计划顺序符合预期，至于真实 Provider 怎样限速、跨进程操作能否保持幂等、缓存是否完整，以及分布式 exactly-once 能不能成立，它都证明不了。证据到这里就停。

[上一节](01-task-dataset-target.md) · [下一节](03-trace-artifact-lineage.md)
