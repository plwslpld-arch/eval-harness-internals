# Chapter A1｜综合地图与工程闭环复习

> Chapter A1 讲的不是“怎样得到一个更高的分数”，而是：**怎样从一项含混的业务愿望出发，为一个明确决定建立对象一致、证据充分、统计可信、能够执行且可以审计的 AI 评测闭环。**

[独立 HTML 阅读版](index.html) · [Academy 首页](../../README.md) · [课程总纲](../../curriculum/README.md)

## 1. 先用一个总问题统领九个单元

学习 A1.1—A1.9 时，可以始终追问：

> 哪位责任人，要对哪个版本的什么系统，在什么用户、场景、权限、时间和风险边界内作出什么决定；需要怎样的数据、参考标准、观察、评分、统计和运行证据；证据不足、关键失败或生产退化时又必须采取什么动作？

这个问题故意很长，因为企业级评测本来就不是一个指标。它至少包含：

1. **决定**：证据要改变哪项行动；
2. **风险**：哪些失败不能接受；
3. **对象**：结论究竟属于哪个系统版本；
4. **任务**：在什么状态和交互中产生行为；
5. **数据**：样本代表谁、从哪里来、参考依据是什么；
6. **评分**：一次观察怎样被裁决；
7. **统计**：许多评分单位级裁决怎样支持总体结论；
8. **门禁**：证据怎样转成发布、阻断、受限使用或回滚；
9. **运行**：以上计划怎样被真正执行、恢复、追踪和审计。

如果只回答其中一部分，就只能形成局部证据。例如，答案文本正确不能证明 Agent 没有产生危险副作用；数据量很大不能证明样本代表目标总体；平均分提高不能证明关键风险达标；运行成功也不能证明实际执行对象就是计划中的候选版本。

## 2. 两条链：设计链与运行证据链

### 2.1 设计链：先定义“什么证据才有意义”

```text
业务愿望
→ 决策、风险与构念
→ Target、边界与身份
→ 场景、任务、案例与轨迹
→ 数据、Reference 与分区
→ Scorer 与评分单位级 Score Record
→ Metric、Estimate 与不确定性
→ Gate Decision 与发布处置
→ Run Spec 与审计要求
```

设计链从左向右收窄含混空间。每一步都在回答“下一步究竟应该接收什么合同”。例如：

- A1.2 没定义 ACL 泄露风险，A1.4 就不会设计撤权与缓存场景；
- A1.3 没锁定语料和索引身份，A1.9 即使保存了 Trace，也不知道测的是哪个知识系统；
- A1.5 没隔离同一合同家族，A1.7 的区间可能把相关切块误当独立样本；
- A1.6 允许 Judge 覆盖账本事实，A1.8 的门禁就会建立在错误权威顺序上。

### 2.2 运行证据链：再解释“真实观察怎样回到决定”

```text
Run / Trial / Attempt
→ Trace、Artifact 与环境状态
→ Observation Bundle
→ Scorer 产生 Score Record
→ Metric 产生 Estimate / Comparison
→ Gate Evaluation
→ Gate Decision
→ Release / Freeze / Rollback / Re-evaluate
```

这条链从实际执行返回决策。A1.9 虽然在课程中最后学习，却是运行时证据的起点：Harness 先执行 Trial 并形成可验证观察，A1.6 定义的 Scorer 才能评分，A1.7 定义的 Metric 才能聚合，A1.8 定义的 Gate 才能决定动作。

两条链不能互相替代：

- 只有设计链，没有运行链：得到的是完整计划，不是真实结果；
- 只有运行链，没有设计链：得到的是大量日志和数字，却不知道支持什么决定；
- 两条链闭合：任一决定能反向追到原始证据，任一证据也能正向解释其决策用途。

## 3. A1.1—A1.9 九单元关系表

| 单元 | 核心问题 | 关键产物 | 它不能单独证明什么 |
|---|---|---|---|
| [A1.1 AI 评测的本质](unit-a1-1/README.md) | 评测为什么是一套决策证据系统，而不是跑题算分？ | 决策—对象—风险—实验—推断—处置的共同语言 | 不能证明某个具体系统已经达标 |
| [A1.2 从业务需求到评测问题](unit-a1-2/README.md) | “可靠、准确、可上线”怎样变成可回答的问题？ | Charter、影响映射、风险、构念、证据要求与追踪 | 不能证明 Target 已锁定或实验已执行 |
| [A1.3 评测对象、系统边界与版本](unit-a1-3/README.md) | 评测结论究竟属于谁？ | Target、四种边界、身份、运行状态与调和 | 身份清楚不等于质量达标 |
| [A1.4 从评测问题到任务与场景](unit-a1-4/README.md) | 风险怎样变成可执行任务、变体和轨迹约束？ | Scenario Space、Task、Test Case、Variant、Trajectory、Coverage | `planned` 或 `implemented` 不等于已产生有效证据 |
| [A1.5 从任务与场景到评测数据](unit-a1-5/README.md) | 数据为何能代表总体，Reference 为何可信？ | 总体、来源、抽样、Reference、标注、Split、版本与 Data Gate | 数据就绪不等于 Agent、Scorer 或系统 Gate 就绪 |
| [A1.6 从参考标准到评分器](unit-a1-6/README.md) | 一次观察应由谁依据什么规则裁决？ | Scoring Unit、Observation、Rubric、Scorer、仲裁与 Scorer Gate | Scorer 设计不等于实现、校准或产生了真实 Score |
| [A1.7 从样本级评分到可信指标](unit-a1-7/README.md) | 怎样从 Score 推断目标总体中的决策相关量？ | Estimand、分母、聚合、不确定性、Estimate、Comparison、Metric Gate | Metric 就绪不等于系统允许发布 |
| [A1.8 从评测证据到质量决策](unit-a1-8/README.md) | 怎样把证据变成机械、可治理、可回滚的动作？ | Baseline、Gate DAG、Evidence、Decision、Waiver、Release、Production Response | 合成 Gate 决定不是真实发布授权 |
| [A1.9 从评测计划到可复现运行](unit-a1-9/README.md) | Harness 怎样形成身份明确、可恢复、可审计的运行证据？ | Run、Trial/Attempt、Trace、血缘、恢复、预算、Adapter 与 Audit | 运行契约存在不等于真实分布式 Harness 或生产运行存在 |

可以把九个单元记成九个动词：

```text
定义 → 转译 → 锁定 → 构造 → 治理 → 裁决 → 推断 → 决定 → 执行
```

## 4. 九个最容易混淆的工程对象

| 对象 | 中文解释 | 输入 | 输出 | 最常见混淆 |
|---|---|---|---|---|
| Target | 评测目标，即结论所属的系统对象与版本 | 决策用途、组件、配置、部署和状态 | 可唯一识别且有边界的被测对象 | 用模型名或产品显示版本代替完整身份 |
| Scenario | 场景空间中的条件组合 | 风险触发、身份、状态、时间、故障和对抗轴 | 需要覆盖的世界切片 | 把历史常见问题列表当成完整风险空间 |
| Data | 有总体、来源、抽样与用途的数据资产 | Task、场景、来源和权利限制 | 版本化样本、分区和受保护视图 | 把“手头有的数据”当作目标总体 |
| Reference | 参考标准、Oracle 或可接受结果集合 | 权威状态、政策、原文、不变量或专家判断 | 成功、失败、可接受集合与未知的依据 | 把候选答案或 Judge 偏好当真值 |
| Scorer | 评分器；对明确评分单位执行受约束裁决 | Observation Bundle、Reference、Rubric | Score Record 或拒判状态 | 把 Scorer 当 Metric 或 Gate |
| Score | 一次评分器运行形成的单项 Score Record | 一个评分单位和一个 Scorer 身份 | 分数、状态、关键错误、证据与理由 | 用一条 Judge 分数声称总体质量 |
| Metric | 指标；对目标总体中某个 Estimand 的统计测量合同 | 一组 Score、分母、权重、依赖和分析计划 | Estimate、区间、切片与比较 | 把简单平均数当作完整 Metric |
| Gate | 门禁；把有效证据映射为质量状态和动作 | Baseline、Evidence、Metric、关键风险与政策 | ready / partial / blocked / invalid 及处置 | 把 CI 成功或平均分提高当发布授权 |
| Run | 一次按冻结规范调度的实际评测执行 | Run Spec、Target、Data、Harness、Scorer、预算 | Trial、Trace、Artifact、Score、Audit 血缘 | 把 API 调用成功当成可复现运行 |

还要记住四个紧邻对象：

- **Rubric（评分量规）**定义怎么判，不是执行评分的代码；
- **Estimate（估计结果）**是某次分析输出，不是预先定义的 Metric；
- **Gate Decision（门禁决定）**记录质量事实，不等于部署系统已经执行发布；
- **Release Action（发布动作）**是另一个经授权的执行步骤，不能扩大 Gate 允许范围。

## 5. 三个案例如何贯穿完整闭环

三个团队都可能说：“这个 Agent 要可靠，可以上线。”真正的评测设计却完全不同，因为它们改变世界的方式、伤害对象和权威证据不同。

### 5.1 退款 Agent：核心是资金状态安全

| 环节 | 设计 |
|---|---|
| 决策 | 是否允许候选版本在声明地区、渠道、金额与政策范围内自动执行退款，其余请求升级人工 |
| 关键风险 | 未授权退款、重复写账、状态未知时再次执行、应升级而未升级 |
| Target | 模型、Prompt、政策层、审批、工具 schema、编排策略、支付 Sandbox 与日志共同构成的 Agent 链路 |
| 场景 | 金额阈值前后、订单状态、审批失效、工具超时、未知结果、重试、并发重复和权限诱导 |
| Data / Reference | 分开 distribution、challenge、regression；用有效政策、审批和账本权威状态定义“授权先于写入、同业务键至多一次成功” |
| Scorer / Score | 确定性检查账本和幂等；程序化比较政策；人工处理政策冲突；Judge 只能补充解释质量 |
| Metric | 合格任务完成率之外，单列未授权率、重复退款率、超时状态安全与 scorable coverage；关键风险不可补偿 |
| Gate | 能力提升不能抵消资金安全失败；关键证据不足或越过阈值都必须阻断 |
| A1.9 合成运行结果 | 1,000 个 Trial、1,006 个 Attempt；完成率由 89.8% 提升到 92.4%，但越权退款率为 1.6%，超过 0.5% 阈值，因此证据有效而决定 `blocked` |

这里最重要的直觉是：最终回复“退款成功”是否措辞正确，不是决定性证据；支付账本究竟发生了什么才是。

### 5.2 合同审查 Agent：核心是法律风险与原文可追溯

| 环节 | 设计 |
|---|---|
| 决策 | 是否允许候选系统对声明合同类型、语言和司法辖区进行律师复核前的首轮风险筛查 |
| 关键风险 | 高严重性条款漏检、伪造原文 span、附件缺失却强下结论、越过律师责任边界 |
| Target | 解析/OCR、模型、Prompt、风险 taxonomy、附件处理、原文定位和人工升级链路 |
| 场景 | 跨条款表达、附件缺失、OCR 降级、司法辖区差异、合理多值解释、困难负例和专家分歧 |
| Data / Reference | 按交易包、修订链、附件、模板和时间隔离；两位律师独立盲标，保留多值解释并由独立专家仲裁 |
| Scorer / Score | 先确定性验证文档版本和字符偏移，再做集合比较和律师判断；伪造 span、确认的关键漏检不可补偿 |
| Metric | 按合同家族聚类；报告关键类别召回、伪造 span、候选负担和合同级完整性，不能用 claim 数制造伪独立 |
| Gate | A1.5 formal YAML 的当前 overall Data Quality Gate 是 `blocked`，因为样本、Reference、标注与泄漏审计尚未物化；A1.5 README 中关于谈判草案 gap 可隔离的 `partial` 语句，只能理解为其他关键项均已物化后的条件性说明，不能当作当前状态；A1.8 的独立合成决策才演示受限 `partial`，只允许中文、正文、机器可读输入和风险初筛交集 |
| A1.9 合成运行结果 | 20 个 Trial 使用了错误的政策服务身份，破坏配对和高风险覆盖；运行证据为 `invalid`，质量判断为 `inconclusive`，必须冻结身份并重跑受影响配对 |

`blocked`、`partial`、`invalid` 和 `inconclusive` 描述的是不同阶段、不同证据事实，不能跨单元拼成“合同 Agent 已部分上线”。

### 5.3 企业知识助手：核心是当前、有据且有权访问

| 环节 | 设计 |
|---|---|
| 决策 | 是否允许声明身份的员工在批准知识域获取基于当前授权文档的带证据信息回答 |
| 关键风险 | ACL 泄露、使用过期或被替代制度、无依据回答、把信息说明冒充正式审批 |
| Target | 身份、ACL、语料 snapshot、索引、embedding/reranker、模型、Prompt、缓存、引用与日志全链路 |
| 场景 | 同问不同身份、撤权前后、缓存未刷新、新旧制度冲突、无答案、提示注入和正式流程请求 |
| Data / Reference | 问题时点有效、当前、用户获授权的证据 span 才是 Reference；文档 owner、effective、supersedes 与 ACL 都属于版本身份 |
| Scorer / Score | ACL/canary 检查检索、上下文、缓存和输出；claim-span 检查原子主张；Judge 不能为泄露或无权证据免责 |
| Metric | 同时报告有据回答、coverage、正确弃权、人工负担、ACL 泄露和切片；高条件准确率不能掩盖大量拒答 |
| Gate | A1.8 合成案例中回答质量通过，但 ACL 关键检查失败且不可豁免，所以 `blocked` |
| A1.9 合成生产观察 | 离线曾通过；随后对 100,000 条合成生产 Trace 分层抽取 2,000 条评估，定位到检索索引缺少 137 份文档并引发有据性退化；正确动作是暂停灰度、回滚真实变化源即索引、保留证据并形成回归集，而不是盲目回滚模型 |

这里的关键不是“引用率高不高”，而是每个原子主张是否被系统实际取得、当前有效且用户有权访问的证据支持。

## 6. 英文术语与中文理解

### 6.1 需求、风险与对象

| 英文 | 中文解释 | 一句话记忆 |
|---|---|---|
| Evaluation Charter | 评测章程 | 锁定谁在何时依据证据决定什么 |
| Intended Use | 预期用途 | 系统被允许为谁做什么 |
| Prohibited Use | 禁止用途 | 即使技术上能做，也明确不得做什么 |
| Stakeholder-impact mapping | 利益相关方—影响映射 | 谁会通过哪条路径获得价值或承受伤害 |
| Risk taxonomy | 风险分类体系 | 用统一语言管理不同失败域 |
| Construct | 构念 | 想测但不能直接观察的属性，如有据性或状态安全 |
| Construct operationalization | 构念操作化 | 把抽象词变成正反边界例、观察和判定规则 |
| Evidence Requirement | 证据要求 | 什么数据、场景、观察和质量才足以回答问题 |
| Evaluation Target | 评测目标 | 结论真正所属的系统、版本、组件和状态 |
| Claim Boundary | 结论边界 | 证据最多允许声称到哪里 |
| Reconciliation | 身份调和 | 对齐声明、执行、证据和报告中的对象 |

### 6.2 任务与数据

| 英文 | 中文解释 | 一句话记忆 |
|---|---|---|
| Scenario Space | 场景空间 | 会改变风险或期望行为的条件轴与组合 |
| Task Spec | 任务规格 | 一类可执行任务的状态、输入、动作、成功和停止合同 |
| Test Case | 测试案例 | Task Spec 的一个具体实例 |
| Counterfactual | 反事实样本 | 只改变目标因素，观察行为是否按预期变化 |
| Invariant | 不变量 | 输入变化后仍必须保持的关键关系 |
| Metamorphic Relation | 变形关系 | 输入按规则变化时，输出也应按已知关系变化 |
| Trajectory Contract | 轨迹合同 | 约束 Agent 完成任务时允许和禁止的外部行为 |
| Provenance | 来源证明 | 数据最初由谁、何时、怎样产生 |
| Lineage | 血缘 | 当前资产从哪些父资产经什么转换得到 |
| Sampling Frame | 抽样框 | 当前真正能够枚举和抽样的总体部分 |
| Reference Standard / Oracle | 参考标准 / 判定依据 | 权威状态、可接受集合、不变量或专家判断 |
| Data Leakage | 数据泄漏 | 依赖信息跨越开发与受保护评测边界 |

### 6.3 评分、统计、门禁与运行

| 英文 | 中文解释 | 一句话记忆 |
|---|---|---|
| Observation Bundle | 观察包 | 给 Scorer 的身份、初态、事件、输出、终态和证据元数据 |
| Rubric | 评分量规 | 定义维度、量尺、锚点、关键错误与缺证规则 |
| Scorer | 评分器 | 把一次明确观察裁决为 Score 或拒判状态 |
| LLM-as-Judge | 用大模型作评审 | 一种需要版本化、校准和防注入的 Scorer |
| Score Record | 评分记录 | 一个评分单位的一次裁决事实 |
| Estimand | 待估量 | 真正想知道的总体数量是什么 |
| Estimator | 估计方法 | 用有限样本估计 Estimand 的规则 |
| Estimate | 估计结果 | 某次版本化分析得到的点值、区间与限制 |
| Bootstrap | 自助重采样 | 从经验样本反复有放回抽取以估计不确定性 |
| Gate | 门禁 | 把有效证据和阈值机械映射为质量状态 |
| Waiver | 临时豁免 | 不改写失败事实的最小范围、有期限风险接受 |
| Trial | 试验实例 | Sample × Target × Repetition 的统计对象 |
| Attempt | 执行尝试 | 基础设施为完成同一 Trial 进行的恢复对象 |
| Trace | 追踪 | Trial 内具有因果关系的可观察事件 |
| Artifact | 产物 | 可保存、下载、校验的文件或对象 |
| Evidence | 证据 | 具有身份、完整性、来源、语义和治理约束的材料 |
| Fencing Token | 隔离令牌 | 阻止过期 Worker 的迟到结果成为正式结果 |
| Run Audit | 运行审计 | 从运行事实验证身份、分母、恢复、血缘和允许结论 |

## 7. 十个常见误区

1. **“准确率高，就可以上线。”** 错。准确率只在其总体、分母、Scorer 和不确定性合同内有意义；关键风险、证据有效性和发布授权仍需独立判断。
2. **“题目越多，评测越可信。”** 错。大量同质、污染或风险缺失样本只会更精确地回答错误问题。
3. **“评测了模型，就等于评测了 Agent。”** 错。Agent 还包含 Prompt、检索、权限、工具、策略、状态、副作用和人工流程。
4. **“有引用，就说明回答有据。”** 错。引用必须支持关键原子主张，且来源当前有效、系统实际获得、用户有权访问。
5. **“Judge 给出 8 分，就是系统质量 8 分。”** 错。那只是一条 Score，不是 Metric、Estimate 或 Gate Decision。
6. **“观察缺失可以记零分。”** 错。零分是有证据确认失败；关键观察缺失通常是 `unscorable` 或 `inconclusive`。
7. **“一次重试成功，就可以忽略前一次失败。”** 错。产品失败属于 Trial 结果；只有基础设施错误才可能产生新 Attempt，且统计分母不能被扩大。
8. **“总体平均上涨，可以补偿关键风险。”** 错。资金越权、伪造 span、ACL 泄露等关键风险必须非补偿。
9. **“Partial 就是差一点通过。”** 错。`partial` 只允许边界明确、证据完整、可强制隔离的子范围；其余范围仍禁止。
10. **“artifact_validated 表示课程内容已经在生产得到验证。”** 错。它只表示公开课程包的结构、契约、链接和仓库校验通过；不表示真实数据、Scorer、Harness、生产发布或个人掌握已经成立。

## 8. 从业务愿望到 Run Audit 的完整清单

### A. 决策与风险

- [ ] 用一句话写清责任人、候选动作、截止条件和失败动作。
- [ ] 分开业务愿望、产品目标、实现方案、KPI、风险陈述、决策问题和评测问题。
- [ ] 声明 Intended Use、Prohibited Use 和 Claim Boundary。
- [ ] 映射直接用户、数据主体、资产负责人、运营者和治理角色。
- [ ] 为每项关键风险写出触发条件、失败机制、受影响方、伤害、严重性、容忍度、观察和动作。
- [ ] 把“可靠、安全、专业”等构念操作化，并列出正例、反例、边界例与不能推出的结论。
- [ ] 从需求正向追到证据和动作，再从每项指标反向追到构念和决定。

### B. Target、边界与任务

- [ ] 锁定源码、构建、模型、Prompt、工具、策略、数据、部署、Harness 和关键依赖身份。
- [ ] 区分 system、evaluation、observation 和 claim boundary。
- [ ] 将组件标为 included、controlled、external 或 excluded，并记录限制。
- [ ] 对齐声明对象、实际执行对象、证据对象和报告对象。
- [ ] 从风险触发条件建立身份、状态、时间、故障、并发和对抗场景轴。
- [ ] Task Spec 写清前置状态、输入、动作、成功、禁止行为、停止、升级、预算与重放。
- [ ] Test Case、反事实、不变量、变形关系和 Trajectory Contract 均可执行、可观察。
- [ ] Coverage Matrix 区分 planned、implemented、executed、blocked 与 excluded。

### C. 数据、Reference 与 Scorer

- [ ] 定义目标总体、主分析单位、父单位、抽样框和已知 gaps。
- [ ] 分开 distribution、challenge 和 regression 数据用途及分母。
- [ ] 登记来源、血缘、授权、隐私、许可、访问和保留限制。
- [ ] Reference 使用权威状态、可接受集合、不变量或合格专家判断，并显式保留未知与冲突。
- [ ] 独立盲标、原始分歧和独立仲裁均有记录。
- [ ] parent、entity、document、template、time 五类依赖成组后再切分。
- [ ] Target/Harness view 与 Scorer/Audit view 隔离，Reference 不提前泄漏。
- [ ] 定义 Scoring Unit 和完整 Observation Bundle；关键观察缺失时不强判。
- [ ] Rubric 有维度、量尺、锚点、边界例、关键错误和不可评分条件。
- [ ] Scorer 身份、权威顺序、拒判、仲裁、可靠性、效度、校准、偏差、稳健性和安全验证均明确。

### D. Metric、Gate 与发布

- [ ] 写清 Construct、Estimand、目标总体、分析单位、分母、权重和方向。
- [ ] timeout、crash、abstain、unscorable、inconclusive 的处理预先定义且不静默删除。
- [ ] 重复运行、任务簇、文档家族、配对和时间依赖得到正确保留。
- [ ] 使用与数据结构匹配的普通、配对、聚类、层级或时间感知区间方法。
- [ ] 同时报告点估计、区间、效果量、coverage、切片和证据限制。
- [ ] 主指标、关键风险、guardrail、诊断指标和证据质量指标角色分开。
- [ ] Quality Baseline 在看候选结果前批准；关键风险不可补偿。
- [ ] Gate DAG 无环，`invalid`、`blocked` 和 `partial` 按规则向下游传播。
- [ ] `partial` 有真实范围交集和隔离控制；Waiver 不改写 Gate 且有期限。
- [ ] Release Action 不扩大 Gate Decision 的允许范围；生产硬事件能冻结、撤销或回滚。

### E. Run、Trace 与 Audit

- [ ] Study、Run、Task、Sample、Trial、Attempt 和 Score Event 身份清楚。
- [ ] Run Spec、Resolved Identity 和 Comparability Digest 已冻结并调和。
- [ ] Trial 数由 Sample × Target × Repetition 决定；基础设施重试只增加 Attempt。
- [ ] 产品失败、基础设施错误、Scorer 错误和协议错误采用不同恢复规则。
- [ ] 分布式执行使用租约、fencing token、幂等 canonical commit 和稳定聚合键。
- [ ] Trace 记录可观察行为、因果、完整性和截断状态，不采集隐藏 Chain-of-Thought。
- [ ] Artifact → Observation Bundle → Score → Metric → Gate 的血缘和 hash 可反向验证。
- [ ] 产品预算与 Harness 预算分开，停止规则在看结果前声明。
- [ ] 断点续跑保持原身份、配对键、分母和已有 canonical 结果。
- [ ] Run Audit 同时写明支持什么、不能支持什么、剩余风险和重新评测触发器。

## 9. 四种状态不要跨层误读

| 状态 | 合理含义 | 不能这样解释 |
|---|---|---|
| blocked | 关键要求失败，或关键证据尚不足，当前流程必须停止 | “系统整体很差”或“永远不能用” |
| partial | 一个可隔离子范围完整满足要求，其余范围禁止 | “整体接近通过” |
| invalid | 身份、权威、血缘或协议错误使当前证据不能使用 | “候选系统表现失败” |
| inconclusive | 现有有效证据仍不足以作出通过或失败结论 | “默认通过”或“等同失败” |

同一个案例在不同阶段可以拥有不同状态，因为每个 Gate 回答的是不同问题。应始终写清：**哪个对象、哪个阶段、哪个版本、哪项检查、哪一范围**的状态。

## 10. 证据边界与当前限制

Chapter A1 的九个单元已经形成正式课程、独立 HTML、机器可读模板、三个主要案例的连续设计和自动化验证合同。这里的 `artifact_validated` 只表示：

- 公开课程包、模板、案例和链接存在；
- 关键结构、引用关系与一部分语义由仓库验证器检查；
- 对应提交通过了声明的本地检查和精确 SHA 的远端工作流。

它**不表示**：

- 真实数据已经采集、授权、标注或物化；
- Scorer 或 LLM-as-Judge 已经实现、校准并投入服务；
- 分布式 Agent Environment Harness 已经实现；
- 案例中的合成 Trial、Score、Estimate、Gate 或生产 Trace 是真实企业运行；
- Inspect AI、OpenAI Evals、LangSmith 等第三方 Adapter 已经上线；
- 任一真实系统已经获得生产发布授权；
- 课程完成自动构成任何个人掌握、认证、工作经验或生产能力声明。

因此，Chapter A1 当前最可靠的成果是：建立了一套可公开审查、可继续实现的企业 AI 质量工程方法与合同基础。它为真实平台和真实评测提供规范，但不能冒充那些尚未发生的运行事实。

## 11. 九单元入口

1. [A1.1｜AI 评测的本质](unit-a1-1/README.md) · [HTML](unit-a1-1/index.html)
2. [A1.2｜从业务需求到评测问题](unit-a1-2/README.md) · [HTML](unit-a1-2/index.html)
3. [A1.3｜评测对象、系统边界与版本](unit-a1-3/README.md) · [HTML](unit-a1-3/index.html)
4. [A1.4｜从评测问题到任务与场景](unit-a1-4/README.md) · [HTML](unit-a1-4/index.html)
5. [A1.5｜从任务与场景到评测数据](unit-a1-5/README.md) · [HTML](unit-a1-5/index.html)
6. [A1.6｜从参考标准到评分器](unit-a1-6/README.md) · [HTML](unit-a1-6/index.html)
7. [A1.7｜从样本级评分到可信指标](unit-a1-7/README.md) · [HTML](unit-a1-7/index.html)
8. [A1.8｜从评测证据到质量决策](unit-a1-8/README.md) · [HTML](unit-a1-8/index.html)
9. [A1.9｜从评测计划到可复现运行](unit-a1-9/README.md) · [HTML](unit-a1-9/index.html)

## 12. 最终记忆框架

如果只能带走一套框架，就记住：

```text
先问决定，而不是先选指标；
先找风险，而不是先找题库；
先锁对象，而不是只写版本名；
先定义场景和状态，而不是只给问题文本；
先治理总体、Reference 与泄漏，再谈数据量；
先验证 Scorer，再相信 Score；
先定义 Estimand、分母与依赖，再计算 Metric；
先验证证据，再执行 Gate；
先固定 Run 身份、Trial 分母与血缘，再解释结论；
最后永远写清：证据证明了什么，又没有证明什么。
```

企业级 AI 评测的成熟，不体现在仪表盘有多少数字，而体现在每一个数字都知道自己属于谁、来自哪里、能支持什么决定，并在失败时真正改变系统行为。
