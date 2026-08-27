# 03｜Scorer、EvalLog 与 Retry：怎样保留可重评分的运行事实

[上一节](02-sandbox-sample-run.md) · [下一节](../../contents.md)

## 本篇要解决什么问题

Inspect AI 既能保存完整 EvalLog，也允许 Sample retry、Task retry、score_on_error、多个 Scorer（评分器）和跨 epoch 的 Reducer（归并器）同时工作。功能一多，解释结果时更得把边界看清：失败后重试产生的结果怎样写进日志，Scorer 能不能按记录重建，未评分样本会不会从分母里悄悄消失，Task retry 又是否会拿成功尝试盖住失败历史？这一篇把评分和恢复两条路径分别追到最终保存的对象上。

## 先建立源码地图

评分相关的四个对象都能在锁定的 `scorer/_scorer.py` 中找到，而且职责分得很清楚：[Scorer Protocol](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/scorer/_scorer.py#L34-L65) 规定怎样调用评分器，[`ScorerSpec`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/scorer/_scorer.py#L66-L88) 保存注册时留下的元数据，[`@scorer` 装饰器](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/scorer/_scorer.py#L133-L206) 把对象包装进 Registry（注册表），[`scorer_metrics`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/scorer/_scorer.py#L252-L261) 则取出 Metric 元数据。Sample 怎样调用 Scorer、Reducer 怎样参与处理、Task 怎样汇总结果，都要从三千多行的 [`task_run()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L465-L505) 入口往下追。整项 Task 的重试由 [`eval_run()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/run.py#L123-L163) 调度，至于日志最终长什么样，则由 [`EvalSample`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/log/_log.py#L410-L450)、[`EvalScore`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/log/_log.py#L744-L784) 和 [`EvalLog`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/log/_log.py#L1141-L1181) 一起规定。

## 完整调用链

![Inspect AI 评分、日志与恢复链](../../assets/diagrams/harnesses/inspect-ai/scoring-retry.svg)

1. `eval_run` 把 Task 的 Scorer 转为 ScorerSpec，保存 Registry 名、构造参数、metadata 和 Metric 规格；未通过 `@scorer` 创建的对象无法可靠记录为可重建规格。
2. `task_run` 为多个 Scorer 生成唯一名字。每个 Sample 完成 Solver 后，依次执行 `await scorer(state, Target(sample.target))`。
3. Score 写入 TaskState.scores、ScoreEvent 和 SampleScore；Scorer 若直接篡改同名 state.scores，运行会检测冲突。
4. 多 epoch 的同一 Sample 可由 Reducer 合并；与此同时，Task 结果明确保存每个 Scorer 的 scored_samples 与 unscored_samples，而不是只给一个平均值。
5. TaskLogger 把 EvalSpec、Plan、Samples、Results、Stats 和 Error 写成 EvalLog，而 `log_header_only` 或关闭 log_samples 会改变可审计深度，必须进入运行配置。
6. Sample error 先消费 `retry_on_error`；Task error 或显式 cancel/retry 由 `run_task_retry_attempts` 重新排队，Task retry 新建日志 entry，并从失败日志构造 SampleSource 复用已完成 Sample。
7. 调度器按原 index 返回最新 Task 结果，但失败日志位置仍存在，因此外层审计必须把多条 entry 视为恢复历史，不能只看最后一条。

## 关键数据结构

`ScorerSpec(scorer, args, metadata, metrics)` 记下以后怎样重建评分器，`EvalSample.scores` 则按 scorer-name 保存各个 Score。再沿着写盘路径往外看，`EvalScore` 会收下 name/scorer、参数、Metric、scored_samples、unscored_samples 和 metadata，`EvalResults.scores` 把各个 Scorer 的结果汇在一起，最后 `EvalLog` 才把 status、eval spec、plan、samples、results、stats、error 和 location 装进一条完整日志。

Reference Harness 会让 ScoreRecord 强制绑定 canonical Attempt 和 Observation digest，Inspect AI 则更看重 TaskState、Sample events 以及能按记录重建的 Scorer。给两者做 Adapter（适配器）时，若缺少严格 digest 或 canonical 语义，就该老实标成 partial，不能看字段名字相近便宣称完全对应。

## 实现取舍与失败语义

把 Scorer 注册进 Registry 后，其他人更容易按日志重评分或共享它，可动态闭包和本地对象如果记不下构造参数，后面就很难复现。多个 Scorer 配合 Reducer 能表达更丰富的评测方式，但每个 Metric 仍要各自写明分母以及 reducer 怎样归并。缺失不能藏起来。`scored_samples` 和 `unscored_samples` 就是在告诉你有多少样本没有得分，所以发布 Gate 不能只读已评分子集的平均值。

Sample retry 会重新创建状态，适合拿来处理瞬时错误，如果模型只是答错、运行并未异常，就不该触发 retry_on_error。Task retry 可以复用已经完成的 Sample，省下一部分成本，但前提是 Task、Model、Sandbox 和 Scorer 都没有换身份，而且新日志必须能追溯到原来的失败日志。源码注释还把 retry、abort、score/error graceful resolution 和外部取消分别处理，只有任务确实出错或收到明确的 retry，并且重试预算还没用完，调度器才会把它重新排队。

## 动手实验

设想一次运行事先计划了 100 条 Sample，其中 90 条拿到 Score，具体是 80 passed、10 failed，另有 5 条遇到 Solver error 且 score_on_error=false，还有 5 条被 Scorer 返回 None。请分别计算「只在 scored samples 上的通过率」和「以计划 Sample 为分母的通过率」，然后判断 Gate 应该给出 passed、failed 还是 inconclusive。

再比较两条恢复路径：一条是 Sample 23 首次调用 API 时超时，retry 后成功，另一条是 Task 写日志时失败，随后 Task retry 复用已经完成的 Sample。请画清每条路径里第一次错误、后续重试和最终 Score 怎样关联。

## 预期输出与答案

只看已经评分的子集，通过率是 80/90≈88.9%，若把事先计划的全部 Sample 放进分母，结果就是 80/100=80%。假如政策要求至少达到 85%，同时规定关键缺失不能忽略，Gate 就不能拿 88.9% 判为 passed，而要因为 10 条 Sample 没有评分而给出 inconclusive，或者按事先声明的保守政策判为 failed。这项选择必须提前定好。

Sample retry 应把第一次错误留在 error_retries 里，再让新状态产生的 Score 进入结果。Task retry 则要保留失败的 EvalLog，并让新的 entry 记录复用过的 SampleSource 和这一次 Task 尝试。两条恢复路径都不能伪装成「从未失败过」。

## 如何核对

先在 [`scorer/_scorer.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/scorer/_scorer.py#L207-L222) 看 Scorer Protocol、装饰器和 `as_scorer_spec` 怎样配合，再从 [`task_run()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L465-L505) 进入 Task 主循环，跟着 [Reducer 参与的指标刷新](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L850-L877) 和 [重排队时怎样处理未评分样本](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L1301-L1310) 两段代码看清状态怎样变化。最后到 [`_eval/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/run.py#L590-L629) 阅读 `run_task_retry_attempts`，核对它怎样根据 cancel_type 和 result.status 选择分支。

## 本篇不能证明什么

日志字段再齐全，也只能让你看见评分和恢复怎样串起来，不能证明 Scorer 已经校准、Judge 没有偏差，更不能保证外部服务变化以后，Task retry 前后的结果还可以直接比较。独立的发布 Gate 仍要固定身份、分母和缺失政策。

[上一节](02-sandbox-sample-run.md) · [下一节](../../contents.md)
