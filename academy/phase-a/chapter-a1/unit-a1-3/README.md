# A1.3｜评测对象、系统边界与版本

> 本单元解决一个常被低估的问题：评测结论究竟属于谁。只有把系统对象、边界、版本、配置、运行状态和证据范围锁定，分数才不会被错误地转移到另一个模型、另一个部署或另一个产品权限上。

[独立 HTML 阅读版](index.html) · [Academy 首页](../../../README.md) · [工程资产清单](artifact-manifest.yaml)

## 1. 学习目标

完成本单元后，应当能够：

1. 区分基础模型、模型配置、组件、Agent、应用、工作流与组织结果等对象层级。
2. 分清 system、evaluation、observation 与 claim boundary。
3. 将组件标记为 included、controlled、external 或 excluded，并解释各自证据含义。
4. 用可重建的身份描述版本、配置、提示词、工具、策略、数据和依赖。
5. 记录状态、时间和环境对一次评测运行的影响。
6. 用 reconciliation 证明“声明对象、执行对象、证据对象、结论对象”一致。
7. 识别对象漂移、证据越界，并为变化定义重新评测策略。

## 2. 先回答：评测的是哪一层

AI 产品可以分成多个对象层级：

```text
基础模型
→ 模型配置与提示词
→ 检索、解析、评分或工具组件
→ Agent 编排与策略
→ 完整应用（身份、权限、界面、日志）
→ 业务工作流（人工复核、审批、申诉）
→ 组织结果（成本、事故、用户权益）
```

每层回答不同问题。基础模型测试能够说明某种语言或推理能力；组件测试能够说明检索或工具参数；端到端 Agent 测试才能说明策略、权限和状态变化；业务 KPI 还会受到培训、流程和流量变化影响。下层证据不能自动证明上层结论。

## 3. 四种边界

| 边界 | 核心问题 | 典型内容 |
|---|---|---|
| System boundary | 产品运行时由哪些组件和外部依赖共同形成行为？ | 身份、模型、RAG、工具、数据库、审批服务 |
| Evaluation boundary | 本次实验实际包含、控制和排除了什么？ | 被测组件、模拟依赖、故障注入、未覆盖渠道 |
| Observation boundary | 能看见哪些输入、轨迹、状态和副作用？ | 回答、检索、工具、账本、ACL、日志 |
| Claim boundary | 证据允许对哪些版本、用户、场景和时间作结论？ | 已测试语言、身份、知识域、金额范围和期限 |

System boundary 往往大于 evaluation boundary；evaluation boundary 又不等于 observation boundary。某组件在实验中存在但不可观察，相关风险就不能被充分判断。Claim boundary 必须不大于证据实际覆盖。

## 4. Included、Controlled、External、Excluded

对每个组件或依赖选择一种角色：

- **included**：属于被测候选对象，其变化会改变候选身份。
- **controlled**：由 Harness 固定、模拟或注入，用来保证可复现和构造场景。
- **external**：参与真实路径但不由评测控制；必须记录版本、可用性与残余不确定性。
- **excluded**：明确不在实验或结论中；必须说明排除理由和由此产生的限制。

例如退款 Agent 的策略和工具定义是 included，状态化支付 Sandbox 是 controlled，真实支付供应商内部系统是 external，未覆盖币种是 excluded。把 external 写成 included 会虚构控制力；把 included 漏写为 external 会让候选版本无法复现。

## 5. Target identity：版本号远远不够

“v2.3”不能唯一识别一个 AI 系统。可重建身份至少包含：

| 维度 | 身份材料 |
|---|---|
| 源码与构建 | 仓库、提交、构建 ID、镜像 digest、依赖锁 |
| 模型 | provider、model ID、revision、推理参数 |
| 提示与策略 | system prompt hash、模板版本、路由和升级策略 |
| 工具与协议 | 工具 schema hash、权限策略、API 契约 |
| 数据与检索 | corpus snapshot、索引版本、embedding、reranker |
| 部署 | 环境、区域、feature flags、密钥引用版本 |
| Harness | task set、fixture、模拟器、scorer 和协议版本 |

身份记录应使用不可变 ID 或内容哈希；不得把真实凭据写入资产。配置来源和优先级同样重要，因为环境变量、远端开关和部署覆盖可能改变实际生效配置。

## 6. Runtime state：同一版本也可能不是同一对象

Agent 行为依赖运行时状态：时间、订单或合同状态、用户身份、ACL、会话历史、数据库快照、缓存、索引、工具健康、外部依赖和随机种子。即使代码与模型相同，状态不同也可能产生不同证据。

Runtime State 应记录：

- 评测开始与结束时间、时区和虚拟时钟；
- 用户、租户、角色和授权快照；
- 数据库、索引、缓存和业务实体的初始状态；
- 外部服务与工具版本、健康和故障注入；
- 会话、随机种子、预算与并发条件；
- 运行后的最终状态、状态差异和清理结果。

状态必须可重置或可重建。只保存最终回答而不保存初始状态和副作用，无法证明 Agent 是否安全完成任务。

## 7. Target reconciliation

一次运行至少存在四个“对象”：

```text
章程声明的对象
→ 调度器实际执行的对象
→ 证据元数据记录的对象
→ 报告最终声称的对象
```

Reconciliation 在运行前、运行中和报告前对齐这些对象。核对 source commit、image digest、模型 revision、prompt/tool/policy hash、数据 snapshot、feature flags、环境与 Harness。任何关键身份不一致都应使运行失效或结论为 `Inconclusive`，不能事后用显示名称推测“应该是同一版本”。

## 8. 对象漂移与证据越界

常见对象漂移包括：

1. 评测裸模型，却宣布完整应用可上线。
2. 在管理员身份运行，却声称普通员工 ACL 已验证。
3. 报告对应旧镜像，发布的是重新构建的新镜像。
4. Sandbox 使用简化工具语义，却声称覆盖真实供应商故障。
5. 只观察最终文本，却声称没有工具副作用。
6. 用某合同类型或司法辖区的证据推广到全部合同。
7. 文档索引更新后仍沿用旧知识助手结论。

证据越界的判断原则是：结论所覆盖的对象、场景、权限和时间不得大于可追踪证据覆盖。无法确定是否同一对象时，应停止继承结论。

## 9. 重新评测策略

变化不一定都要求完整重跑，但必须预先分类：

| 变化 | 推荐动作 |
|---|---|
| 文案、非行为 UI | 身份核对与定向冒烟；确认不影响输入输出契约 |
| 提示词、推理参数、模型 revision | 受影响能力与风险集重跑，通常包含完整关键门禁 |
| 工具 schema、权限、策略或副作用 | 完整 Agent 状态与安全门禁重跑 |
| 语料、索引、ACL 或版本治理 | 检索、有据性、新鲜度与权限矩阵重跑 |
| 新用户、语言、知识域、金额或司法辖区 | 视为 claim boundary 扩大，必须新增代表性和风险证据 |
| 关键生产事故或不可解释漂移 | 冻结继承结论，最小复现、回归并重新批准 |

策略应声明 change classifier、影响分析责任人、最小重跑集、必须完整重跑的触发器、结论有效期和例外审批。

## 10. 三个端到端案例

### 10.1 退款 Agent

从“要可靠、可以上线”拆到策略、政策、工具、审批与支付状态；明确 Sandbox 能证明什么、真实支付供应商仍有哪些外部不确定性。详见 [完整案例](examples/refund-agent/evaluation-case.yaml)。

### 10.2 合同审查 Agent

固定解析器、OCR、模型、风险 taxonomy、提示词、合同集与专家 rubric；只对声明合同类型、语言和司法辖区作首轮筛查结论。详见 [完整案例](examples/contract-agent/evaluation-case.yaml)。

### 10.3 企业知识助手

把身份、ACL、语料 snapshot、索引、模型与文档版本关系纳入 Target；任一关键 snapshot 更新都触发相应重评。详见 [完整案例](examples/knowledge-assistant/evaluation-case.yaml)。

## 11. 可执行实验：Target identity review

本实验审查对象与证据设计，不声称已经运行真实 Harness。

1. 从“这个 Agent 要可靠，可以上线”写出一个精确决策和 claim boundary。
2. 填写 [Evaluation Target](evaluation-target.yaml)，选择对象层级并列出完整用户路径。
3. 用 [System Boundary](system-boundary.yaml) 给每个组件标注 included、controlled、external 或 excluded。
4. 用 [Target Identity](target-identity.yaml) 记录不可变构建、模型、提示词、工具、数据与部署身份。
5. 用 [Runtime State](runtime-state.yaml) 定义初始状态、时钟、身份、依赖、随机性和最终状态捕获。
6. 在 [Target Reconciliation](target-reconciliation.yaml) 中填写声明值、执行值、证据值与报告值；关键检查点不一致标为 `mismatch`，总体结果设为 `drifted` 或 `inconclusive`，并阻断证据继承或发布。
7. 用 [Reevaluation Policy](reevaluation-policy.yaml) 对至少六种变更分类，指定定向重跑、完整重跑或 claim boundary 变更。

完成标准：每项关键结论能追踪到相同 target identity；所有外部与排除项都有明确限制；关键状态可观察；变更后是否继承结论有确定规则。

## 12. 结果分析

| 发现 | 结论 | 动作 |
|---|---|---|
| 声明、执行、证据和报告身份完全一致 | 可继续解释结果 | 仍只在 claim boundary 内使用 |
| 镜像 digest 不同，但报告写同一版本名 | 运行身份不一致 | 该证据无效，重跑候选对象 |
| 真实支付供应商是 external，Sandbox 只模拟公开契约 | 可以证明 Agent 对模拟契约的行为 | 不得声称覆盖供应商内部故障 |
| ACL snapshot 缺失 | 权限风险证据不足 | `Inconclusive`，补快照与全路径观察 |
| 仅新增可隔离知识域，旧域身份未变 | 旧结论可按策略保留 | 新域独立评测后再扩大边界 |

结果分析必须报告 mismatch、豁免、不可观察状态、外部依赖、结论有效期和下一次重评触发器。

## 13. 单元测评与参考答案

1. **模型名称和产品版本相同，能否视为同一 Target？** 不能。还需核对 revision、提示词、推理参数、工具、策略、数据、部署和开关。
2. **System boundary 内的组件是否都必须 included？** 不。受控模拟器可为 controlled，真实第三方可为 external，明确不覆盖项可为 excluded。
3. **最终回答正确，能否证明退款 Agent 没有重复写账？** 不能。Observation boundary 必须包括工具轨迹、幂等键和账本状态差异。
4. **管理员账户下 ACL 测试通过，能否推广到普通员工？** 不能。用户身份是 Target 与 Runtime State 的一部分。
5. **只改提示词文案是否一定无需重评？** 不一定。提示词是行为配置；应按影响分析至少重跑受影响风险与能力集。
6. **无法取得真实供应商内部版本怎么办？** 将其标为 external，记录可观察契约、状态和限制，不声称控制或验证其内部行为。
7. **语料内容不变，只重建索引是否属于同一对象？** 不一定。分块、embedding、索引或 reranker 改变会影响检索行为，应形成新身份并按策略重评。
8. **发现关键身份 mismatch 时应判 Fail 吗？** 若无法确认测到的就是候选对象，通常是运行无效或 `Inconclusive`；不能把未知对象的表现归为候选失败或成功。

## 14. 延伸阅读

- A1.1：将 Target 身份继续连接到 Harness、指标和门禁证据。
- A1.2：将业务决定、风险、构念和证据要求映射到本单元的对象边界。
- SLSA Provenance：理解构建来源和不可变制品身份。
- SPDX 与 CycloneDX：理解软件物料和依赖身份记录。
- NIST AI RMF：理解系统语境、风险映射和持续治理。
- OpenTelemetry 语义约定：理解跨组件运行观察；使用时应核对当前规范版本。

## 15. 明确限制

- Target identity 能证明“测的是谁”，不能单独证明系统质量达标。
- 完整元数据不等于环境真实复现，仍需重放和状态断言。
- Sandbox 只能支持其实现契约内的结论，不能替代真实外部依赖的全部验证。
- 哈希一致能够证明内容相同，不能证明参考标准、权限或业务适用性正确。
- 本单元模板不存储真实凭据、个人数据或生产秘密；只记录安全引用和不可变标识。

## 16. 单元结论

一条可信评测结论必须能回答：

> 具体哪个对象，在什么边界、版本、配置、状态、时间和环境中被执行；观察到了什么；这些证据最多允许声称什么；什么变化会使结论失效？

对象身份不清时，更多样本只会更精确地描述一个未知对象，而不会形成可用于发布的证据。
