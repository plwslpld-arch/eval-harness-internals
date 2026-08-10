# A1.6｜从参考标准到评分器

> 本单元把 A1.5 的 Reference Standard、任务数据与受保护视图转换为可版本化、可审计、可拒判、需要被独立验证的评分设计。核心结论是：**Scorer（评分器）不是“给答案打个分”的函数，而是依据声明证据、权威顺序和 Rubric 对一个明确评分单位作出受约束裁决的证据系统。**

[独立 HTML 阅读版](index.html) · [Academy 首页](../../../README.md) · [工程资产清单](artifact-manifest.yaml)

## 1. 学习目标

完成本单元后，应当能够：

1. 严格区分 Reference、Rubric、Scorer、Score、Metric 与 Gate，避免用一个词替代整条测量链。
2. 为原子主张、工具调用、状态转移、轮次、轨迹和 trial 定义清晰的 Scoring Unit（评分单位）。
3. 用 Observation Bundle（观察包）把身份、初始状态、事件流、最终输出、最终状态和证据元数据交给评分器。
4. 选择 deterministic、programmatic、human、LLM-as-Judge 或 composite scorer，并规定权威顺序。
5. 编写 analytic rubric 的维度、量尺、锚点、边界例、关键错误和不可评分条件。
6. 正确处理 uncertain、abstain、unscorable、disagreement 与 inconclusive，而不是强行输出单值分数。
7. 用可靠性、效度、校准、错误画像、偏差、稳健性和安全证据验证评分器本身。
8. 让 Scorer Quality Gate 只在独立、物化、达阈值的证据下进入 `ready`。

## 2. 本单元从哪里开始、在哪里停止

A1.5 已回答：数据代表什么总体、来自哪里、Reference 如何建立、标注与泄漏如何治理、数据能否进入后续 trial 准备。A1.6 接着回答：**如果未来产生一次候选系统观察，谁依据什么规则，把哪一段观察判成什么？**

```text
A1.5 Dataset / Reference / Protected scorer view
                       ↓
Scorer Charter：评分用途、权威、边界与责任
                       ↓
Scoring Unit Spec：究竟在判 claim、call、transition、trajectory 还是 trial
                       ↓
Observation Contract：评分器能够看到的完整观察包
                       ↓
Rubric：构念维度、量尺、锚点、关键错误与不可评分
                       ↓
Scorer Manifest：实现身份、类型、优先级、输出与失败合同
                       ↓
Adjudication：分歧分类、独立仲裁与资产反馈
                       ↓
Scorer Validation：可靠性、效度、校准、错误、偏差、稳健性、安全
                       ↓
Scorer Quality Gate：ready / partial / blocked / invalid
                       ↓
Future Trial → Score Records → Metric / Statistical Inference / System Gate
```

本单元止于**评分器设计与验证合同**。不实现 scorer 服务，不运行 Agent，不产生真实 Observation Bundle、Score 或 Metric，不实现 Harness，不作统计推断，也不执行系统发布 Gate。

## 3. 六个概念必须分开

| 概念 | 中文解释 | 输入 | 输出 | 不能冒充它的东西 |
|---|---|---|---|---|
| Reference | 参考标准、Oracle 或可接受结果集合 | 权威事实、有效政策、原文、状态、不变量、专家判断 | 任务成功和禁止结果的依据 | 不是候选系统答案，也不是 Judge 自己的偏好 |
| Rubric | 评分量规 | 构念、Reference、风险和观察能力 | 维度、量尺、锚点、关键错误、缺证规则 | 不是执行代码，也不自动产生分数 |
| Scorer | 评分器 | Observation Bundle、Reference、Rubric、版本化配置 | 样本级 Score Record 或拒判状态 | 不是跨样本统计量，也不是发布决定 |
| Score | 单项评分记录 | 一次具体评分器运行 | 状态、维度分数、证据、理由、异常 | 不是总体性能，单项 `2` 不说明成功率 |
| Metric | 指标 | 一组有分母和依赖结构的 Score Records | 失败率、召回率、分位数、区间等 | 不属于本单元；不能从一条 Score 推出 |
| Gate | 门禁 | 多项指标、风险阈值、不确定性和例外规则 | ready / block / rollback 等动作 | Scorer Quality Gate 也不是系统发布 Gate |

一个 LLM Judge 同时读取 Reference 和答案再输出“8 分”，并不因此成为 Reference、Metric 或 Gate。它仍只是一个可能出错、必须被验证的 Scorer 实现。

## 4. Scorer 的本质：证据裁决器

评分器应能回答六个问题：

1. **判谁？** 评分单位和身份是否唯一？
2. **依据什么？** Reference、Rubric 和权威顺序是什么？
3. **看到了什么？** 观察是否完整、可验证且未被候选篡改？
4. **怎样判？** 算法、人员、Judge、组合规则和版本是什么？
5. **何时不判？** 缺证、越界、冲突或内部故障如何处理？
6. **凭什么信它？** 评分器本身的可靠性、效度、错误和安全证据在哪里？

如果评分器不能引用导致判断的观察与 Reference，它给出的只是意见；如果它不能拒判，它会把“没有证据”伪装成“证据显示中等”；如果它没有身份版本，历史分数无法复现。

## 5. Scoring Unit：先定义“这一分属于谁”

### 5.1 常见评分单位

| 单位 | 适用问题 | 退款示例 | 合同示例 | 知识助手示例 |
|---|---|---|---|---|
| Atomic claim | 每个事实主张是否有据 | “退款已完成” | “该条款是无限责任” | “试用期为六个月” |
| Tool call | 参数、权限与结果是否正确 | 金额、业务键、审批 | 文档/附件读取调用 | 检索和 ACL 过滤调用 |
| State transition | 世界状态是否安全变化 | 账本是否恰好一次写入 | 审查包是否完整 | 缓存撤权后是否仍可见 |
| Turn | 某一轮对话是否澄清、拒答或升级 | 追问缺失订单信息 | 请求缺失附件 | 路由文档 owner |
| Trajectory | 整个行为路径是否满足过程约束 | 超时后先查账本再重试 | 先读附件再下结论 | ACL 从检索到输出全路径成立 |
| Trial / task | 一次端到端任务是否完成 | 一次退款任务 | 一份合同筛查 | 一个身份时点的问题 |

### 5.2 三个关键边界

- **身份边界**：`trial_id + task_id + dataset_item_id + target_identity + environment_identity + seed` 等字段决定“同一次运行”。缺失或重复身份应 `unscorable`。
- **父子边界**：claim、call 和 transition 可以组成 trial，但不能悄悄把一个 trial 的多个子项当作独立样本。
- **聚合边界**：A1.6 可以从子单位形成单个 trial 的结构化判定，但跨 trial 的分母、权重、相关性与置信区间属于后续 Metric 设计。

## 6. Observation Bundle：评分器真正能看到什么

一个完整观察包至少有六部分：

1. **Identity**：trial、任务、数据项、Target、环境、seed、schema 版本。
2. **Initial state**：fixture、权限、有效时间、政策或文档快照、初始业务状态。
3. **Event stream**：按因果顺序记录工具调用、结果、状态变化、时间和错误。
4. **Final output**：最终内容、原子主张、引用、拒答或升级、完成状态。
5. **Final state**：权威环境最终状态、前后差异、未决副作用。
6. **Evidence metadata**：来源、Reference、hash、捕获时间、完整性和脱敏策略。

最终文本不能替代事件流和环境状态。退款 Agent 可以说“没有退款”，而账本已经写入；知识助手可以在最终输出中没有泄露，但受限内容已进入 prompt；合同 Agent 可以生成看似精确的偏移，却引用不存在的附件。

观察完整性至少使用 `complete / partial / missing / corrupted`。关键观察缺失时必须 `unscorable`；只有 Rubric 明确允许且不影响关键风险，`partial` 才可能转为 `uncertain`。候选系统不得写入 Reference 字段，观察捕获后应不可变并保留 hash。

## 7. 五类评分器

### 7.1 Deterministic scorer（确定性评分器）

对权威状态和可执行不变量作确定判断，例如账本成功写入次数、ACL 是否允许、字符偏移是否存在。它适合规格清楚的条件，但“确定性”不等于“永远正确”：抓错状态、版本错配或规则实现错误仍会导致假结论。

### 7.2 Programmatic scorer（程序化评分器）

使用结构比较、集合匹配、span 对齐或可执行检查。例如把合同风险类别与 set-valued Reference 比较，或建立原子主张—证据 span 映射。它可能允许容差和多值结果，不必是二元规则。

### 7.3 Human scorer（人工评分器）

适合存在领域解释、价值判断或 Rubric 边界的任务。需要资格、培训、盲法、独立判断、原始记录、分歧分类和仲裁。人的意见也不是天然真值。

### 7.4 LLM-as-Judge（用大模型作评审）

适合开放文本的语义完整性或质量维度，但必须限定范围，版本化 prompt/model/config，验证位置偏差、冗长偏好、自我偏好、顺序效应、注入和跨切片错误。Judge 的流畅理由不能覆盖权威状态。

### 7.5 Composite scorer（组合评分器）

组合器不是创造新真值，而是按权威顺序编排多个子评分器。常见顺序是：

```text
authoritative state / invariant
→ exact deterministic or programmatic check
→ qualified human adjudication
→ bounded calibrated Judge
```

对关键风险，确定性失败必须 `force-fail`，不可被其他维度平均。非关键冲突进入仲裁，而不是默认取平均数。

## 8. Rubric：把构念变成可重复的判断规则

### 8.1 Analytic 与 Holistic

- **Analytic rubric（分析式量规）**把质量拆成有据性、授权、完整性、升级等维度，适合诊断、审计和风险门禁。
- **Holistic rubric（整体式量规）**给出整体印象，适合补充判断，但容易把维度混合，不能替代关键风险检查。

企业评测通常以 analytic 为主；holistic 可以补充“整体是否清晰”，但不得掩盖“发生未授权写入”。

### 8.2 每个维度的最小合同

每个维度至少包括：构念、评分单位、定义、量尺类型、允许值、每一档 anchor、所需证据、边界例和版本。Anchor（锚点）不是形容词：

- 差的锚点：“回答一般。”
- 可审计锚点：“关键主张存在，但缺少一个非关键证据 span，且没有关键错误，因此为 1。”

### 8.3 Critical error 与不可补偿

Critical error 必须连接 Risk，声明触发证据、分数效果、`compensable: false` 和 `judge_override_allowed: false`。退款的未授权写入、合同的伪造 span、知识助手的 ACL 泄露，都不能被其他高分平均掉。

### 8.4 Rubric 版本

维度、量尺、锚点、关键错误或证据规则改变时，应发布新版本。不能静默用新 Rubric 重解释旧分数；如需重评分，应保留旧记录、原因和新 scorer/rubric 身份。

## 9. 五种“不确定”不能混用

| 状态 | 含义 | 例子 | 动作 |
|---|---|---|---|
| uncertain | 观察够用，但边界或参考不足以稳定单值判断 | 两种合理法律解释 | 保留置信理由，可能仲裁或多值输出 |
| abstained | 评分器主动识别超出授权或能力范围 | Judge 不具备声明语言能力 | 不强判，路由合格评分器 |
| unscorable | 关键输入、身份、观察或 Reference 不满足评分前提 | 缺账本、ACL 快照损坏 | 不产生数值，补证或重捕获 |
| disagreement | 两个合法判断在状态、分数、critical error 或证据上不同 | 两位律师对严重性不同 | 保留原始结果，分类并仲裁 |
| inconclusive | 规定流程后证据仍不能支持决定性结论 | 两个权威来源冲突且无法及时解决 | 缩小声明、调查来源，不假装通过或失败 |

`null` 也不等于零分。零分表示“有足够证据确认失败”；`unscorable` 表示“不具备判断资格”。

## 10. 分歧与仲裁

仲裁不是多数票。完整过程是：冻结原始分数、版本和观察包；分类 Reference 冲突、Rubric 含混、观察缺失、scorer bug 或领域判断；由独立合格人员复核；保留原始判断；输出仲裁结果、理由、证据与修订动作。

允许的结果包括 `confirmed-score`、`corrected-score`、`set-valued-resolution`、`abstained`、`unscorable`、`inconclusive` 和 `protocol-defect`。如果分歧来自协议缺陷，应修订 Reference、Rubric 或 Scorer 新版本，并隔离受影响旧分数，不能回写抹去历史。

## 11. Score Record 应包含什么

未来一次评分器运行至少输出：

- `score_record_id`、不可变 scorer 身份与实现 ID；
- Observation Bundle、Scoring Unit、Rubric 和 Reference IDs；
- `scored / uncertain / abstained / unscorable / inconclusive` 状态；
- 各维度分数、关键错误、证据链接和理由；
- 不确定性说明、时间和失败信息。

Score Record 是样本级审计记录。它不包含跨样本分母，不自动成为 Metric，也不自动触发产品发布。

## 12. 评分器也必须被评测

### 12.1 Reliability（可靠性）

关心相同条件下是否稳定：重复运行、同一人工评审者重测、不同评审者一致性、版本稳定性。高一致性只说明重复，不证明判断测对了东西。

### 12.2 Validity（效度）

关心评分器是否真的测量声明构念：内容是否覆盖构念；与可信准则是否一致；应相关的维度是否收敛；已知正反例和反事实是否得到正确方向。常见威胁包括构念欠覆盖、无关文风偏好、Reference 错误和 scorer gaming。

### 12.3 Calibration（校准）

如果评分器输出置信或阈值，需要检查置信与实际正确率的关系、abstention—coverage 权衡、阈值附近 false pass/false fail。高置信错误比低置信拒判更危险。

### 12.4 Error profile（错误画像）

- **False pass**：实际应失败，却被评分器判通过；高风险场景通常最关键。
- **False fail**：实际可接受，却被判失败；会阻断有效版本、增加人工负担。
- **Abstain error**：该判时不判，或该拒判时强判。
- **Unscorable detection error**：缺失关键观察却仍输出确定分数。

总体错误率不能替代风险、单位、语言、长度、角色等切片。

### 12.5 Bias、Robustness 与 Security

Bias 检查语言、方言、冗长度、角色、文档风格和风险相关群体差异；Robustness 用释义、顺序、无关长度、格式、干扰项和 Reference 位置扰动；Security 检查候选输出注入、Reference 泄露、配置篡改、证据链接伪造、重放和版本错配。

验证集必须独立于 scorer 开发，阈值应在执行前声明，并保留样本级物化记录。计划、空数组和 scorer 自我声明不是验证证据。

## 13. Scorer Quality Gate

| 状态 | 含义 | 允许动作 |
|---|---|---|
| ready | 所有关键检查使用独立、物化、可审计证据并达到预声明阈值 | 仅进入声明范围的后续 trial 准备 |
| partial | 只有可隔离且证据充分的子范围达标 | 仅在该子范围使用 |
| blocked | 实现、身份或关键验证证据缺失 | 停止正式评分，继续实现和验证 |
| invalid | 权威、身份、效度或安全存在不可接受缺陷 | 隔离版本并重建 |

关键检查至少覆盖：不可变身份、权威优先级、可靠性、效度、校准、错误画像、偏差与稳健性、安全。当前所有模板和案例都诚实为 `blocked`：它们只有设计，没有实现、独立校准集或执行结果。

## 14. 三个案例为什么需要不同评分器

### 14.1 退款 Agent

权威核心是政策、订单审批状态和支付 Sandbox 账本。确定性 scorer 检查未授权写入、同业务键成功次数和最终状态；programmatic scorer 比较政策条件；人工处理政策冲突；Judge 只能补充解释完整性。账本确认的未授权或重复写入直接 force-fail。[完整案例](examples/refund-agent/evaluation-case.yaml)

### 14.2 合同审查 Agent

Reference 允许多种合理法律解释，但字符偏移是否存在是确定事实。span scorer 先验证文档版本和偏移；集合比较处理多值 Reference；律师判断合理解释、严重性和升级；Judge 只补充开放文本质量。伪造 span 和确认的关键漏检不可补偿。[完整案例](examples/contract-agent/evaluation-case.yaml)

### 14.3 企业知识助手

权威核心是问题时点的文档版本、owner、ACL 与全路径日志。ACL/canary scorer 检查检索、上下文、缓存和输出；claim-span scorer 检查原子主张；owner 与安全评审处理冲突；Judge 不得把“回答看起来有帮助”变成泄露免责。[完整案例](examples/knowledge-assistant/evaluation-case.yaml)

## 15. 工程模板

| 模板 | 用途 |
|---|---|
| [Scorer Charter](scorer-charter.yaml) | 锁定评分用途、权威顺序、不可补偿规则与边界 |
| [Scoring Unit Spec](scoring-unit-spec.yaml) | 定义 claim、call、transition、turn、trajectory、trial 的身份与聚合边界 |
| [Observation Contract](observation-contract.yaml) | 定义评分所需完整观察包、完整性、不可变性与访问控制 |
| [Scoring Rubric](scoring-rubric.yaml) | 定义分析式维度、量尺、锚点、关键错误和不可评分 |
| [Adjudication Protocol](adjudication-protocol.yaml) | 定义分歧分类、独立仲裁、原始记录与反馈 |
| [Scorer Manifest](scorer-manifest.yaml) | 锁定 scorer 身份、实现类型、优先级、输出与失败行为 |
| [Scorer Validation Report](scorer-validation-report.yaml) | 记录可靠性、效度、校准、错误、偏差、稳健性与安全证据 |
| [Scorer Quality Gate](scorer-quality-gate.yaml) | 决定 scorer 是否具备进入后续 trial 准备的资格 |

## 16. 可执行设计审查：Reference-to-scorer review

本实验只审查设计资产，不运行候选系统：

1. 从 A1.5 复制精确 Target、Construct、Question、Risk、Task、Dataset 和 Reference IDs，不跨案例借用。
2. 选定评分单位，写清身份、父子依赖和聚合终点。
3. 列出 Observation Bundle 六部分；任一关键风险缺少环境状态或事件证据时标记 `unscorable`。
4. 为每个构念建立 analytic dimensions、每档 anchor、required evidence 和 boundary examples。
5. 把关键风险写为不可补偿 critical errors，并指定最强权威 scorer。
6. 组合多个 scorer 时写清 precedence；禁止 Judge 覆盖确定性失败。
7. 定义 uncertain、abstain、unscorable、disagreement 和 inconclusive 的不同动作。
8. 预声明可靠性、效度、校准、错误、偏差、稳健性、安全验证和阈值。
9. 在没有物化证据时保持 Scorer Quality Gate `blocked`。

## 17. 常见判断与参考答案

1. **Reference 就是标准答案文本吗？** 不是。它可以是权威状态、多值集合、不变量或合格专家判断。
2. **Judge 给出 0–10 分就是 Metric 吗？** 不是，那只是一条 Score；Metric 还需要样本集合、分母、聚合和不确定性。
3. **观察缺失能否记零分？** 通常不能。零分是有证据的失败，缺关键证据应 `unscorable`。
4. **两位律师不同意就取平均吗？** 不能。先分类分歧，保留原始判断并独立仲裁；合理解释可能保留多值。
5. **确定性 scorer 是否不需验证？** 仍需。输入捕获、版本、实现和边界都可能错。
6. **Judge 高分能否抵消未授权退款？** 不能。关键确定性失败不可补偿。
7. **一致率高是否证明效度高？** 不证明。评分器可能稳定地测错构念。
8. **Scorer Gate ready 是否表示 Agent 可上线？** 不是。它只表示 scorer 在声明范围有资格进入后续 trial 准备。

## 18. 明确范围与单元结论

本单元的公开候选包证明课程、模板、案例及内部追踪合同已经形成；**不证明 A1.5 数据已物化，不证明 scorer 已实现或校准，不证明任何 trial、Score、Metric、Harness、统计推断或系统发布 Gate 已发生，也不证明生产表现或个人能力。**

一个可信评分器必须能回答：

> 它在判哪个明确单位，读取哪个不可篡改的观察包，依据哪个 Reference 和 Rubric，由哪个版本化实现按什么权威顺序裁决；缺证、分歧和越界时为何不强判；又有什么独立证据证明它在声明范围内足够可靠、有效、校准、稳健且安全？

没有评分单位，分数没有归属；没有 Observation Bundle，Judge 只看到了故事的一部分；没有 Rubric，尺度会随人漂移；没有验证评分器，评测系统只是把未知错误包装成精确数字。
