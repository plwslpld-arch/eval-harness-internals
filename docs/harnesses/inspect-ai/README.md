# Inspect AI 源码课程：把 Solver、Sandbox、Scorer 和 EvalLog 放进同一条链

[上一节](../lm-evaluation-harness/03-scoring-aggregation-tests.md) · [下一节](01-eval-task-solver.md)

## 本篇要解决什么问题

Inspect AI 不只是“另一套 benchmark runner”。它把 Task 定义为 Dataset、Solver、Scorer 与可选 Sandbox 的组合，能运行普通模型任务，也能运行带工具和状态的 Agent Eval。真正需要读懂的是：公共 `eval` 怎样解析 Task；`eval_run` 怎样为每项 Task 准备隔离环境与日志；`task_run` 怎样执行每个 Sample；Scorer 又怎样读取 TaskState 和 Target，把结果写回结构化 EvalLog。

本课程固定在提交 `ebf4815ee260afcc8c34ad9d66e6f8d98a89e905`，正文把上游直接可见的类和调用标为源码事实；把它们映射到 Trial、Attempt、Observation 和 Gate 时会明确这是机制解释，不假设字段一一相同。

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

这些对象比只含最终准确率的报告丰富，但并不自动等同内容寻址证据；日志可裁剪 explanation 和 metadata，样本也可能因配置不写入，因此下游 Scorer 或审计器仍需知道实际记录级别。

## 实现取舍与失败语义

把 Sandbox 与 Task 并列是一项关键设计：同一 Solver 可以在本地、Docker 或其他环境实现中运行，Agent 终态也能进入评分；代价是环境创建、文件复制、setup、cleanup 和网络策略成为运行协议的一部分。Scorer 必须是 async callable，便于 Judge 或外部检查并发，但其可复现性取决于模型和参数是否完整记录。

Task retry 与 Sample 评分失败不同。`run_task_retry_attempts` 针对整项 Task 的错误或 cancel/retry 请求重新调度；`score_on_error` 决定 Sample 执行异常后是否仍评分；普通 Score 不通过则是有效评测结果，把这三者都叫“失败重试”会破坏统计解释。

## 动手实验

从锁定 `log/_log.py` 列出 EvalSample 中属于四类的字段：输入身份、执行轨迹、评分结果、资源/错误，然后对 shipping Reference Harness 的 evidence.json 做同样分类，找出 Inspect AI 多记录了什么、本仓库多强调了什么。

运行：

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

输入身份至少有 id/input/target/metadata；执行轨迹有 sandbox/files/setup/messages/output/events；评分有 scores；资源与错误有 model_usage、total_time 与 error。Inspect AI 的模型和 Sandbox 语义更丰富；Reference Harness 显式绑定 canonical Attempt、Artifact digest 和计划 Trial 分母，二者可以互补，不能只按字段数量判断优劣。

来源锁应验证 8 项；在本课程四篇未全部完成前，课程合同会保持失败，这正是防止只提交一篇概览冒充完整课程。

## 如何核对

从 [`_eval/eval.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py) 搜索 `eval_async`、`eval_resolve_tasks` 与 `eval_run`；到 [`_eval/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/run.py) 搜索 `TaskRunOptions`、`run_task_retry_attempts`；最后到 [`_eval/task/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py) 追 `task_run`。每一跳都记录调用者、输入、状态变化和返回值。

## 本篇不能证明什么

结构化 EvalLog 不能证明 Sandbox 完全隔离、Judge 有效或 Dataset 代表线上任务；课程也不声称 Inspect AI 的 Task retry 等于本仓库 Attempt——只有明确失败分类和统计计划后才能建立可靠映射。

[上一节](../lm-evaluation-harness/03-scoring-aggregation-tests.md) · [下一节](01-eval-task-solver.md)
