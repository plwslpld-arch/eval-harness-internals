# 02｜Sandbox 与 Sample：一次 Agent Eval 怎样真正运行

[上一节](01-eval-task-solver.md) · [下一节](03-scorer-log-retry.md)

## 本篇要解决什么问题

做普通问答时，你可能觉得 Sample 只是从 input 走到 output，可到了 Agent Eval，一条 Sample 还会复制文件、执行 setup、创建 Sandbox、开放工具、产生多轮消息，并可能撞上 token、time 或 cost limit，系统还得在清理环境前检查终态。只盯着最终 output，会漏掉很多真正影响产品结果的行为。这一篇跟着 `task_run` 往下走，看它怎样把 Dataset 里的 Sample 装进 TaskState，再怎样在隔离环境里运行 Solver（求解器）并保存 EvalSample。

## 先建立源码地图

一条 Sample 从开始到结束怎样变化，主要写在锁定的 [`_eval/task/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L465-L504) 里。Task 这一层怎样准备 SandboxManager 并安排并发，可以到 [`_eval/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/run.py#L123-L162) 找，而日志要保存的 `EvalSample`、SandboxEnvironmentSpec、EvalSampleLimit 和事件容器，则定义在 [`log/_log.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/log/_log.py#L410-L449)。

把这三个文件连起来看就会发现，Environment 要真正启动、建立连接、执行限制、负责清理并留下记录，不能把它缩成 Target 上的一个字符串参数。

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

运行过程中，代码会持续改写 `TaskState`，里面放着 model、sample_id、epoch、input、messages、output、tools、store、metadata 和 scores。等到要写日志时，代码才把当时的状态固化成 `EvalSample`，除了输入输出，还把 target、sandbox、files、setup、events、scores、model_usage、error、limit 和时间摘要一并记下来。

SandboxEnvironmentSpec 只说明环境采用什么类型、带哪些配置，真正能证明环境里发生过什么的，还包括连接记录、文件、命令结果和最终状态。EvalSampleLimit 也必须说清撞上的是 token、message、turn、time、working time 还是 cost 限制，因为不同停止原因会导向不同的产品解释。停止原因要记清。

## 实现取舍与失败语义

每条 Sample 各用一个 Sandbox，通常最容易复现，也方便清理，只是每次启动环境都会多花一些成本。复用环境虽然更快，但你得先证明 reset 真能清掉上一条 Sample 留下的状态。Inspect AI 允许你在 Task 或 Sample 层设置 Sandbox 和并发上限，实现者因此可以按场景取舍，不过教材只确认它提供了这种能力，不会看到「用了容器」就认定环境没有污染。

Sample 出错时，`retry_on_error` 会递归创建新的 TaskState，并把 error_retries 留下来，所以它和 Solver 在内部自我修正、整项 Task 的 retry、普通 Score 没通过都不是一回事。等重试次数用完，`score_on_error` 才决定要不要把出错的 Sample 交给 Scorer（评分器），让评分器衡量已经完成的部分，但这个错误仍会进入 fail_on_error，不能靠 Score 抹掉。操作员取消运行时选择 score、error、abort 或 retry，也会让任务以不同方式结束。

## 动手实验

你可以设计一条「删除指定临时文件」的 Agent Sample：Sandbox 开始时有 `target.txt` 和 `keep.txt`，Agent 只能调用 shell 工具，Scorer 最后检查环境。请列出必须留下的观察，包括初态摘要、每次工具调用、退出码、最终目录清单、目标文件是否消失、保留文件是否还在，以及 Sandbox reset 的结果。

然后再回答一个具体问题：Agent 的最终文本虽然写着「已删除」，但 `target.txt` 仍然存在，此时 TaskState.output、EvalSample error 和 Score 应该分别记录什么。

## 预期输出与答案

最终文本只会进入 output，所以即使整个执行过程没有抛出异常，EvalSample 可以不带 error，负责检查环境事实的 Scorer 仍该给出 failed。Agent 自己声称成功不能当作通过证据。反过来，如果 Sandbox 根本建不起来，这条 Sample 遇到的就是基础设施错误，可以交给 retry_on_error 恢复。若 Agent 执行 `rm` 时收到权限错误，它又成了被测行为的一部分，究竟算不算产品失败，要由 Task 和 Scorer 的契约判断，平台不能默认重试。错误归属必须说清。

在这些观察中，最终目录和文件摘要应以 Artifact（产物）或结构化 Event 的形式交给评分器。只要 reset 失败，后面的 Sample 就可能读到残留状态，此时应该直接阻断运行，不能再继续累计分数。

## 如何核对

在 [`_eval/task/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L1631-L1670) 依次搜索 `task_run_sample`、`sandboxenv_context`、`TaskState(`、`span("solvers")`、Scorer 循环、`make_eval_sample` 和递归 retry，跟清一条 Sample 怎样运行。然后到 [`log/_log.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/log/_log.py#L410-L450) 逐项核对 EvalSample 字段，分清哪些观察能长期保存，哪些只活在运行内存里。

## 本篇不能证明什么

即使已经有 Sandbox 和事件日志，你也不能据此证明环境从未逃逸、reset 清得足够干净，或所有副作用都被观察到了。若要把 Agent 评测用到发布流程里，还得补上威胁模型、最小权限、外部服务隔离和独立的终态断言。

[上一节](01-eval-task-solver.md) · [下一节](03-scorer-log-retry.md)
