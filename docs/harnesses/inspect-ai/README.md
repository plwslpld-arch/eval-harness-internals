# Inspect AI 源码课程：把 Solver、Sandbox、Scorer 和 EvalLog 放进同一条链

[上一节](../lm-evaluation-harness/03-scoring-aggregation-tests.md) · [下一节](01-eval-task-solver.md)

## 本篇要解决什么问题

Inspect AI 不只是「另一套 benchmark runner」。它用 Dataset、Solver（求解器）、Scorer（评分器）和可选的 Sandbox 组成 Task，所以既能跑普通模型任务，也能评测会用工具、会改变状态的 Agent。读源码时，你要看清公共 `eval` 怎样解析 Task，`eval_run` 怎样给每项 Task 准备隔离环境和日志，`task_run` 又怎样执行每条 Sample，最后 Scorer 如何读取 TaskState 与 Target，并把评分写进结构化 EvalLog。

课程锁定提交 `ebf4815ee260afcc8c34ad9d66e6f8d98a89e905`。正文会把上游源码里能直接核对的类和调用写成源码事实，若把这些对象对应到 Trial、Attempt、Observation 和 Gate，则会明确标成机制解释，不会因为名称相近就假定两边字段一一对应。

## 先建立源码地图

| 站点 | 锁定源码 | 责任 |
| --- | --- | --- |
| 公共入口 | [`_eval/eval.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py) | 同步/异步 API、Task 解析、模型与运行上下文 |
| Task 调度 | [`_eval/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/run.py) | TaskRunOptions、SandboxManager、并发与 Task retry |
| 单 Task 执行 | [`_eval/task/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py) | Sample 生命周期、Solver Plan、Scorer 与日志更新 |
| Scorer 协议 | [`scorer/_scorer.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/scorer/_scorer.py) | `Scorer(state, target)`、注册、重建规格与 Metric 元数据 |
| 日志模型 | [`log/_log.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/log/_log.py) | EvalSpec、EvalSample、EvalPlan、EvalResults、EvalLog |

## 完整调用链

![Inspect AI 端到端评测链](../../assets/diagrams/harnesses/inspect-ai/end-to-end.svg)

1. `eval` 作为同步包装进入 `eval_async`，后者建立运行上下文，解析模型、Task 来源、审批和日志位置。
2. `eval_resolve_tasks` 把 Registry 名称、文件或 Task 对象解析成 ResolvedTask。同一入口还支持 TaskSource 动态注入。
3. `eval_run` 创建 SandboxManager，为每个 ResolvedTask 合并调用参数与 Task 默认值，解析 Solver、Scorer、Reducer，并生成 TaskLogger 与 TaskRunOptions。
4. `run_task_retry_attempts` 调度多项 Task 并按模型平衡并发；Task 出错或显式请求 retry 时可重新排队，已写出的失败日志仍保留，而不是被成功结果悄悄覆盖。
5. `_run_task` 调用 `task_run`。后者为 Dataset Sample 建立 TaskState，在 Sandbox 中运行 setup 和 Solver Plan，记录模型、工具、状态与错误事件。
6. Scorer 是异步 callable，接收最终 TaskState 与 Target；多个 Scorer 可分别产生 Score，跨 epoch 结果还可交给 Reducer。
7. EvalLog 汇总 EvalSpec、EvalConfig、EvalPlan、样本事件、Score、Metric、usage、stats 和 error，形成可查看与可重评分的运行证据。

## 关键数据结构

`EvalSample` 会保存 id、input、target、metadata、sandbox、files、setup、messages、output、scores、events、model_usage 和 error，`EvalPlan` 则按顺序记下 Solver steps。`EvalScore` 收下 Scorer 名、参数、Metric、scored_samples 和 unscored_samples，等这些对象都准备好后，`EvalLog` 再把 spec、plan、results、samples、stats 和 status 汇成一份日志。

和只给最终准确率的报告相比，这些对象留下的信息多得多，但它们不会自动变成内容寻址证据。日志可能按配置裁掉 explanation 和 metadata，也可能根本不写 Sample，所以你在把日志交给下游 Scorer 或审计器之前，必须先查清这次运行究竟记录到了哪一层。

## 实现取舍与失败语义

Task 可以选用不同 Sandbox，因此同一个 Solver 能在本地、Docker 或其他环境实现里运行，Agent 最后留下的环境状态也能交给评分器检查。代价也很具体：创建环境、复制文件、执行 setup 和 cleanup、应用网络策略，这些动作都会成为运行协议的一部分。Scorer 必须写成 async callable，方便 Judge（裁判模型）或外部检查并发执行，可日后能否复现，仍取决于模型身份和参数有没有记完整。

Task retry 和 Sample 没有通过评分是两件事。`run_task_retry_attempts` 只会因为整项 Task 出错，或收到 cancel/retry 请求而重新调度，`score_on_error` 则决定 Sample 执行异常后还要不要评分，普通 Score 没通过本身就是一条有效结果。若把这三种情况统称为「失败重试」，你最后解释统计结果时一定会算错。

## 动手实验

打开锁定的 `log/_log.py`，把 EvalSample 字段按输入身份、执行轨迹、评分结果、资源与错误分成四类，再用同样的方法整理 shipping Reference Harness 的 evidence.json，看看 Inspect AI 额外记录了哪些信息，本仓库又更强调哪些证据。

运行：

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

输入身份至少包括 id/input/target/metadata，执行过程会留下 sandbox/files/setup/messages/output/events，评分写进 scores，资源和错误则由 model_usage、total_time 与 error 记录。Inspect AI 对模型运行和 Sandbox 留下了更细的信息，Reference Harness 则会明确绑定 canonical Attempt、Artifact（产物）digest 和事先计划的 Trial 分母，两边正好可以互补，不能数一数字段多少就判断谁更完整。

来源锁应该验证 8 项。只要这门课程的四篇文章还没全部写好，课程合同就该继续失败，防止有人用一篇概览冒充完整课程。

## 如何核对

先在 [`_eval/eval.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py) 搜索 `eval_async`、`eval_resolve_tasks` 和 `eval_run`，看入口怎样把参数传下去，再到 [`_eval/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/run.py) 找 `TaskRunOptions` 与 `run_task_retry_attempts`，最后去 [`_eval/task/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py) 跟进 `task_run`。每往下走一层，都要记下谁调用它、传入了什么、状态怎样变化以及最后返回什么。

## 本篇不能证明什么

结构化 EvalLog 只能告诉你运行记录成了什么样，不能证明 Sandbox 已经彻底隔离、Judge 确实有效，也不能证明 Dataset 足够代表线上任务。Inspect AI 的 Task retry 也不能直接等同于本仓库的 Attempt，只有先把失败怎样分类、统计怎样计划说清楚，才能可靠地映射这两个对象。

[上一节](../lm-evaluation-harness/03-scoring-aggregation-tests.md) · [下一节](01-eval-task-solver.md)
