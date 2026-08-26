# 03｜Scorer、EvalLog 与 Retry：怎样保留可重评分的运行事实

[上一节](02-sandbox-sample-run.md) · [下一节](../../contents.md)

## 本篇要解决什么问题

Inspect AI 既能保存完整 EvalLog，也支持 Sample retry、Task retry、score_on_error、多个 Scorer 和 epoch Reducer，但功能越丰富，解释结果时越容易踩中边界问题：一次失败后重试的结果怎样进入日志？Scorer 身份能否重建？未评分样本是否从分母消失？Task retry 会不会用成功尝试覆盖失败历史？本节会把评分与恢复分别追到持久化对象。

## 先建立源码地图

Scorer 侧的四个对象都在锁定 `scorer/_scorer.py`，而且各自占据一段清晰的代码：[Scorer Protocol](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/scorer/_scorer.py#L34-L65) 定义调用契约，[`ScorerSpec`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/scorer/_scorer.py#L66-L88) 承载注册元数据，[`@scorer` 装饰器](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/scorer/_scorer.py#L133-L206) 完成 Registry 包装，[`scorer_metrics`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/scorer/_scorer.py#L252-L261) 取出 Metric 元数据。Sample Scorer 调用、Reducer 和 Task 结果聚合都在 [`task_run()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L465-L505)，这个文件有三千多行，入口就在这里，而 Task 级重试调度位于 [`eval_run()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/run.py#L123-L163)，日志 Schema 则由 [`EvalSample`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/log/_log.py#L410-L450)、[`EvalScore`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/log/_log.py#L744-L784) 和 [`EvalLog`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/log/_log.py#L1141-L1181) 三个模型共同描述。

## 完整调用链

![Inspect AI 评分、日志与恢复链](../../assets/diagrams/harnesses/inspect-ai/scoring-retry.svg)

1. `eval_run` 把 Task 的 Scorer 转为 ScorerSpec，保存 Registry 名、构造参数、metadata 和 Metric 规格；未通过 `@scorer` 创建的对象无法可靠记录为可重建规格。
2. `task_run` 为多个 Scorer生成唯一名字。每个 Sample 完成 Solver 后，依次执行 `await scorer(state, Target(sample.target))`。
3. Score 写入 TaskState.scores、ScoreEvent 和 SampleScore；Scorer 若直接篡改同名 state.scores，运行会检测冲突。
4. 多 epoch 的同一 Sample 可由 Reducer 合并；与此同时，Task 结果明确保存每个 Scorer 的 scored_samples 与 unscored_samples，而不是只给一个平均值。
5. TaskLogger 把 EvalSpec、Plan、Samples、Results、Stats 和 Error 写成 EvalLog，而 `log_header_only` 或关闭 log_samples 会改变可审计深度，必须进入运行配置。
6. Sample error 先消费 `retry_on_error`；Task error 或显式 cancel/retry 由 `run_task_retry_attempts` 重新排队，Task retry 新建日志 entry，并从失败日志构造 SampleSource 复用已完成 Sample。
7. 调度器按原 index 返回最新 Task 结果，但失败日志位置仍存在，因此外层审计必须把多条 entry 视为恢复历史，不能只看最后一条。

## 关键数据结构

`ScorerSpec(scorer, args, metadata, metrics)` 记录如何重建评分器，而 `EvalSample.scores` 是 scorer-name 到 Score 的映射。沿着持久化层继续往外看，`EvalScore` 保存 name/scorer、参数、Metric、scored_samples、unscored_samples 和 metadata，`EvalResults.scores` 汇总各 Scorer，最后由 `EvalLog` 保存 status、eval spec、plan、samples、results、stats、error 与 location。

Reference Harness 的 ScoreRecord 强制绑定 canonical Attempt 与 Observation digest，而 Inspect AI 更强调 TaskState、Sample events 和可重建 Scorer，因此做 Adapter 时，应把缺少的严格 digest 或 canonical 语义标为 partial，不能因为字段相似就声称完全对应。

## 实现取舍与失败语义

Registry Scorer 方便后续根据日志重评分和共享，但如果动态闭包或本地对象无法记录构造参数，可复现性就会下降。多个 Scorer 与 Reducer 支持更丰富的评测，不过每个 Metric 都必须明确自己的分母和 reducer 语义。缺失不能藏起来——`scored_samples`/`unscored_samples` 正是暴露缺失的重要信号，因此发布 Gate 不应只读取已评分子集的平均值。

Sample retry 会重建状态，所以适合处理瞬时错误，而模型只是答错却没有异常时，不应进入 retry_on_error。Task retry 复用已经完成的 Sample 可以节省成本，但前提是 Task、Model、Sandbox 和 Scorer 的身份都没有改变，并且失败日志与新日志之间的关联可追踪。源码注释还明确区分了 retry、abort、score/error graceful resolution 与外部取消，只有发生错误或收到显式 retry，并且预算尚未耗尽时，任务才会重新排队。

## 动手实验

构造一个包含 100 个计划 Sample 的思想实验，其中 90 个有 Score，具体是 80 passed、10 failed，另有 5 个 Solver error 且 score_on_error=false，还有 5 个 Scorer 返回 None。分别计算“只在 scored samples 上的通过率”和“以计划 Sample 为分母的通过率”，再决定 Gate 应该是 passed、failed 还是 inconclusive。

接着比较两种恢复路径：第一种是 Sample 23 首次调用 API 超时，随后 retry 成功，第二种是 Task 在日志写入阶段失败，Task retry 因而复用已经完成的 Sample。请画出两种路径中应该保留的错误、重试和最终 Score 关系。

## 预期输出与答案

只看已评分子集时，通过率是 80/90≈88.9%，而改用计划分母后则是 80/100=80%。如果政策要求达到 85%，同时又规定关键缺失不可忽略，Gate 就不能按 88.9% 判为 passed，而应因为 10 个未评分样本判为 inconclusive，或按预声明的保守政策判为 failed。选择必须在运行前声明。

Sample retry 应保留第一次 error_retries，并让新状态产生的 Score 进入结果，而 Task retry 应保留失败的 EvalLog，再由新 entry 记录复用的 SampleSource 和新的 Task 尝试。两种恢复都不能伪装成“从未失败过”。

## 如何核对

在 [`scorer/_scorer.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/scorer/_scorer.py#L207-L222) 查看 Scorer Protocol、装饰器和 `as_scorer_spec`，再从 [`task_run()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L465-L505) 进入 Task 主循环，查看 [Reducer 参与的指标刷新](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L850-L877) 和 [重排队时怎样处理未评分样本](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L1301-L1310)。最后在 [`_eval/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/run.py#L590-L629) 阅读 `run_task_retry_attempts` 对 cancel_type 和 result.status 的分支。

## 本篇不能证明什么

日志字段齐全只能提供恢复与评分的可见结构，不能证明 Scorer 已经校准、Judge 没有偏差，也不能保证外部服务变化后的 Task retry 仍可比较。独立发布 Gate 仍需固定身份、分母和缺失政策。

[上一节](02-sandbox-sample-run.md) · [下一节](../../contents.md)
