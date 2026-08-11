# A1.9 从评测计划到可复现运行：设计规格

## 目标

将已经完成学习的 A1.9《从评测计划到可复现运行》发布为一个可独立阅读、可机器验证、可供未来 Evalorium Agent Environment Harness 复用的 Academy 单元。该单元负责把 A1.1—A1.8 定义的目标、数据、评分、指标和质量决策连接到实际运行语义，但不在本单元实现完整 Platform 运行时。

## 已确认约束

- Evalorium 是独立、开源的企业 AI 质量平台，与 Loopward、Rein、Vein 完全解耦。
- Agent Environment Harness 是 Evalorium 的深度核心能力，但当前仓库成熟度仍为 `learning`，Platform 状态仍为 `planned`。
- 公开仓库只保存校订后的课程、模板、合成案例、验证器与项目状态，不保存对话、个人回答、私人笔记或中间草稿。
- 单元交付物验证不得被表述为真实模型、真实 Agent、真实发布门禁、生产效果或个人能力已经得到独立验证。
- 使用 Node.js 24 LTS、现有 YAML/HTML 约定和 manifest 驱动的 canonical profile。
- 按 owner direct-main 工作流分两阶段发布：候选内容先通过精确 SHA 的远端门禁，随后状态提交才可将 A1.9 标记为 `artifact_validated` 并推进到下一单元。

## 方案选择

### 方案 A：只发布课程和 HTML

优点是交付快；缺点是 Run、Trial、Attempt、Trace 和恢复等概念无法成为可执行契约，达不到既有 Academy 单元的工程深度。不采用。

### 方案 B：发布课程、运行契约、案例和 canonical verifier

既保持 Academy 当前交付模式，又为未来 Harness 提供稳定的领域对象、身份和证据边界；可以用合成案例验证关键运行语义，不冒充真实运行时。采用该方案。

### 方案 C：直接实现完整分布式 Harness Platform

最终产品需要该能力，但当前 A1 章节仍在建立评测基本闭环。此时同时引入队列、Worker、数据库、沙箱和 Provider 运行时会把一个知识单元扩大为多个独立子系统，并打乱既定课程顺序。本单元不采用；其契约将作为后续 Platform 实现的输入。

## 单元结构

目录为 `academy/phase-a/chapter-a1/unit-a1-9/`，包含：

1. `README.md`：正式中文课程，覆盖九个部分及审计清单。
2. `index.html`：无需构建即可本地阅读的中文 HTML，保持现有品牌和响应式风格。
3. `run-spec.yaml`：声明 Study、Target、Data、Harness、Environment、Scorer、Analysis、Execution 和预算配置。
4. `resolved-run-identity.yaml`：保存 `run_id`、Spec Digest、Comparability Digest、Resolved Digest 及 Planned–Observed Reconciliation。
5. `trial-plan.yaml`：物化 Sample × Target × Repetition 的 Trial 计划、配对键、顺序和统计分母。
6. `attempt-ledger.yaml`：记录租约、Attempt、错误归因、重试资格、canonical commit 和 late result。
7. `trace-contract.yaml`：定义事件信封、因果关系、模型/工具/状态事件、可观察行为和禁止采集的隐藏推理。
8. `artifact-lineage-manifest.yaml`：连接 Artifact、Observation Bundle、Score Event、Metric、Gate 和完整性/完备性状态。
9. `execution-policy.yaml`：定义并发、隔离、限流、背压、超时、重试、熔断、恢复和断点续跑。
10. `budget-and-stopping-policy.yaml`：区分产品预算与 Harness 预算，定义预留、费用身份和预声明停止规则。
11. `adapter-capability-contract.yaml`：声明 Inspect AI、OpenAI Evals/Graders、LangSmith、MLflow、Phoenix、DeepEval、Promptfoo 等适配器能够提供和不能提供的语义。
12. `run-audit-report.yaml`：汇总身份调和、覆盖、重试、证据、统计、停止原因和允许得出的结论。
13. 三个 `examples/*/evaluation-case.yaml`：退款 Agent、合同审查 Agent、企业知识助手的完整合成运行审计。
14. `artifact-manifest.yaml`：声明所有公开文件、单元身份、内容政策和 canonical profile。

## 核心领域语义

规范对象层级为：

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

必须保持以下边界：

- `Trial` 是统计对象；`Attempt` 是基础设施恢复对象。多个 Attempt 不得扩大 Trial 分母。
- 产品失败是 Trial 结果，不得由 Harness 重试到成功；只有预声明的瞬时基础设施错误允许重试。
- `run_id` 用于定位实际运行，Spec Digest 标识声明配置，Resolved Digest 标识实际解析身份，Comparability Digest 决定 Candidate 与 Baseline 是否可直接比较。
- seed 是运行输入而不是确定性保证；必须分别声明 Target、Judge、Environment 的随机性与重复设计。
- 缓存命中、Trace 重放和重新评分不是新的 Target Trial。
- 分布式执行采用至少一次投递、租约/fencing token 和幂等 canonical commit；重复或晚到结果保留为诊断证据但不得重复计分。
- Log、Metric、Trace、Artifact 和 Evidence 是不同对象；Scorer 必须绑定明确的 Observation Bundle Digest。
- 产品预算耗尽可以是有效产品失败；Harness 预算耗尽通常形成缺失证据和覆盖不足。
- Evidence Validity、Comparability 和 Coverage 必须先于 Metric 和 Gate Decision。

## Canonical verifier profile

新增 profile `plan-to-reproducible-run-v1`。验证器在现有通用清单、YAML、HTML 和安全路径检查之外，执行以下语义检查：

1. 十类模板的 ID 和引用闭合，案例引用必须能够追踪到所有声明对象。
2. Spec、Resolved 和 Comparability 身份分离；禁止用可变别名充当最终解析身份。
3. Planned–Observed Reconciliation 只有 `match` 时才允许声明完整可比性；`mismatch`、`unresolved`、`partial` 必须限制结论。
4. Planned Trial 数等于声明的 Sample × Target × Repetition 设计；Attempt 总数可以更高，但 canonical result 和统计分母不得由基础设施重试扩大。
5. 只有 infrastructure/provider-transient 类错误可以由 Harness 自动重试；Target failure 必须进入产品结果。
6. 每个 Trial 至多一个 canonical Attempt；失效租约和 late result 不能进入正式 Score/Metric。
7. Trace 必须包含事件身份、父子/序列因果关系、完整性状态和可观察行为边界；隐藏 Chain-of-Thought 必须禁止采集。
8. Artifact 与 Observation Bundle 必须有内容身份；Score Event 必须绑定 canonical Trial、Observation Bundle 和 Scorer 身份。
9. 产品预算和 Harness 预算必须分离；停止条件必须预声明，提前停止必须限制可得结论。
10. Adapter 必须如实声明 Trial、Attempt、Trace、Sandbox、Resume 等能力，缺失能力不得被虚构为完整支持。
11. 所有案例均为 `synthetic-teaching-fixture`，`production_evidence`、`real_release_authorization` 和个人能力声明必须为 `false`。

## 三个案例

### 退款 Agent：有效证据支持安全阻断

100 个 Sample、5 次重复、Baseline/Candidate 成对运行，共 1,000 个 Trial。6 次基础设施恢复只增加 Attempt。Candidate 的任务完成率提高，但越权退款率超过不可补偿安全阈值，形成 `blocked`，并追踪到权限拒绝后的工具副作用。

### 合同审查 Agent：身份不一致导致结论无效

200 份合同、3 次重复、两个 Target，共 1,200 个 Trial。20 个 Trial 使用了意外更新的政策服务，破坏成对比较和高风险分区覆盖。指标只能保留为 provisional，运行审计结论为 `invalid`/`inconclusive`，必须冻结身份并重新执行受影响配对。

### 企业知识助手：离线通过后生产退化

300 个 Sample、3 次重复、两个 Target，共 1,800 个离线 Trial。合成离线结果支持受限灰度；合成生产 Trace 显示引用有效率下降和幻觉率上升，血缘定位到不完整检索索引，同时发现 Agent 在证据不足时未拒答。处置为暂停灰度、回滚索引、保留证据并生成受保护回归案例，不冒充真实生产事故。

## 主流工具边界

- Inspect AI：可选高级 Agent/Sandbox 执行后端和最重要对标对象。
- OpenAI Evals/Graders：可选托管 Run 与 Grader 后端。
- LangSmith：Trace、Dataset、Experiment 和在线评测来源。
- MLflow：Trace、Experiment、Artifact 和生产评测后端。
- Phoenix：OpenTelemetry/OpenInference Trace、可视化和 Evaluator 后端。
- DeepEval：本地测试、Metric、Trace/Span 和 CI 后端。
- Promptfoo：配置化评测、攻击生成和红队执行后端。

第三方结果只能先转换为 Evalorium 的 External Evidence，再经过身份、完整性、统计和 Gate 检查。第三方的通过状态不自动成为企业发布授权。

## 错误和恢复

- Manifest、YAML 或引用错误使单元验证失败。
- 配置身份不一致使运行结论无效，不允许静默合并。
- 证据缺失、Trace 截断或覆盖不足必须显式标记，不能按通过处理。
- Target、Scoring、Aggregation 和 Gate Decision 分层恢复；评分中断不得重新执行已完整保存的 Target Trace。
- 断点续跑必须校验原 Run Spec、Resolved Identity、已有 Artifact 哈希、canonical result 和剩余预算。

## 测试策略

采用测试驱动方式扩展 `test/verify-academy-unit.test.mjs` 与 `scripts/verify-academy-unit.mjs`：

1. 先增加 A1.9 完整包通过测试并观察其因 profile 尚不存在而失败。
2. 再分别增加 Trial/Attempt 分母污染、Target failure 非法重试、重复 canonical Attempt、身份 mismatch 冒充可比、Trace 因果/完整性缺失、隐藏推理采集、预算语义混淆、提前停止过度结论、Adapter 能力虚构、合成证据扩权等失败测试。
3. 每组测试失败原因必须对应一条明确的运行语义，而不是只检查字段存在。
4. 完成后运行 A1.9 profile 测试、完整 `npm test`、品牌检查和仓库验证。

## 验收标准

- 所有清单文件存在、可解析、内部引用闭合且无不安全路径。
- Markdown 与 HTML 完整覆盖已学习的九个部分，不包含对话记录。
- 三个案例分别稳定得到 `blocked`、`invalid/inconclusive` 和生产响应结论。
- canonical profile 能拒绝至少上述十类语义缩水。
- `npm ci && npm run check` 在 Node 24 下通过。
- 候选提交的 GitHub Actions 必须精确匹配候选 SHA 且为 `completed/success`。
- 只有候选通过远端验证后，状态提交才更新进度镜像并将 A1.9 标记为 `artifact_validated`。

## 证据边界

本单元只能证明：公开课程、模板、合成案例及其机器可检查语义已经存在并通过仓库合同验证。它不证明：真实模型或 Agent 已执行、第三方工具集成已经上线、分布式 Harness 已实现、发布门禁已经用于真实业务、生产监控已经运行、任何个人已经通过独立能力考试。
