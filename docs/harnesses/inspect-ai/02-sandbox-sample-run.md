# 02｜Sandbox 与 Sample：一次 Agent Eval 怎样真正运行

[上一节](01-eval-task-solver.md) · [下一节](03-scorer-log-retry.md)

## 本篇要解决什么问题

对普通问答来说，Sample 看起来只是从 input 走到 output，可是在 Agent Eval 中，它还可能复制文件、执行 setup、创建 Sandbox、暴露工具、产生多轮消息、触发 token、time 或 cost limit，并在清理前检查终态，因此只看最终 output 会漏掉大量产品行为。本节会追踪 `task_run` 如何把 Dataset Sample 变成 TaskState，再看它怎样在隔离上下文中运行 Solver 并保存 EvalSample。

## 先建立源码地图

Sample 生命周期集中在锁定 [`_eval/task/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L465-L504)，而 Task 级 SandboxManager 与并发准备可以在 [`_eval/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/run.py#L123-L162) 找到，至于日志侧的 `EvalSample`、SandboxEnvironmentSpec、EvalSampleLimit 与事件容器，则位于 [`log/_log.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/log/_log.py#L410-L449)。

这三个文件共同说明 Environment 不是 Target 的一个字符串参数，而是具有启动、连接、限制、清理和记录语义的执行对象。

## 完整调用链

![Inspect AI Sample 与 Sandbox 生命周期](../../assets/diagrams/harnesses/inspect-ai/sample-sandbox.svg)

1. `task_run` 解析 Plan、Scorer 名称、epoch 与 Sandbox limits，创建进度和结果容器，并从 Dataset/SampleSource 取得待运行 Sample。
2. `create_sample_state` 把 Sample 输入、目标、Model、metadata 和初始消息装入 TaskState；同时，每个新运行具有独立 UUID，避免 sample retry 复用错误状态。
3. `task_run_sample` 初始化 scoring context 和 Sandbox context，其中 Sample 自己的 sandbox 可以覆盖 Task 默认；files、setup 与连接信息在环境初始化阶段处理。
4. 进入 Sandbox 后，Solver Plan 依次运行，而 Generate 函数更新 TaskState，模型调用、工具事件、store、消息和 output 进入 transcript/Event。
5. 消息数、token、turn、wall time、working time 与 cost 等限制在运行期间检查。达到限制可形成 EvalSampleLimit，并根据策略停止、评分或标错。
6. Solver 完成后运行 Scorer；随后 Task cleanup 仍在 Sandbox context 内执行，以便检查或清理环境。
7. `make_eval_sample` 从 state、events、scores、usage、error、limit 与 sandbox 信息构造 EvalSample。只有在清理和日志阶段完成后，Sample 才进入 Task 级聚合。

## 关键数据结构

`TaskState` 是运行中的可变视图，其中包含 model、sample_id、epoch、input、messages、output、tools、store、metadata 与 scores，而 `EvalSample` 是写入日志的持久化快照，除了输入输出，还会记录 target、sandbox、files、setup、events、scores、model_usage、error、limit 和时间摘要。

SandboxEnvironmentSpec 说明环境类型与配置，但真正的环境证据还包括连接、文件、命令结果和终态。EvalSampleLimit 则要区分是 token、message、turn、time、working time 还是 cost 限制，因为这些停止原因对产品解释不同。停止原因很重要。

## 实现取舍与失败语义

每个 Sample 使用独立 Sandbox，通常最容易复现和清理，但代价是更高的启动成本。复用环境虽然更快，却必须先证明 reset 已经消除跨 Sample 状态。Inspect AI 允许设置 Task 或 Sample 级 Sandbox 及并发上限，这给实现者留下了选择空间——教材只把它视为一种能力，不会把“用了容器”直接等同于无污染。

`retry_on_error` 处理 Sample 级错误，它会递归重建新的 TaskState，同时保留 error_retries，因此不能与 Solver 内部自我修正、Task 级 retry 或普通 Score 失败混为一谈。`score_on_error` 只在重试耗尽后允许错误 Sample 进入 Scorer，这样可以评估已经完成的部分，但错误仍会计入 fail_on_error，不能被 Score 掩盖，而操作员 cancel 所选的 score、error、abort 或 retry，也各有不同的终止语义。

## 动手实验

设计一个“删除指定临时文件”的 Agent Sample：Sandbox 初态有 `target.txt` 与 `keep.txt`，Agent 只能调用 shell 工具，Scorer 检查终态。列出必须记录的观察：初态摘要、每次工具调用、退出码、最终目录清单、目标文件是否缺失、保留文件是否仍在、Sandbox reset 结果。

再回答：Agent 最终文本写“已删除”但 `target.txt` 仍存在时，TaskState.output、EvalSample error、Score 分别应是什么。

## 预期输出与答案

最终文本只是 output，因此即使执行过程没有异常，EvalSample 可以不带 error，环境事实 Scorer 仍应给出 failed。不能因为 Agent 自述成功而通过，但如果 Sandbox 无法创建，Sample 就属于基础设施错误，可以按 retry_on_error 恢复。可如果 Agent 执行 `rm` 时返回权限错误，这就是被测行为证据，是否判为产品失败应由 Task 与 Scorer 契约决定，不能默认触发平台重试。错误归属要说清。

在上述观察里，终态目录与文件摘要应作为 Artifact 或结构化 Event 进入评分，而一旦 reset 失败，后续 Sample 就可能受到污染，因此应当阻断运行，不能继续累计分数。

## 如何核对

在 [`_eval/task/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L1631-L1670) 搜索 `task_run_sample`、`sandboxenv_context`、`TaskState(`、`span("solvers")`、Scorer 循环、`make_eval_sample` 和递归 retry。再到 [`log/_log.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/log/_log.py#L410-L450) 核对 EvalSample 字段，确认哪些观察能持久保存、哪些只存在运行内存。

## 本篇不能证明什么

有 Sandbox 和事件日志，并不能证明环境没有逃逸、reset 足够完整，或者所有副作用都已被观察。要把 Agent 评测用于发布，还需要威胁模型、最小权限、外部服务隔离和独立终态断言。

[上一节](01-eval-task-solver.md) · [下一节](03-scorer-log-retry.md)
