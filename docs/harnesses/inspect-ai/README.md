# Inspect AI 源码课程：把 Solver、Sandbox、Scorer 和 EvalLog 放进同一条链

[上一节](../lm-evaluation-harness/03-scoring-aggregation-tests.md) · [下一节](01-eval-task-solver.md)

## 本篇要解决什么问题

Inspect AI 不只是「另一套 benchmark runner」。它把 Task 定义成 Dataset、Solver、Scorer 与可选 Sandbox 的组合，因此既能运行普通模型任务，也能处理带工具和状态的 Agent Eval。阅读源码时真正需要理清的是，公共 `eval` 怎样解析 Task，`eval_run` 怎样为每项 Task 准备隔离环境与日志，`task_run` 怎样执行每个 Sample，以及 Scorer 怎样读取 TaskState 和 Target，再把结果写回结构化 EvalLog。

本课程固定在提交 `ebf4815ee260afcc8c34ad9d66e6f8d98a89e905`，正文会把上游直接可见的类和调用标为源码事实，而当这些对象被映射到 Trial、Attempt、Observation 和 Gate 时，也会明确说明那是机制解释，不会假设两边字段一一相同。

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

`EvalSample` 保存 id、input、target、metadata、sandbox、files、setup、messages、output、scores、events、model_usage 与 error，`EvalPlan` 保存 Solver steps。`EvalScore` 保存 Scorer 名、参数、Metric、scored_samples 和 unscored_samples，`EvalLog` 再把 spec、plan、results、samples、stats 和 status 组合起来。

这些对象比只含最终准确率的报告丰富得多，但并不会自动成为内容寻址证据，因为日志可以裁剪 explanation 和 metadata，样本也可能因配置而不写入，所以使用下游 Scorer 或审计器之前，仍要先查清实际记录级别。

## 实现取舍与失败语义

把 Sandbox 与 Task 并列是一项关键设计，因为同一 Solver 可以在本地、Docker 或其他环境实现中运行，Agent 终态也能进入评分。代价同样具体——环境创建、文件复制、setup、cleanup 和网络策略都会成为运行协议的一部分。Scorer 必须是 async callable，这便于 Judge 或外部检查并发运行，但它能否复现，仍取决于模型和参数有没有完整记录。

Task retry 与 Sample 评分失败不是一回事。`run_task_retry_attempts` 会针对整项 Task 的错误或 cancel/retry 请求重新调度，而 `score_on_error` 决定 Sample 执行异常后是否仍要评分，至于普通 Score 不通过，它本身就是有效评测结果。如果把这三种情况都叫作「失败重试」，统计解释就会失真。

## 动手实验

从锁定 `log/_log.py` 列出 EvalSample 中属于四类的字段：输入身份、执行轨迹、评分结果、资源/错误，然后对 shipping Reference Harness 的 evidence.json 做同样分类，找出 Inspect AI 多记录了什么、本仓库多强调了什么。

运行：

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

输入身份至少包括 id/input/target/metadata，执行轨迹包括 sandbox/files/setup/messages/output/events，评分结果落在 scores，资源与错误则由 model_usage、total_time 与 error 记录。Inspect AI 提供了更丰富的模型和 Sandbox 语义，而 Reference Harness 会显式绑定 canonical Attempt、Artifact digest 和计划 Trial 分母，因此两者可以互补，不能只按字段数量判断优劣。

来源锁应验证 8 项。在本课程四篇尚未全部完成时，课程合同会一直保持失败，以防只提交一篇概览就冒充完整课程。

## 如何核对

先从 [`_eval/eval.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py) 搜索 `eval_async`、`eval_resolve_tasks` 与 `eval_run`，再到 [`_eval/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/run.py) 搜索 `TaskRunOptions`、`run_task_retry_attempts`，最后到 [`_eval/task/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py) 追 `task_run`。每一跳都要记录调用者、输入、状态变化和返回值。

## 本篇不能证明什么

结构化 EvalLog 不能证明 Sandbox 已经完全隔离、Judge 确实有效，或者 Dataset 足以代表线上任务。课程也不声称 Inspect AI 的 Task retry 等于本仓库 Attempt，只有先明确失败分类和统计计划，才能在两者之间建立可靠映射。

[上一节](../lm-evaluation-harness/03-scoring-aggregation-tests.md) · [下一节](01-eval-task-solver.md)
