# 术语表

[上一节](../labs/06-build-a-release-gate.md) · [下一节](verification.md)

| 术语 | 中文译名 | 本仓库中的精确定义 |
| --- | --- | --- |
| ACL | 访问控制列表 | 在知识助手评测中按角色、租户和文档权限先过滤可访问内容，再检查检索、生成和引用阶段是否发生越权泄漏。 |
| Adapter | 适配器 | 把外部系统的表示、能力和错误翻译成统一合同，Target、Model、Judge、Reward 等 Adapter 各自负责不同边界。 |
| Agent | 智能体 | 接收任务并通过模型、工具和环境执行多步行为，其循环、停止和会话恢复由 Agent Harness 管理。 |
| Agent Environment | 智能体环境 | 为智能体提供工具、文件、进程和外部反馈，并限定其可执行操作的运行空间。 |
| Agent Harness | 智能体框架 | 管理模型上下文、Agent Loop、工具、权限、会话、压缩和恢复，把一次用户任务推进到结束状态。 |
| AgentContext | 智能体上下文 | 向智能体集中提供当前任务、会话状态、可用工具和环境接口。 |
| Artifact | 产物 | 日志、diff、输出、终态等内容寻址 bytes。 |
| Attempt | 尝试 | 同一 Trial 的基础设施恢复记录；不增加统计分母。 |
| Baseline | 基线版本 | 为 Candidate 提供配对比较参照的既有 Target 版本，不是 Sample 中的 Reference 答案。 |
| Bench | 基准测试 | 正文主要把它用于 Terminal-Bench、SWE-bench 等项目名，表示一套基准任务与评测机制而非单次运行对象。 |
| BenchmarkResults | 基准测试结果 | 汇总模型在一个或多个基准任务上的分数、样本结果和比较信息。 |
| blocked | — | 缺少预声明执行条件，无法完成该层。 |
| Bootstrap | 自助法 | 对 Candidate 与 Baseline 的配对差值进行有放回重采样以估计均值差区间，教材实现不自动处理聚类或分层结构。 |
| Bundle | 证据包 | 通常指 Observation Bundle，即把一个 Trial 的 canonical Attempt、Trace 和 Artifact 引用冻结成 Scorer 可读的输入。 |
| Candidate | 候选版本 | 与相同 Sample 和 repetition 上的 Baseline 配对接受评测的新 Target 版本。 |
| canonical Attempt | — | 进入主 Observation 和评分的唯一成功执行尝试。 |
| cloned requests | Instance.repeats 与分布式 padding | 实际 Adapter 调用数量 |
| Comparison | 对比结果 | Candidate/Baseline 的配对效果量与不确定性结果。 |
| CompletionFn | 补全函数 | OpenAI Evals 中接收 Prompt 并返回 CompletionResult 的模型调用边界，不负责遍历数据、比较 Reference 或聚合 Metric。 |
| Dataset | 数据集 | 有版本、来源和切分政策的 Sample 集合。 |
| DPO | 直接偏好优化 | 使用偏好数据直接拉开优选回答与落选回答概率差距的训练方法。 |
| Environment | 环境 | Target 执行所处的文件、进程、网络、资源和权限状态。 |
| Eval | 评测 | 泛指按冻结数据、被测对象和判定合同形成质量结论的过程；OpenAI Evals 的 Eval 还是遍历 Sample 并组织调用与评分的扩展类。 |
| eval docs | Task Dataset 与 limit/samples | 文档级结果的候选分母 |
| Eval Harness | 评测框架 | 负责规划 Trial、调用 Target、保存证据、评分、聚合、比较和执行 Gate，不接管 Agent 的内部决策循环。 |
| EvalLog | 评测日志 | 保存一次评测的配置、样本结果、事件和错误，供复查与报告生成。 |
| EvalSample | 评测样本 | 评测数据集中的一个独立输入单元，可生成一次或多次 Trial。 |
| EvalSpec | 评测规格 | 声明评测样本、评测器、模型和运行参数，是启动一次评测的配置合同。 |
| Evaluator | 评测器 | 读取试验输出并按规则生成分数或判定，不同项目可能把它实现为函数、模型裁判或评测流水线。 |
| Event | 事件 | 运行期间追加到事件流的结构化记录，TraceEvent 是其中带追踪语义的一类。 |
| Fixture | 测试夹具 | 为测试预先准备并在结束后清理的样本、依赖或运行环境。 |
| Gate | 门禁 | 验证证据资格并应用发布政策的机器决定。 |
| GateDecision | 门禁决策 | 根据评测结果和阈值产出的通过、拒绝或需人工复核结论。 |
| Golden | 黄金样本 | DeepEval 中执行前存在的待测规格，保存 input、expected_output 或 context，运行后才与 actual_output 和 Trace 组成 TestCase。 |
| Group | 任务组 | lm-evaluation-harness 中按层级组织并聚合多个 Task 或子 Group 的对象，聚合时先处理子节点再处理父节点。 |
| GRPO | 组相对策略优化 | 在同一提示的一组候选回答之间计算相对奖励并据此更新策略的训练方法。 |
| IDs | 标识符 | 用来关联 Run、Trial、样本和事件等对象，不能把不同作用域的 ID 混作同一编号。 |
| inconclusive | — | 已有证据不足以支持通过或失败。 |
| InfrastructureError | 基础设施错误 | 表示网络、进程、存储或服务不可用等运行条件失败，不应计作被测产品失败。 |
| Instance | 每个文档的请求构造 | 模型调用与 batching |
| invalid | — | 身份、协议或血缘错误使对象不能进入预期推断。 |
| Job | 作业 | Harbor 中位于 Trial 之上的实验计划与运行政策容器，负责解析任务、Agent、资源、并发、恢复和汇总。 |
| JSONL | 逐行 JSON | 教材用它逐行追加 Sample、Trace 或运行结果，便于流式写入和恢复，但格式本身不保证跨行约束与证据完整性。 |
| Judge | 裁判模型 | Scorer 可调用的开放式测量依赖，通常是另一个模型。 |
| LLM | 大语言模型 | 在教材中既可能是被测模型，也可能是担任裁判、规划或生成任务的模型。 |
| LLMTestCase | 大语言模型测试用例 | 保存输入、实际输出、预期输出和上下文等供大语言模型指标评分的数据。 |
| Metric | 指标 | 按预声明分母聚合多个 Score 的估计。 |
| MetricData | 指标数据 | 保存某个指标对单个样本产生的分数、解释、阈值和判定结果。 |
| MetricEstimate | 指标估计值 | 根据样本得分计算出的总体指标及其不确定性，而不是某个样本的原始分数。 |
| Model | 模型 | 接收请求并生成回答的被测对象，在不同项目中也可能指模型客户端或其配置封装。 |
| Model Adapter | 模型适配器 | 把统一的评测请求转换成特定模型服务的调用格式，再把响应还原成统一结果。 |
| Observation | 观测 | Scorer 被允许读取的冻结证据视图，绑定明确的 Trial、canonical Attempt、Trace 事件和 Artifact。 |
| Observation Bundle | 观测包 | 把智能体执行过程中产生的消息、工具结果和环境反馈整理成一组可消费的观测。 |
| ObservationBundle | 观测包 | Scorer 被允许读取的冻结 Trace/Artifact 视图。 |
| Plan | 计划 | Planner 为当前任务生成的行动步骤，后续执行可以根据新观测继续调整。 |
| Planner | 规划器 | 根据任务状态和已有观测生成或修订 Plan 的组件。 |
| Provider | 提供方 | Promptfoo 用它表示带身份和调用接口的被测服务对象，既可以是厂商模型也可以是函数或模块；Harbor 中还可指环境后端。 |
| RAG | 检索增强生成 | 先检索外部资料并把结果加入模型上下文，再生成回答的处理流程。 |
| Recorder | 记录器 | OpenAI Evals 用它把带 run 和 sample 身份的事件写入本地 JSONL 或远端，但它不验证 Metric 分母或执行 Gate。 |
| Reducer | 归并器 | 把多次试验或多个评分结果汇总成样本级、运行级或指标级结论。 |
| Reference | 参考答案 | Sample 中预先声明、供 Scorer 判断输出的期望答案或允许条件；Reference Harness 中的 Reference 则表示教学参考实现。 |
| Registry | 注册表 | 把配置中的名称加载、去重、解引用并实例化为 Eval、CompletionFn、Solver、Model 或 Task，具体资源类型因项目而异。 |
| Release Eval | 发布评测 | 面向候选版本执行的评测，用来为发布决策提供证据，但不直接等同于发布授权。 |
| Release Gate | 发布门禁 | 用阈值和政策检查发布评测结果，输出是否允许进入下一发布阶段的判定。 |
| Report | 报告 | 汇总运行配置、指标、失败样本和门禁结论，供人工审阅或自动化系统消费。 |
| Retry | 重试 | 在符合策略的失败后重新发起一次尝试，并保留各次 Attempt 的独立记录。 |
| RewardAdapter | 奖励适配器 | 将合格 Score/Preference 转成训练信号的版本化适配器。 |
| RFT | 强化微调 | 利用评测器产生的奖励信号对模型进行强化学习微调。 |
| Rubric | 评分标准 | 列出模型裁判应检查的维度、等级和扣分条件，使评分依据可以复核。 |
| Run | 运行 | 一次完整评测执行实例，通常包含多个样本、Trial、事件和汇总结果。 |
| Runner | 运行器 | 把计划好的 Trial 交给 Target Adapter、管理基础设施 Attempt 和有限并发，但不替 Agent 决策或替 Scorer 判分。 |
| RunSpec | 运行规格 | 固化一次 Run 要使用的评测规格、模型、数据范围和执行策略。 |
| Sample | 样本 | Dataset 中的逻辑样本；通常是任务输入与冻结参考。 |
| Sandbox | 沙箱 | Inspect AI 为 Sample 提供的隔离执行上下文，负责文件、初始化、工具运行、资源限制和清理，是 Environment 的一种实现。 |
| Score | 评分结果 | 单个 Trial 的测量结果与状态。 |
| Scorer | 评分器 | 将 Observation 与 Reference 转成 ScoreRecord 的实现。 |
| ScoreRecord | 评分记录 | 记录某个评测器对一次试验给出的分数、理由和附加信息。 |
| SHA | 提交哈希 | 标识上游源码的固定 Git 提交，使教材中的源码事实能够定位到不可变版本。 |
| Solver | 求解器 | Inspect AI 用它表示组成 Plan 并改变 TaskState 的执行策略；OpenAI Evals 也用 Solver 表示一种被测调用边界。 |
| Target | 被测对象 | 被测 AI 系统边界，可以是模型、RAG、Agent 或本地程序。 |
| Target Adapter | 被测对象适配器 | 把某种 Target 的输入输出和错误翻译为 Harness 统一合同。 |
| Task | 任务 | 在统一模型中描述待测行为与输入输出合同；lm-evaluation-harness 的 Task 还负责请求和指标，Harbor Task 还包含环境与 Verifier。 |
| Task / TaskSpec | — | 描述要解决的问题、允许行为、环境和判定契约；不是一次执行结果。 |
| TaskState | 任务状态 | 保存任务输入、消息历史、工具交互和当前完成情况，供智能体各步骤共享。 |
| Terminal | 终端 | 主要指 Terminal-Bench 一类场景中 Agent 执行多轮命令并留下文件、进程、服务和日志终态的操作界面。 |
| TestCase | 测试用例 | Promptfoo 中是配置展开后的原子运行用例，DeepEval 中则常指已经包含 actual_output、可交给 Metric 测量的观测对象。 |
| TestRun | 测试运行 | 一组测试用例在指定模型和指标配置下的执行记录，不等同于单个 Trial。 |
| Trace | 轨迹 | 具有时间或因果关系的结构化运行事件。 |
| TraceEvent | 接口 | 因果父子关系、事件类型与可观察 payload |
| Transport | 传输层 | 把 SDK 的请求送到 CLI 进程的那一层，默认实现在 connect() 才真正启动子进程。 |
| Trial | 试验 | 预先规划的统计观察单位：某 Sample × Target × repetition。 |
| TrialConfig | 试验配置 | 规定单次 Trial 使用的模型参数、超时、重试和环境设置。 |
| TrialResult | 试验结果 | 保存单次 Trial 的输出、状态、评分和错误，是后续归并的基本单位。 |
| Turn | 回合 | 一次逻辑用户交互，内部可能包含多次模型请求，不能按 HTTP 请求数来数。 |
| Verifier | 验证器 | 在受控验证阶段注入并运行测试、解析 reward 的组件，缺失或非法 reward 属于验证故障而不是零分。 |

上游项目常会用同一个名称指代不同对象，所以源码课程会继续保留各项目自己的原名，并在横向比较之前先把这些名称映射到本表。无法等价的部分会单独说明。

[上一节](../labs/06-build-a-release-gate.md) · [下一节](verification.md)
