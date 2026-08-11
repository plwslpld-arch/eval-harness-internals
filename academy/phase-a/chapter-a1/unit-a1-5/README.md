# A1.5｜从任务与场景到评测数据

> 本单元把 A1.4 已定义的任务、场景、变体和轨迹约束转换为有总体、有来源、有参考标准、有独立标注、有泄漏控制、可版本化且能被门禁审查的评测数据。核心不是“攒够很多样本”，而是让每一项数据都清楚回答：它代表谁、从哪里来、允许用于什么、参考依据是什么、与哪些样本相互依赖，以及它最多能支持什么结论。

[独立 HTML 阅读版](index.html) · [Academy 首页](../../../README.md) · [工程资产清单](artifact-manifest.yaml)

## 1. 学习目标

完成本单元后，应当能够：

1. 区分目标总体、分析单位、父单位、抽样框和样本，识别“有数据”与“能代表目标总体”的差别。
2. 将 distribution、challenge 和 regression 三种数据目的分开设计、切分和报告。
3. 为每个来源登记 provenance、lineage、授权、隐私、许可、访问与保留限制。
4. 组合权威事实、环境状态、专家判断和行为不变量，建立可审计的 Reference Standard / Oracle。
5. 设计独立盲标、分歧保留与独立仲裁，不把多数票或一致率误当作效度。
6. 控制 parent、entity、document、template 和 time 五类常见泄漏。
7. 发布不可变 Dataset Version，并通过漂移信号与刷新触发器管理变化。
8. 用 `ready`、`partial`、`blocked`、`invalid` 判断数据能否进入后续试验准备，同时不越界声称系统已经被评测。

## 2. 从 Task Spec 到数据资产

```text
Evaluation Question / Risk / Target                [A1.2–A1.3]
                ↓
Scenario Space / Task Spec / Test Case             [A1.4]
                ↓
Dataset Charter：总体、单位、框、用途与结论边界
                ↓
Source Register：来源、血缘、权利与隐私
                ↓
Sampling Plan：分层、选择、分区、gap 与分母
                ↓
Reference Standard：真值、可接受集合、不变量与未知
                ↓
Annotation Protocol：独立盲标、分歧与仲裁
                ↓
Split Manifest：依赖成组与五类泄漏控制
                ↓
Dataset Manifest：不可变身份、视图、漂移与刷新
                ↓
Data Quality Gate：ready / partial / blocked / invalid
                ↓
Trial / Scorer / Harness / Metric / System Gate     [后续单元]
```

这条链止于“数据是否有资格成为后续试验输入”。数据项存在、Reference 完成、Data Quality Gate 为 `ready`，都不表示候选系统已经运行，更不表示 Scorer、Metric 或发布 Gate 已经产生结果。

## 3. 目标总体、分析单位与抽样框

### 3.1 目标总体不是手头文件的集合

目标总体是希望结论覆盖的全部任务机会，必须同时限定用户、用途、权限、业务状态、领域、语言和时间。例如“退款请求”过宽；更准确的总体可能是“声明地区和支付渠道中，在政策版本 v17 有效期内，由具备订单权限的客户发起且订单状态可判定的退款任务机会”。

### 3.2 分清五个对象

| 对象 | 回答的问题 | 典型错误 |
|---|---|---|
| Target population | 结论希望覆盖谁和哪些任务机会？ | 把已有日志当成总体定义 |
| Primary unit | 一条结果对应什么分析单位？ | 把文档切块当成独立合同 |
| Parent / cluster | 哪些记录共享来源而相互依赖？ | 同一订单的变体散到不同 split |
| Sampling frame | 当前真正能枚举并抽样的单位有哪些？ | 忽略未记录、线下或未授权总体 |
| Sample | 从框中按声明方法选出的具体单位 | 用风险富集样本估计生产发生率 |

抽样框通常不完整，因此必须登记 `gaps`：缺了什么总体或风险、会怎样限制结论、谁负责、如何补齐、当前是 `gap` 还是 `blocked`。隐藏 gap 只会制造虚假的代表性。

## 4. 三种数据分区不能混在一个分母里

| 分区 | 目的 | 选择方式 | 允许的解释 |
|---|---|---|---|
| Distribution | 描述声明总体的一般表现与切片 | 概率抽样或可解释的流量分层 | 只有抽样与后续统计设计支持时才估计总体 |
| Challenge | 富集边界、故障、对抗和低频高伤害风险 | 风险定向、专家构造、故障与反事实 | 发现失败、验证关键风险，不估计自然发生率 |
| Regression | 防止已知事故、缺陷和重要边界复发 | 经确认案例族冻结 | 判断已知行为是否退化，不代表总体分布 |

三者可以服务同一 Evaluation Question，却不能合并成“总体准确率”。Challenge 集故意难，Regression 集故意固定；把它们与自然流量混合，既破坏总体解释，也可能让关键风险被大量普通样本稀释。

## 5. Source Register：数据的权利和历史属于数据本身

每个来源至少记录：

- **Provenance**：谁在何时、通过什么系统和方法产生或采集它。
- **Lineage**：从哪些父资产经过哪些版本化转换得到当前快照。
- **Authorization**：谁批准、依据是什么、允许什么目的、何时到期。
- **Privacy**：数据分类、个人或敏感字段、最小化、去标识与再识别风险。
- **License and access**：许可范围、访问组、是否允许再分发。
- **Retention**：何时删除或复审，以及派生数据是否继承限制。
- **Limitations**：欠覆盖、选择偏差、模板痕迹、日志缺失等。

“公开可访问”不等于“允许抓取并用于任何目的”；去掉姓名也不自动消除隐私风险；派生问答、切块和标签仍要继承上游权利与保留约束。来源权利失效时，应冻结该来源及其派生版本，而不是只删除登记表中的一行。

## 6. Sampling Plan：数量之前先解释选择机制

Sampling Plan 必须写明总体、抽样框、分层变量、选择方法、纳入概率、目标数、实际数、缺口状态、去重、依赖簇、权重和分区分母。

`actual_count >= target_count` 不能单独使关键风险 `ready`。一百个由同一模板生成的超时案例，可能只覆盖一种失败机制；十万个问答也可能全部来自可回答的常见问题。数量必须与语义覆盖、Reference、标注质量、独立性和来源治理共同审查。

### 6.1 去重不只是相同文本

至少检查：完全内容重复、同一业务实体、同一父案例及变体、文档修订和切块、生成模板、语义近重复、时间链上的未来信息。去重映射必须保留，以便审计原记录为何被合并或成组。

## 7. Reference Standard 与 Oracle

Reference 不等于一列“标准答案”。不同任务需要不同类型的参考：

1. **Exact / authoritative state**：账本、权限、有效政策或唯一原文能够给出确定状态。
2. **Set-valued reference**：多个答案或法律解释都可满足合同，不能强压成唯一措辞。
3. **Invariant-based oracle**：没有唯一答案时，验证“授权必须先于写入”“未授权信息全路径不可见”等关系。
4. **Qualified expert judgment**：规范存在解释空间时，由具备资格的独立领域专家判断。

Reference 应保存权威材料版本和 span、期望结果、禁止结果、可接受替代、不确定性类别与动作。`insufficient-context`、`source-conflict`、`expert-disagreement` 不是需要隐藏的噪声，而是数据对结论边界的重要说明。

## 8. 独立盲标、分歧和仲裁

高风险数据至少需要两位合格标注者在彼此独立、看不到候选系统与 split 去向的条件下提交结果。先看候选答案再标“真值”会把候选偏差写进 Reference；先看其他人标签再提交会制造虚假一致。

完整流程是：

```text
固定协议与 Reference 版本
→ 隐藏候选身份、输出和 split
→ 两位标注者独立提交标签与证据链接
→ 保留原始标签
→ 分类分歧原因
→ 独立仲裁者复核材料与协议
→ 输出最终或多值参考、理由与修订动作
```

多数票不能自动解决来源冲突，标注一致率高也不能证明标签有效。若分歧暴露的是协议缺陷，应暂停受影响批次、修订协议、重新校准并评估是否需要重标。

## 9. 五类泄漏

切分原则是“先形成不可拆依赖组，再把组分配到 split”，而不是先按行随机切分。

| 泄漏边界 | 例子 | 控制 |
|---|---|---|
| Parent | 基础案例与其反事实、同义和故障变体 | 整个父案例族进入同一 split |
| Entity | 同一订单、合同交易包、员工政策个案 | 实体及状态链不跨开发与受保护评测 |
| Document | 合同修订、附件、文档切块、派生问答 | 按文档族和版本链隔离 |
| Template | 同一生成模板、标准条款、攻击模板 | 模板簇与语义近重复不跨 split |
| Time | 截点后的标签、政策、ACL 或事故结果 | 只使用当时可得信息，执行 temporal cutoff |

这些边界可以重叠，应取它们的传递闭包。同一记录因文档相连，另一记录因实体相连，最终整个连通簇都必须在同一 split。

## 10. 受保护视图：Reference 不得提前泄漏

同一不可变版本应暴露不同用途的字段视图：

- **Target view**：只包含候选系统完成任务所需输入，不含 reference、annotation 或 expected。
- **Harness view**：包含调度、fixture 和 split 信息，但仍不得访问 Reference。
- **Scorer view**：只在候选观察产生后读取评分所需 Reference 与裁决标签。
- **Audit view**：按审计目的访问完整治理字段，但仍禁止真实凭据和无目的敏感字段。

把标准答案放进提示词、检索语料、fixture 元数据或可读文件名，都会使结果失去独立性，即使 split ID 看起来正确。

## 11. 不可变版本、漂移与刷新

Dataset Manifest 应锁定内容 hash、schema hash、来源、转换、Reference、Annotation Protocol、split、视图和创建时间。禁止原地修改：内容、标签、参考标准、split 或授权发生变化时，发布新 immutable ID，并保留旧版本与 supersession 关系。

漂移至少包括：

- 目标总体和场景构成变化；
- 新关键事故或攻击方式；
- 来源 schema、日志和采集路径变化；
- 政策、法律、文档、ACL 和权限变化；
- 标注分歧或错误类型变化；
- 来源授权、许可、隐私与保留条件变化。

刷新不是“把旧数据覆盖成新数据”。应重新登记来源、重算抽样框、评估 gap、重建依赖组和 split、重标受影响项、发布新版本，并解释新旧构成差异。

## 12. Data Quality Gate 的两层状态

单项检查使用：`passed`、`partial`、`blocked`、`failed`。整体数据门决定使用：

| 决定状态 | 含义 | 允许动作 |
|---|---|---|
| ready | 所有关键检查有有效证据 | 仅允许进入声明范围的后续 trial 准备 |
| partial | 有充分且可隔离的子范围，其他范围有缺口 | 只继续允许子范围，明确阻塞其余范围 |
| blocked | 关键证据缺失或依赖未完成 | 停止调度 trial，补来源、参考、标注或切分证据 |
| invalid | 授权、身份、血缘、Reference 或泄漏出现不可接受缺陷 | 当前版本不得使用，隔离并重建 |

每项 gate evidence 必须包含 `semantic_basis`、`evidence_links` 和 `sample_count_only: false`。权限、隐私、关键 Reference 和 split 独立性不能用平均质量补偿。

## 13. 三个端到端案例

### 13.1 退款 Agent

目标总体按地区、渠道、政策与订单状态限定；distribution 保留金额和渠道构成，challenge 富集阈值、审批缺失、超时未知和并发，regression 固化重复退款事故。Reference 组合有效政策、审批与账本状态，以“授权先于写入、同业务键至多一次成功”为不变量；订单、业务键、政策版本、fixture 模板和时间链共同控制泄漏。[完整案例](examples/refund-agent/evaluation-case.yaml)

### 13.2 合同审查 Agent

以许可英文合同、声明合同类型和司法辖区为总体；用跨条款、附件缺失、解析降级和困难负例补充风险。两位律师独立盲标并保留合理多值解释，第三位资深律师仲裁；交易包、修订链、附件、标准条款模板和时间截点共同切分。若其他关键证据已经物化，谈判草案不足可以使一个可隔离子范围为 `partial`；但本案例当前的许可样本、Reference、原始标注、仲裁、切分审计与内容 hash 均未物化，因此整体 Data Quality Gate 为 `blocked`，不能用现有样本数量掩盖。[完整案例](examples/contract-agent/evaluation-case.yaml)

### 13.3 企业知识助手

联合问题、语料、文档版本、ACL 和时间定义总体；Reference 只允许问题时点当前、有效且该身份获授权的 span。challenge 覆盖无答案、冲突、撤权、注入与旧缓存，regression 固化泄露与旧制度回答。文档 owner 或替代关系缺失的知识域被阻塞，不能因其他域数据完整而整体 `ready`。[完整案例](examples/knowledge-assistant/evaluation-case.yaml)

## 14. 工程模板

| 模板 | 用途 |
|---|---|
| [Dataset Charter](dataset-charter.yaml) | 定义总体、单位、抽样框、分区与结论边界 |
| [Source Register](source-register.yaml) | 登记来源、血缘、授权、隐私、许可与保留 |
| [Sampling Plan](sampling-plan.yaml) | 定义分层、选择、gap、数量、依赖与分母 |
| [Reference Standard](reference-standard.yaml) | 定义 Oracle、权威材料、不变量与未知 |
| [Annotation Protocol](annotation-protocol.yaml) | 定义独立盲标、分歧、仲裁与审计输出 |
| [Split Manifest](split-manifest.yaml) | 控制五类泄漏与受保护 split |
| [Dataset Manifest](dataset-manifest.yaml) | 锁定不可变版本、视图、漂移与刷新 |
| [Data Quality Gate](data-quality-gate.yaml) | 决定数据 ready / partial / blocked / invalid |

## 15. 可执行实验：Task-to-data review

本实验只审查和准备数据资产，不运行候选系统。

1. 从一个 A1.4 Task Spec 复制风险、场景、任务、变体与观察需求到 Dataset Charter。
2. 写出目标总体、主分析单位、父单位和抽样框，登记所有已知 frame gaps。
3. 把来源逐项登记到 Source Register；任一授权、隐私或许可不闭合的来源立即冻结。
4. 在 Sampling Plan 中分开 distribution、challenge 与 regression，填写目标数、实际数与 `met/gap/blocked`，但不凭数量判定关键风险充分。
5. 为每项关键风险建立 Reference Item，声明 authoritative state、set-valued answer 或 invariant；定义未知和冲突动作。
6. 建立双人独立盲标和独立仲裁，保留原始标签、证据链接和协议缺陷。
7. 计算 parent/entity/document/template/time 依赖闭包后切分，并生成跨 split 碰撞与时间泄漏报告。
8. 发布不可变 Dataset Manifest，核对 Target/Harness 无 Reference 权限。
9. 运行 Data Quality Gate；`blocked` 停止 trial，`invalid` 隔离版本，`partial` 只继续明确子范围。

## 16. 常见判断与参考答案

1. **十万条合成问答比一千条真实问题更代表总体吗？** 无法由数量判断。需要总体、抽样框、选择机制、来源和依赖证据。
2. **风险定向集的失败率能否当生产失败率？** 不能，它刻意富集风险，没有自然分母。
3. **两位专家一致是否说明 Reference 正确？** 不一定。一致可能来自共同偏差或含混协议；还要审查资格、盲法、材料与效度。
4. **同一文档的不同切块能否随机分到开发和门禁集？** 不能，切块共享原文，属于 document leakage。
5. **只删除姓名就能使用生产记录吗？** 不能。还需目的授权、最小化、再识别风险、访问、许可与保留审查。
6. **数据 `ready` 是否表示系统可以上线？** 不是。它只允许数据进入后续 trial 准备。
7. **政策更新后能否直接改旧版本标签？** 不应。发布新不可变版本并保留旧版本、变化理由和影响范围。
8. **Reference 能否直接暴露给 Harness？** 不应。Target/Harness view 必须与 Scorer/Audit view 隔离。

## 17. 明确范围

本单元实现的是评测数据设计与治理资产，**不实现 Scorer、LLM-as-Judge、评分 rubric 的运行代码，不实现 Harness、环境模拟器或 Trial 调度，不计算 Metric、不做置信区间、显著性检验或其他统计推断，也不执行系统发布 Gate**。模板和案例中的 `ready`、`partial`、`blocked`、`invalid` 仅是数据质量门语义。

公开候选包证明的是课程、模板和案例的结构与内部追踪；不证明真实数据已经采集或标注，不证明 Agent 已运行，不证明生产适用性、安全性、科学效度或个人能力。

## 18. 单元结论

可信评测数据必须能回答：

> 它代表哪个总体与分析单位，从哪个合法来源经什么血缘而来，用什么参考和独立标注定义期望，如何隔离依赖与未来信息，当前版本为何有资格进入哪一个后续步骤；又有哪些范围仍然 partial、blocked 或 invalid？

没有总体和抽样框，样本数量不产生代表性；没有 Reference 和分歧治理，标签不产生真值；没有依赖切分，门禁集不独立；没有不可变版本和刷新策略，今天的数据无法支撑明天的结论。
