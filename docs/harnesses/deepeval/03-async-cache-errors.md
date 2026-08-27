# DeepEval 执行策略：异步、缓存与错误不能改变统计单位

[上一节](02-metric-execution.md) · [下一节](../harbor-terminal-bench/README.md)

## 本篇要解决什么问题

Judge（裁判模型）调用又慢又贵时，你自然会想到开异步并发、加缓存，或者让程序遇错继续跑，可这几项设置也最容易把评测数字带偏。并发可能让有状态 Metric 的实例状态互相污染，缓存可能拿出已经过期的评分，ignore_errors 可能悄悄改掉分母，失败后整轮重跑还可能把同一个测试算成多个独立观测。这里从 DeepEval 的 AsyncConfig、CacheConfig、ErrorConfig 和 agentic loop 入手，看每种恢复办法应该落在哪条统计边界内。

重点不在于「打开哪个参数会更快」，你真正要查的是每个参数究竟改动了哪一层：任务怎么调度，评分怎么调用，证据怎么落盘，外部测试又怎么运行。无论怎样优化，都不能弄乱 Sample/Trial 身份，也不能丢掉结果或藏起错误。并发不会创造独立样本。分母也不能暗改。

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

AsyncConfig 至少要写清 run_async、max_concurrent、throttle 等调度规则，CacheConfig 说明缓存怎么读写，ErrorConfig 则规定 ignore_errors 和跳过策略，这些配置都要记进 RunManifest，因为它们共同标识了这次运行。Semaphore 只能限制「同一时刻有多少协程在跑」，不会替你标记 Trial，也不保证执行顺序或事务。缓存里也不能只存一个分数，必须连同 test case 摘要、metric identity/config、Judge model、代码版本和输出 schema 一起保存，之后命中缓存时才查得清来路。

记录错误时，要用 target_error、trace_error、metric_error、timeout、cancelled、cache_corrupt 等机器可读类型，不能只扔下一段文字。Reference Harness 会把基础设施重试都挂在同一个 Trial 下面，再从这些 Attempt 里选出 canonical Attempt，但 DeepEval 的入口不会自动替外部 Target 的重试建立这层关系，你得自己补上。

## 实现取舍与失败语义

高并发可以缩短实际等待时间，却也可能触发 Provider 429，让多个任务覆盖同一个 Metric 的状态，打乱输出顺序，甚至让费用突然上涨。信号量只管并发上限，究竟设多大才安全，还得看 Judge 的速率限制、可用内存和对象有没有隔离。缓存可以少花钱，也能减少随机波动，可它可能遮住模型或模板已经升级的事实，因此必须允许关闭，并在实验身份改变时失效。这里要留痕。

ignore_errors 适合让长批次在出错后继续跑，好把诊断信息尽量收齐，但做发布分析时，必须先报告评测错误率以及哪些样本缺了结果。错误项要单列，缺失也要分类。若直接删掉报错样本，complete-case 偏差就进来了，若把 error 一律记成 0 分，又会把产品质量和 Harness 健康混在一起。错误不会因此消失。更稳妥的做法是分开列出 pass、fail 与 error，只要关键错误还没解决，Gate 就可以给出 inconclusive。

## 动手实验

假设一共有 100 个测试，其中 90 个顺利完成、72 个通过，另外 5 个遇到 Judge 超时，还有 5 个出现 Target 错误。请分别计算「仅完成项通过率」与「按全体样本通过率」，再说明两种算法各自看漏了什么。然后设计缓存键，列出其中必须覆盖的 TestCase、Metric 和依赖字段。最后模拟 max_concurrent=20 引发限流，比较降低并发、在 Judge 内部 retry 与重跑整个 Trial 各会留下什么证据。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

只看完成项时，所有错误都会被排除，分母是 90，通过率为 80%；按全体样本计算，分母是 100，目前能够证实的通过率为 72%。前一种算法藏住了 10% 的缺失，后一种算法又说不出报错样本原本会通过还是失败，所以报告里要同时列出 72 pass、18 fail、5 judge error 和 5 target error，再让 Gate 按预先登记的规则处理。

缓存键至少要包括规范化 TestCase 的输入、输出和上下文摘要，还要把 Metric 类及配置、阈值之外的测量参数、Judge 模型与 prompt、代码 commit、依赖版本都算进去。限流后的 retry 只是同一个评分 Attempt 里的传输恢复，重跑整个 Trial 却会重新生成 Target 输出和评分证据，因此旧 Attempt 必须留下，也不能因为重跑过就增加独立样本数。

## 如何核对

先看 [`deepeval/evaluate/evaluate.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/evaluate.py#L180-L219)，确认三种 Config 怎样传进执行器，并找到 CLI finalize 所在的分支。再去 [`deepeval/evaluate/execute/loop.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/execute/loop.py#L167-L206) 搜索 Semaphore、tasks、cache_config、error_config、MetricData 和 TestRun update，沿着状态怎么变化来核对执行边界。

## 本篇不能证明什么

用了信号量、缓存和错误记录，也证明不了代码一定线程安全、缓存键没有漏项、远程服务始终稳定，或统计结果没有偏差。至于 CI 能不能在 ignore_errors 开启时放行，这是组织要定的政策，不能让库的默认值替你做决定。

[上一节](02-metric-execution.md) · [下一节](../harbor-terminal-bench/README.md)
