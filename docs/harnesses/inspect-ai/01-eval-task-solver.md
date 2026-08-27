# 01｜Eval、Task 与 Solver：从公共 API 到可执行 Plan

[上一节](README.md) · [下一节](02-sandbox-sample-run.md)

## 本篇要解决什么问题

Inspect AI 的 `eval()` 可以在入口改写模型、Task、Sandbox、Solver（求解器）、epochs、并发、预算、日志和 retry 等参数，如果只把它当成一个大函数，你就很难看出哪些值只管整次 Eval 的调度，哪些值会传给每个 Task，又有哪些值最终会改动单个 Sample 要执行的 Solver Plan。这一篇从同步 API 一路跟到异步上下文、Task 解析和 TaskRunOptions，看这些参数怎样逐层落到可执行计划上。

## 先建立源码地图

公共入口分成同步和异步两个：[`eval()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py#L118-L157) 与 [`eval_async()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py#L413-L452)。模型和 Task 交给 [`eval_resolve_tasks()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py#L1899-L1938) 解析，随后 [`eval_run()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/run.py#L123-L162) 为各项 Task 做准备并安排运行，最后 [`_eval/task/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L465-L504) 把 Solver Plan 解析出来，再进入单项 Task 的主循环。

锁定源码里，`eval_async` 同一时间只允许一个调用处于活动状态，并用 anyio TaskGroup 运行 `_eval_async_inner`。别把它当成永久限制。这个结论只说明当前锁定版本怎样工作，不能顺手推广到其他版本或所有部署方式。

## 完整调用链

![Inspect AI 从 Eval 到 TaskRunOptions](../../assets/diagrams/harnesses/inspect-ai/end-to-end.svg)

1. `eval` 处理同步显示与异常边界，再调用 `eval_async`，后者规范化 checkpoint 与 control server 参数，创建 TaskGroup。
2. `_eval_async_inner` 解析 model_args/task_args、成本表与日志配置，生成 run_id，并初始化模型、并发限制和运行 hook。
3. `eval_resolve_tasks` 在已初始化的模型/角色上下文中解析 Task，输入可以是 Registry 名称、文件、Task 对象或 TaskSource；每个逻辑 Task 与实际 Model 组合成 ResolvedTask。
4. 入口调用 `eval_run`，该函数创建 SandboxManager，并为每个 ResolvedTask 合并 Eval 参数与 Task 默认配置；调用级 Solver 可以覆盖 Task 自带 Solver，但覆盖结果必须进入日志规格。
5. `resolve_plan` 把单 Solver、Chain 或 Plan 统一为 Plan；Task 的 setup Solver 会被复制后前置，避免重复调用在原对象上不断叠加 setup。
6. Scorer 被转成可重建的 ScorerSpec，Reducer、审批、限制、日志与 SampleSource 一起进入 TaskRunOptions。
7. `run_task_retry_attempts` 以 Task × Model 为调度单位，在并发上限内尽量平衡不同 Model，最终把每项 Task 交给 `task_run`。

## 关键数据结构

这里要分清两个对象。Registry（注册表）名称、File 或对象经过解析后，会连同来源一起装进 `ResolvedTask`。等到单项 Task 真要运行时，代码再把 Task、Model、Sandbox、EvalConfig、Solver、Scorer、Logger、SampleSource 和各项限制冻结到 `TaskRunOptions` 里。`Plan` 则按执行顺序保存 Solver steps，每一步还会记成 EvalPlanStep，方便你从日志里还原「当时究竟跑了哪些 Solver」。

Task 从 Dataset 里拿到 Sample 后，Solver 会不断改写 TaskState 中的 messages、output、tools 和 store，等 Solver 跑完，Scorer（评分器）才读取 state 与 Target。这样拆开后，prompt、模型调用和评分各自由谁处理都看得见，比全塞进一个 callback 更容易审计，不过 Task 仍把多项配置收在同一个对象里。

## 实现取舍与失败语义

同步入口最终走到同一套异步实现，调用者更容易上手，anyio 也便于安排并发的 Task 和 Sample，不过全局一次只能有一个活动的 `eval_async`，所以你仍不能在同一进程里随意嵌套运行。入口参数还能覆盖 Task 默认值，这对做实验很方便，但日志必须保存**解析后配置**，否则只看 Task 源码，根本还原不了当时真正采用了哪些值。

用入口参数替换 Solver，适合拿同一份 Dataset 比较不同策略，可它会同时改动工具、消息和停止方式，不能只记一个 Solver 名就把它当普通超参数。只要 Task 没解析成功、模型角色缺失或 Sandbox 规格无效，系统就该在 Sample 开始前停下。边界要守住。至于 Solver 做出了错误行为，那是 Sample 层的产品结果，不能自动算成 Eval 的基础设施错误。

## 动手实验

你可以为同一个虚构退款 Dataset 设计两个 Solver：`direct_answer` 只生成一次，`tool_agent` 可以查询订单并调用退款工具。随后列出在入口替换 Solver 时必须一起冻结的信息，包括 Solver 的 Registry 名和参数、工具集合、审批策略、Sandbox、Model，以及 message、turn、token、time、cost 等限制。

再到锁定源码里找到 `resolve_plan`，看看 Task.setup 为什么只能加到复制出来的 Plan 前面，不能直接修改还会继续复用的原 Plan。

## 预期输出与答案

比较这两种 Solver 时，不能只看最终文本，因为 tool_agent 还会留下工具副作用并改变环境终态，所以至少要冻结 SolverSpec、Model、工具权限、审批规则和各项预算。`resolve_plan` 会先复制 Plan，是因为同一个 Task 或 Plan 可能被多次 eval，如果直接在原对象前面插入 setup，第二次运行就会再插一次，实际执行的 Plan 也就偏离了原先声明。

课程里另外两篇还没写好或没有满足内容合同时，测试就该继续失败，以免有人只交一张全局图，便跳过 Sample 和 Scorer 的具体机制。

## 如何核对

按顺序找到 [`eval_async`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py#L413-L452)、[`_eval_async_inner`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py#L681-L720)、[`eval_resolve_tasks`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py#L1899-L1938) 和 [`eval_run`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/run.py#L123-L162)，先看参数怎样一路传下去。然后在 [`_eval/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/run.py#L123-L162) 看代码怎样建出 TaskRunOptions，最后到 [`_eval/task/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L396-L416) 核对 `resolve_plan` 处理 Solver、Chain、Plan 和 setup 的各条分支。

## 本篇不能证明什么

把 Plan 完整记下来，只能说明锁定实现怎样把声明变成执行计划，却不能证明 Solver 足够安全、工具权限已经收紧，或这项任务真的有效。实际模型身份、Sandbox 隔离效果和 Scorer 是否可靠，都还要拿出别的证据。

[上一节](README.md) · [下一节](02-sandbox-sample-run.md)
