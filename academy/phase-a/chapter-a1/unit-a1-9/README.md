# A1.9｜从评测计划到可复现运行

> A1.1—A1.8 已经回答评测什么、证据如何形成、如何评分和聚合、怎样进入质量决策。A1.9 负责闭合最后一段：**Harness 怎样在受控条件下执行评测，并把每个结论连接到身份明确、统计有效、可恢复、可验证和可审计的运行证据。**

本单元所有数量、事件和结论均为合成教学材料。它们用于解释运行契约，不代表真实模型、Agent、第三方集成、发布流程或生产系统已经执行评测。

## 学习目标

完成本单元后，应能：

1. 区分 Study、Run、Task、Sample、Trial、Attempt、Trace、Score Event 与 Aggregation。
2. 使用 Run ID、Spec Digest、Resolved Digest、Comparability Digest 和 Planned–Observed Reconciliation 固化运行身份。
3. 分别处理模型、Judge、环境和并发随机性，不把 seed 当作确定性保证。
4. 设计并发、租约、fencing token、幂等提交和稳定聚合语义。
5. 区分基础设施错误、产品失败、评分失败和协议错误，防止“重试到通过”。
6. 建立 Trace、Artifact、Observation Bundle、Score Event、Metric 和 Gate 的数据血缘。
7. 分离产品预算和 Harness 预算，预声明费用、超时与停止规则。
8. 判断 Inspect AI、OpenAI Evals、LangSmith、MLflow、Phoenix、DeepEval 和 Promptfoo 应如何接入 Evalorium。
9. 对一个完整运行审计包进行正向执行和反向追溯。

## 1. 评测运行的对象模型

推荐对象层级：

```text
Evaluation Study
  -> Evaluation Run
  -> Task
  -> Sample
  -> Trial
  -> Attempt
  -> Model Call / Tool Step / State Transition
  -> Score Event
  -> Aggregation
  -> Gate Decision
```

- **Study**：整体研究问题和实验设计，例如“候选退款 Agent 是否在提高任务完成率的同时保持越权退款风险不退化”。
- **Run**：一次实际调度执行，拥有唯一 `run_id`。
- **Task**：可执行能力合同，定义输入、环境、工具、成功和失败条件。
- **Sample**：数据集中的稳定业务记录。
- **Trial**：Sample × Target × Repetition 的一次统计实现。
- **Attempt**：基础设施为了完成同一 Trial 所进行的一次执行努力。
- **Model Call / Tool Step / State Transition**：Trial 内的可观察轨迹事件。
- **Score Event**：明确 Scorer 对明确 Observation Bundle 的评分记录。

最重要的边界是：

> Trial 是统计对象；Attempt 是恢复对象。

100 个 Sample、两个 Target、每个重复 5 次，形成 1,000 个 Trial。即使发生 6 次 Worker 重试，总 Attempt 数变成 1,006，统计分母仍是 1,000。参见 [Trial Plan](trial-plan.yaml) 与 [Attempt Ledger](attempt-ledger.yaml)。

产品自己的重试属于 Trial 轨迹；Harness 的基础设施重试才产生新 Attempt。模型拒答、非法工具参数、Agent 循环超限等产品失败不能由 Harness 重试到成功。

## 2. Run Identity 与不可变运行规范

运行至少需要四种身份：

| 身份 | 作用 |
|---|---|
| `study_id` | 定位研究问题和设计 |
| `run_id` | 定位某次实际执行；相同配置重跑也产生新 Run ID |
| Spec Digest | 标识声明的运行配置 |
| Resolved Digest | 标识执行时实际解析到的模型、数据、环境和 Scorer |
| Comparability Digest | 判断 Candidate 与 Baseline 是否具备直接比较条件 |

[Run Spec](run-spec.yaml) 冻结 Target、数据、Harness、环境、Scorer、分析和执行配置；[Resolved Run Identity](resolved-run-identity.yaml) 将 `model:latest`、`dataset:current`、容器 tag 等声明引用解析为不可变身份。

不能把可变别名当成最终运行身份。一次 API 调用成功，也不表示实际对象和计划对象一致。Planned–Observed Reconciliation 应使用：

- `match`：计划身份和实际身份一致；
- `mismatch`：存在已确认差异；
- `unresolved`：无法取得实际身份；
- `partial`：只有部分对象完成调和；
- `invalid`：运行身份不能支持预期结论。

只有关键调和项全部 `match`，才允许声明完整直接可比。

## 3. 随机性、重复运行与可复现性

seed 只能控制接入该随机数生成器的过程，不能自动控制远程模型后端、GPU 内核、动态批处理、Provider 修订、外部工具、当前时间、并发调度或 Judge 随机性。

可复现应分层声明：

1. **产物重放可重复**：相同 Trace 和确定性 Scorer 产生相同分数。
2. **执行可重复**：相同冻结环境重新执行；远程随机系统仍可能产生不同输出。
3. **协议可复现**：独立实现遵循相同协议后产生可比较证据。
4. **统计可复现**：估计、区间和效应方向处于预期误差范围。
5. **决策可复现**：相同有效证据和政策产生相同 Gate Decision。

Target 重复和 Judge 重复是嵌套结构。若 100 个 Sample 每个执行 5 次，再由 Judge 评分 3 次，则有 500 个 Target Trials 和 1,500 个 Score Events，而不是 1,500 个独立样本。

Candidate 与 Baseline 应共享 Sample、环境 Fixture 和 repetition key，形成成对比较。重复次数和停止规则必须在看到结果之前声明，禁止运行到通过为止。

缓存命中不是新 Trial；重放相同 Trace 验证评分流水线；使用新 Scorer 重评旧 Trace 是 Rescoring Study。

## 4. 并发、顺序与分布式执行语义

需要区分 Trial 之间的并发和单个 Agent 内部的并行工具调用。前者由 Harness 调度，后者属于被测行为。

并发可能改变共享数据库、测试账户、缓存、工具服务、Provider 限流和事件完成顺序。因此 [Execution Policy](execution-policy.yaml) 明确规定每 Trial 隔离、并发额度、稳定聚合顺序和背压策略。

分布式队列通常采用：

```text
至少一次投递 + 租约 + fencing token + 幂等 canonical commit
```

如果 Worker-A 超时后 Worker-B 接管，而 Worker-A 又晚到提交，旧 fencing token 的结果只能保留为诊断证据，不能成为第二个 canonical result。

计划顺序、启动顺序、完成顺序和提交顺序不是同一概念。正式聚合必须使用稳定业务键排序，不依赖 Worker 完成顺序。事件因果关系由 `parent_event_id`、Span 和序列号表达，不能只比较不同机器的墙上时间。

## 5. 错误、重试、恢复与断点续跑

| 错误类别 | 例子 | 默认处理 |
|---|---|---|
| Harness 基础设施错误 | Worker 丢失、证据上传超时 | 按预声明策略受控重试 |
| Provider 瞬时错误 | 明确的 429、临时 5xx | 限额、退避和重试预算内处理 |
| Target 产品失败 | 拒答、非法参数、步骤超限 | 保留为 Trial 结果，不由 Harness 重试 |
| Scorer 错误 | Judge 解析失败 | 恢复评分阶段，不重跑完整 Target |
| Protocol 错误 | 数据哈希不符、身份无法解析 | 运行无效或终止 |

超时也必须分层：模型调用、工具调用、Agent Step、Trial、Scorer、Worker 租约具有不同语义。Trial 超时通常是产品结果，Worker 租约超时通常是基础设施事件。

断点续跑流程：

```text
加载原 Run Spec
→ 验证 Spec/Resolved Identity 未变化
→ 校验已有 Artifact 哈希和 canonical result
→ 关闭过期 Attempt
→ 重新调度允许恢复的 Trial
→ 保持 Sample、配对键和 repetition identity
→ 完成后重新检查覆盖与指标
```

只有部分 Trial 完成时，已完成子集可能偏向简单样本。除非预声明政策允许，否则覆盖不足应返回 `inconclusive`，不能直接进入发布通过。

## 6. Trace、日志、产物与数据血缘

五类运行信息不能混淆：

- **Log**：排查系统发生了什么；
- **Metric**：描述运行基础设施或质量总体状态；
- **Trace**：保存 Trial 内具有因果关系的模型、工具和状态事件；
- **Artifact**：可保存、下载和校验的文件；
- **Evidence**：具有身份、完整性、来源、语义和治理约束的正式证据。

[Trace Contract](trace-contract.yaml) 保存可观察行为，但明确禁止采集隐藏 Chain-of-Thought。需要记录模型输入输出、工具调用、权限判定、环境状态变化、最终输出、停止原因以及评分事件；不应把“完整证据”理解为收集模型不可见的内部推理。

Scorer 不应任意读取运行目录，而应接收确定的 Observation Bundle。[Artifact Lineage Manifest](artifact-lineage-manifest.yaml) 绑定：

```text
Canonical Trial / Attempt
→ Trace and Artifacts
→ Observation Bundle Digest
→ Score Event and Scorer Identity
→ Metric
→ Gate Decision
```

Integrity 表示内容未被修改，Completeness 表示必要证据是否齐全。一个哈希正确但中途截断的 Trace 具有完整性，却不具备完备性。`partial`、`truncated`、`corrupt`、`redacted_by_policy` 和 `missing` 必须成为显式状态。

秘密值不得进入 Run Spec、日志、内容身份或公开产物。应只记录完成评测和审计所需要的最小充分证据。

## 7. 预算、限额、超时与停止条件

[Budget and Stopping Policy](budget-and-stopping-policy.yaml) 分离：

- **产品预算**：限制 Agent Step、模型调用、工具调用、Token 和 Trial 时长；耗尽可能是有效产品失败。
- **Harness 预算**：限制整个运行的费用、时间、总 Attempt 和 Judge 费用；耗尽通常形成缺失证据。

并发调度需要同时核算实际费用和预留费用：

```text
Available = Limit - Actual - Reserved
```

停止规则可以是固定样本、统计精度、安全硬事件、资源耗尽或已不可能通过门禁。所有规则必须预声明。安全停止可以支持 `blocked`，但通常不能支持完整能力率估计；Harness 预算停止默认形成 `inconclusive`。

Candidate 与 Baseline 可以比较固定预算下的质量，也可以比较相同任务目标下的质量—成本—延迟曲线，但资源约束必须公平且预先说明。

## 8. 主流评测工具与 Adapter 边界

Evalorium 不 Fork 某个工具，也不只是套一层统一 CLI。它维护自己的 Study、Run、Trial、Attempt、Evidence 和 Gate 规范，再通过 [Adapter Capability Contract](adapter-capability-contract.yaml) 使用外部能力。

| 工具 | 主要优势 | Evalorium 中的角色 |
|---|---|---|
| [Inspect AI](https://inspect.aisi.org.uk/) | 深度 Agent、工具、沙箱、运行与 Eval Log | 高级执行后端和核心 Harness 对标 |
| [OpenAI Evals](https://developers.openai.com/api/reference/resources/evals) / [Graders](https://developers.openai.com/api/reference/resources/graders) | 托管 Eval Run 与多类 Grader | 可选托管运行和评分后端 |
| [LangSmith](https://docs.langchain.com/langsmith/evaluation-concepts) | Dataset、Experiment、Trace 与在线评测 | Trace、数据集和生产反馈来源 |
| [MLflow](https://www.mlflow.org/docs/latest/genai/eval-monitor/running-evaluation/traces/) | 实验追踪、Trace、Scorer 和生产闭环 | 开源追踪与评测后端 |
| [Phoenix](https://arize.com/docs/phoenix/) | OpenTelemetry/OpenInference 可观测性和 Evaluator | Trace 可视化与评分后端 |
| [DeepEval](https://deepeval.com/docs/getting-started-agents) | Pytest 风格、Agent Trace/Span 和 CI | 本地测试、Metric 与 CI 后端 |
| [Promptfoo](https://www.promptfoo.dev/docs/red-team/quickstart/) | 配置化比较和自动红队 | 攻击生成与红队执行后端 |

Adapter 必须如实声明 `full`、`partial` 或 `unavailable`。第三方没有 Attempt 身份时，Evalorium 不得伪造完整 Attempt；第三方显示“通过”时，也只能成为外部评分证据，不能自动成为企业发布授权。

## 9. 三个企业案例与完整运行审计

### 9.1 退款 Agent：有效证据支持安全阻断

[退款案例](examples/refund-agent/evaluation-case.yaml) 设计 100 Sample × 5 重复 × 2 Target，共 1,000 Trial；6 次基础设施重试形成 1,006 Attempt。Candidate 任务完成率由 89.8% 提升到 92.4%，但越权退款 Trial 率达到 1.6%，超过 0.5% 安全阈值。完整 Trace 显示 Agent 在权限拒绝后仍再次调用退款工具并改变环境状态。因此证据有效、统计完整、能力提高，但发布必须 `blocked`。

### 9.2 合同审查 Agent：身份不一致导致结论不足

[合同案例](examples/contract-agent/evaluation-case.yaml) 设计 200 合同 × 3 重复 × 2 Target，共 1,200 Trial。20 个 Trial 意外使用新政策服务，其中 Candidate 12 个、Baseline 8 个，并涉及 9 份高风险合同。即使 provisional 指标显示 Candidate 更好，配对和高风险覆盖已经破坏。正确结论是证据 `invalid`、发布判断 `inconclusive`，冻结旧服务身份并重跑受影响配对。

### 9.3 企业知识助手：离线通过后发生合成生产退化

[知识助手案例](examples/knowledge-assistant/evaluation-case.yaml) 设计 1,800 个离线 Trial，并在合成生产阶段对 100,000 条 Trace 分层抽取 2,000 条评估。引用有效率从 98.1% 降至 91.7%，幻觉率从 2.8% 升至 8.9%。血缘显示模型和 Prompt 未变化，检索索引缺少 137 份文档；Agent 同时暴露“证据不足仍强行回答”的行为。响应动作是暂停灰度、回滚检索索引、保留证据并建立受保护回归集，而不是盲目回滚模型。

三个案例分别代表：

| 证据状态 | 质量状态 | 正确动作 |
|---|---|---|
| 有效且完整 | 关键安全失败 | `blocked` |
| 身份不一致、比较无效 | 无法支持通过或失败 | `inconclusive` |
| 离线通过、生产风险上升 | 需要立即控制暴露 | 暂停、回滚真实变化源、事故回流 |

## 10. 配套运行契约

| 契约 | 用途 |
|---|---|
| [Run Spec](run-spec.yaml) | 冻结研究问题和运行输入 |
| [Resolved Run Identity](resolved-run-identity.yaml) | 保存解析身份、三类 Digest 与调和结论 |
| [Trial Plan](trial-plan.yaml) | 物化 Trial 设计、配对与分母 |
| [Attempt Ledger](attempt-ledger.yaml) | 保存租约、重试和 canonical commit |
| [Trace Contract](trace-contract.yaml) | 定义事件、因果关系和观察边界 |
| [Artifact Lineage Manifest](artifact-lineage-manifest.yaml) | 连接 Artifact、Bundle、Score、Metric 与 Gate |
| [Execution Policy](execution-policy.yaml) | 定义隔离、并发、错误、重试和恢复 |
| [Budget and Stopping Policy](budget-and-stopping-policy.yaml) | 定义产品/Harness 预算和停止规则 |
| [Adapter Capability Contract](adapter-capability-contract.yaml) | 管理主流工具适配能力和缺失语义 |
| [Run Audit Report](run-audit-report.yaml) | 汇总运行事实、可复现性和允许结论 |

## 11. 运行审计清单

- Study、Run、Task、Sample、Trial 和 Attempt 是否被清楚区分？
- Trial 计划是否等于 Sample × Target × Repetition？
- 重试是否只增加 Attempt，不扩大统计分母？
- 产品失败是否被错误地列入 Harness 自动重试？
- Spec、Resolved 和 Comparability Digest 是否独立且可验证？
- Planned–Observed Reconciliation 是否完整，mismatch 是否限制结论？
- Candidate 与 Baseline 是否共享正确的配对键、环境和 Scorer？
- Trace 是否表达父子因果关系、完整性和截断状态？
- Score Event 是否绑定 canonical Attempt、Observation Bundle Digest 和 Scorer Identity？
- 产品预算与 Harness 预算是否分离？
- 停止规则是否在看到结果之前声明？
- 安全早停是否被误写成完整能力估计？
- Adapter 是否把缺失能力诚实标为 `unavailable`？
- 最终决定是否能反向追溯到原始运行证据？

## 证据边界

本候选包可以证明：正式课程、十类运行契约、三个合成案例和 canonical verifier profile 已形成，并且关键运行语义可以被仓库测试检查。

它不能证明：真实模型或 Agent 已执行、分布式 Harness 已经实现、Inspect AI 等第三方适配器已经上线、企业发布门禁已经投入生产、生产监控已经运行、任何个人已经通过独立能力考试。

