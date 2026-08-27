# DeepEval 执行策略：异步、缓存与错误不能改变统计单位

[上一节](02-metric-execution.md) · [下一节](../harbor-terminal-bench/README.md)

## 本篇要解决什么问题

当 Judge 调用既昂贵又缓慢时，异步并发、缓存和忽略错误就成了必要的工程能力——可它们也最容易让评测数字失真。并发可能污染有状态 Metric，缓存可能复用过期评分，ignore_errors 可能改变分母，而失败后重跑还可能把同一个测试变成多个独立观察。下文会从 DeepEval 的 AsyncConfig、CacheConfig、ErrorConfig 和 agentic loop 出发，把恢复行为与统计边界一一对齐。

这里关心的不是「打开哪个参数会更快」，而是每个参数究竟改变了执行调度、评分调用、证据记录，还是外部测试行为，因为任何优化都必须保持 Sample/Trial 身份、结果完整性与错误可见性。

## 先建立源码地图

| 源码位置 | 责任 | 核对问题 |
| --- | --- | --- |
| [`deepeval/evaluate/evaluate.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/evaluate.py) | 配置默认值、同步/异步选择、收尾 | 参数怎样进入执行器 |
| [`deepeval/evaluate/execute/loop.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/execute/loop.py) | semaphore、任务、cache/error 和 TestRun | 并发与异常怎样传播 |
| [`deepeval/metrics/base_metric.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/metrics/base_metric.py) | 有状态测量对象 | 并发隔离需要保护什么 |

## 完整调用链

![DeepEval 异步、缓存与错误处理边界](../../assets/diagrams/harnesses/deepeval/execution-policy.svg)

1. `evaluate` 接收 AsyncConfig、CacheConfig 和 ErrorConfig；异步模式取得事件循环并调用异步执行器，同步模式直接顺序执行；
2. 异步 agentic loop 创建 `asyncio.Semaphore(max_concurrent)`，把每个用户 callback 绑定到当前事件循环并受信号量控制，避免无限并发和跨 loop Future 混用；
3. Target/user code 结束后捕获 trace，构造 TestCase；执行器为 metrics 计算缓存键，命中时复用 MetricData，未命中才运行 `a_measure`/`measure`；
4. Metric 或 trace 发生错误时，ErrorConfig 决定是否抛出或把 error 写入结果继续，继续不代表成功，后续汇总必须保留不可评分状态；
5. CacheConfig 区分 use_cache 与 write_cache，TestRunManager 的磁盘保存行为随配置改变，但缓存与最终证据存储不是同一概念；
6. 任务完成后，每个 TestCase 更新 TestRun；异步任务集合属于当前 iterator run，结束时一次性归集，避免状态泄漏到下一事件循环；
7. 入口记录 run_duration、超参数和输出；在 CLI 测试模式中由 CLI 统一 finalize，普通 evaluate 才自行 wrap-up，避免重复收尾。

## 关键数据结构

AsyncConfig 至少要表达 run_async、max_concurrent、throttle 等调度政策，CacheConfig 负责描述缓存读取与写入行为，ErrorConfig 则说明 ignore_errors 和跳过策略，而这些配置都应该进入 RunManifest。这些配置属于运行身份。Semaphore 只能限制「同时进行的协程数」，并不会提供 Trial 身份、顺序或事务语义。缓存值也不能只有一个分数，因为只有同时携带 test case 摘要、metric identity/config、Judge model、代码版本与输出 schema，后续命中才有办法审计。

错误结果需要使用 target_error、trace_error、metric_error、timeout、cancelled、cache_corrupt 等机器可读类型，不能只留下一段消息。Reference Harness 的 Trial/Attempt 模型可以把基础设施重试留在同一 Trial 下面，并从中选定一个 canonical Attempt，但 DeepEval 入口本身不会自动为外部 Target 重试建立这套统计合同。

## 实现取舍与失败语义

高并发可以缩短墙钟时间，却也可能触发 Provider 429、共享 Metric 状态覆盖、输出顺序变化与费用激增。信号量只给出并发上限——真正安全的数值还取决于 Judge 速率限制、内存和对象隔离，而缓存虽然能降低成本与随机漂移，却可能掩盖模型或模板升级，所以它必须可以关闭，并在实验身份变化时失效。缓存命中也要留痕。

ignore_errors 适合在长批次中继续收集诊断，但发布分析必须先报告评测错误率与缺失模式。错误项必须单独报告。缺失也要保留分类。如果直接删除错误样本，就会产生 complete-case 偏差，而把 error 当成 0 分又会混淆产品质量与 Harness 健康。更稳妥的输出是把 pass、fail 和 error 分层呈现，并允许 Gate 在关键错误仍然存在时给出 inconclusive。

## 动手实验

设有 100 个测试，其中 90 个完成且 72 个通过，另外 5 个遇到 Judge 超时，5 个出现 Target 错误。请分别计算「仅完成项通过率」和「按全体样本通过率」，并说明两种口径各自遗漏了什么。然后设计一个缓存键，列出必须覆盖的 TestCase、Metric 与依赖字段，最后模拟 max_concurrent=20 引发限流，比较降低并发、Judge 内部 retry 和重跑整个 Trial 所留下的证据差异。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

如果仅完成项口径排除所有错误，分母就是 90，通过率为 80%，而全体样本口径的分母是 100，已证实通过率为 72%。前一种算法掩盖了 10% 的缺失，后一种算法又不能说明错误样本原本会通过还是失败，所以结果应同时报告 72 pass、18 fail、5 judge error 与 5 target error，再交给 Gate 按预注册规则处理。

缓存键至少要包含规范化 TestCase 的输入、输出与上下文摘要，还要覆盖 Metric 类及配置、阈值之外的测量参数、Judge 模型与 prompt、代码 commit 和依赖版本。限流 retry 只是同一评分 Attempt 内的传输恢复，而重跑整个 Trial 会重新产生 Target 与评分证据，因此必须保留旧 Attempt，也不能借此增加独立样本数。

## 如何核对

先在 [`deepeval/evaluate/evaluate.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/evaluate.py#L180-L219) 查看三种 Config 如何传入执行器，并找到 CLI finalize 分支，然后到 [`deepeval/evaluate/execute/loop.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/execute/loop.py#L167-L206) 搜索 Semaphore、tasks、cache_config、error_config、MetricData 与 TestRun update，顺着这些状态核对执行边界。

## 本篇不能证明什么

信号量、缓存和错误记录都不能证明线程安全、缓存键完整、远程服务稳定或统计无偏，而是否允许 ignore_errors 通过 CI 属于组织政策，不能交给库的默认值替代。

[上一节](02-metric-execution.md) · [下一节](../harbor-terminal-bench/README.md)
