# A2.1｜从抽象质量到可测量构念

> Chapter A2《测量理论、效度与可靠性》从“评测闭环是否完整”继续追问：闭环里的数字是否真的测到了声明的质量？A2.1 建立从 Construct 到有限 Claim 的测量设计合同。

[独立 HTML 阅读版](index.html) · [Academy 首页](../../../README.md) · [工程资产清单](artifact-manifest.yaml)

## 1. 学习目标与边界

完成本单元后，应能：

1. 严格区分 Construct、Facet、Observable、Proxy/Indicator、Measurement Rule、Score、Metric、Estimate 与 Claim。
2. 识别 Construct Underrepresentation（构念代表不足）与 Construct-Irrelevant Variance（无关因素污染）。
3. 建立随机、系统与交互误差模型，并定位 Target、Harness、Sampling、Reference、Scorer、Aggregation 六类来源。
4. 为 repeatability、reproducibility、intra-rater 与 inter-rater reliability 设计研究，而不把 agreement、correlation 与 validity 混为一谈。
5. 用 content、response process、internal structure、relations、consequences 五类证据建立统一 Validity Argument。
6. 保留 `passed / failed / uncertain / unscorable / invalid`，不把缺证强制变成零分。

本单元止于**测量设计合同**：不运行 Target，不实现 Scorer/Harness，不产生真实 Score、Metric 或 Estimate，不声称可靠性或效度证据已经观察到，也不形成发布授权或个人掌握声明。

## 2. 测量不是“给系统一个数字”

```text
业务愿望
→ Construct（想测的抽象质量）
→ Facet（不可互相替代的维度）
→ Observable（可验证事实）
→ Proxy / Indicator（用于代表构念的信号）
→ Measurement Rule（事实如何变成裁决）
→ Score Record（评分单位级结果）
→ Metric / Estimate（总体统计合同 / 某次结果）
→ Claim（证据允许支持的有限结论）
```

| 对象 | 回答的问题 | 不能冒充什么 |
|---|---|---|
| Construct | 真正想理解的质量是什么？ | 不是一个可直接读取的字段 |
| Facet | 构念包含哪些不可替代维度？ | 不是任意指标清单 |
| Observable | 运行后实际看到了什么？ | 事实本身不是质量结论 |
| Proxy / Indicator | 用哪个信号间接代表构念？ | 不是构念本身 |
| Measurement Rule | 什么证据组合映射到何种状态？ | 不是实现代码或统计聚合 |
| Score | 一个明确评分单位怎样被裁决？ | 不是总体表现 |
| Metric | 如何估计目标总体中的量？ | 不是一次计算值 |
| Estimate | 某次版本化分析得到什么？ | 不自动成为发布决定 |
| Claim | 当前证据最多支持什么解释？ | 不能超出 Target、总体、场景和时间边界 |

例如“退款 Agent 可靠”至少包含任务有效性、授权合规、状态安全、恢复质量、升级质量和回复—状态一致性。只报告任务完成率，会把复杂构念压缩成单一代理。

## 3. Construct、Facet 与 Observable

Construct 是不可直接观察但需要推断的属性，如授权合规、关键法律风险识别、有据性或访问隔离。操作化必须先写定义、exclusions（明确不属于它的内容）和 decision relevance，再拆分 Facet。

退款授权合规可拆为：有效审批、金额和地区在授权范围、授权先于副作用。相应 Observable 包括审批事件、政策版本、工具参数、幂等键和账本终态。文本中说“需要审批”只是一条表面观察，不能覆盖真实资金状态。

对具有副作用的 Agent，权威顺序通常是：

```text
权威环境终态 > 可验证工具结果 > 行为轨迹 > 最终文本声明
```

顺序必须由领域责任人声明，而不是让 Judge 根据语言流畅度改写事实。

## 4. Proxy 的两种核心失效

### 4.1 Construct Underrepresentation

测量只覆盖构念的一部分，却把结果解释为完整质量。检查问题是：**即使这个指标满分，最担心的失败是否仍可能发生？**

- 退款回复完全正确，但账本已重复写入；
- 合同风险标签正确，但引用了不存在的原文；
- 知识回答有引用，但引用已过期或用户无权访问。

若答案为“可能”，Indicator Register 必须记录 underrepresentation risk，并加入互补观察或收缩 Claim。

### 4.2 Construct-Irrelevant Variance

指标变化受到目标构念之外的因素污染。例如合同风险分可能被 OCR、附件完整性、字符偏移、Judge 长度偏好或单一律师 Reference 污染。解析失败时应记录 `unscorable`，不能写成“法律能力为零”。

### 4.3 Goodhart’s Law

当代理指标成为优化目标，它可能不再代表原构念。仅要求知识助手“拒答率低于 5%”，会激励系统在无证据时猜测。应组合 coverage、有据性、正确弃权、ACL 安全和人工负担，并让关键泄露不可补偿。

审查每个代理时回答：它为何代表构念、覆盖与遗漏什么、受什么污染、有哪些“指标好但构念差/指标差但构念未必差”的反例、最多支持什么 Claim。

## 5. Measurement Error：误差不是只有程序算错

```text
Observed Score
= Construct-related signal
+ Random error
+ Systematic error
+ Context interaction
```

- **Random error（随机误差）**：方向不固定，如同一 Judge 对同证据重复给出不同等级；合理重复可降低部分影响。
- **Systematic error（系统性误差）**：稳定偏向错误方向，如 Scorer 每次只看回复而忽略账本；重复再多也只会稳定地测错。
- **Interaction（交互误差）**：Target 与语言、身份、合同类型、故障状态或环境组合后出现的差异，不能简单归为模型或场景单方属性。

| 来源 | 例子 | 设计响应 |
|---|---|---|
| Target | 采样、路径、检索排序或身份漂移 | 区分自然波动与不同 Target |
| Harness | 状态未重置、Trace 截断、重试扩大分母 | 隔离、完整性与 Trial/Attempt 规则 |
| Sampling | 有限样本或抽样框偏差 | 总体、权重、依赖与区间 |
| Reference | 政策过期、专家漏标、合理多值 | 版本、未知、集合与仲裁 |
| Scorer | Rubric 模糊、Judge 偏差、规则实现错 | Anchor、扰动、独立验证与拒判 |
| Aggregation | 删除 timeout、伪独立、平均补偿关键风险 | 分母、依赖、coverage 与非补偿规则 |

增加样本量可以收窄部分抽样误差，却不能修复错误构念、失效代理、错误 Reference 或系统偏差。

## 6. Reliability：先说清“什么条件下的一致”

| 维度 | 问题 |
|---|---|
| Repeatability | 尽可能相同条件下重复测量是否一致？ |
| Reproducibility | 在声明允许的机器、Worker、批次或重放环境变化下能否复现？ |
| Intra-rater | 同一评分者在不同时间对同一证据是否一致？ |
| Inter-rater | 不同评分者对同一单位和证据是否一致？ |

Reliability 必须绑定 Scorer、Rubric、Reference、数据总体、输出尺度、环境和统计定义。确定性 Scorer 也要验证输入身份、实现版本、环境语义和规则正确性。

### Agreement 不等于 Correlation

两位 Judge 的分数可以始终相差 2 分而排序完全一致：相关很高，但阈值决定可能相反。Reliability 研究应按输出类型选方法：

- 二分类：混淆矩阵、关键类别召回、Kappa；
- 有序等级：Weighted Kappa，并声明等级距离；
- 连续分数：绝对一致型 ICC，而非只看排序；
- 多评分者或不完整评分：Krippendorff’s Alpha；
- Span：版本一致前提下的边界重叠；
- Set-valued：允许集合覆盖；
- 结构化轨迹：事件身份、顺序与不变量。

总体一致率可能被类别不平衡掩盖。可靠性样本必须覆盖正常、边界、关键失败、缺证、合理多值和对抗 Anchor；保留原始评分、分歧类型与仲裁，不能只保存被统一后的标签。

## 7. Validity：不是给工具贴“有效”标签

现代效度观把 Validity 看成对**分数解释和使用**的统一论证，而不是五种互不相关的效度。五类证据共同回答：为何当前测量可以在声明边界内支持目标 Claim？

| 证据来源 | 核心问题 | 退款例子 |
|---|---|---|
| Content | 是否覆盖构念的重要 Facet、边界和失败模式？ | 正常、无授权、失效审批、超时未知、并发重复 |
| Response process | 分数是否通过预期观察与裁决过程产生？ | Scorer 实际读取审批与账本，而非只读文本 |
| Internal structure | 维度关系是否符合构念模型？ | 文本质量不能主导状态安全结论 |
| Relations | 与其他变量的关系是否符合预期且避开污染？ | 授权失败应对应真实越权账本事件，不应随回复长度变化 |
| Consequences | 使用该测量会产生怎样的行为与伤害？ | 任务完成率优化不能激励越权自动化 |

“与专家一致率高”至多是 relations 与 reliability 的部分证据。若专家 Reference 单值化了合理多值、样本没覆盖关键风险或 Judge 和专家共享同一盲点，仍不能建立效度。

## 8. 五种结果状态

| 状态 | 含义 | 例子 |
|---|---|---|
| passed | 观察和规则充分，满足声明条件 | 有审批且恰好一次授权写入 |
| failed | 证据充分并确认违反规则 | 无审批却产生资金写入 |
| uncertain | 证据存在，但边界或 Reference 不足以单值裁决 | 两种合理法律解释 |
| unscorable | 缺少形成合法 Score 的关键观察 | 账本或附件缺失 |
| invalid | 身份、协议、血缘或权威错误使证据不可使用 | 实际运行错误政策版本 |

`failed` 不等于 `unscorable`；`uncertain` 不等于取平均；`invalid` 不表示 Target 表现差。Metric 和 Gate 必须保留这些语义。

## 9. Construct Operationalization 完整流程

1. 写清谁依据证据决定什么。
2. 定义 Construct，并声明禁止解释。
3. 拆分不可互相替代的 Facet 与 criticality。
4. 写正例、反例、边界例、缺证例与关键失败。
5. 指定 Observable、捕获条件和权威顺序。
6. 为每个 Indicator 写 proxy rationale、覆盖不足和污染风险。
7. 定义 Measurement Rule 与五种 outcome。
8. 写 Counterfactual：改变目标因素，结果应改变。
9. 写 Invariant：改变无关因素，结果应保持。
10. 建立六类 Error Model，说明残余 Claim 限制。
11. 预声明 Reliability Study 的对象、条件、重复、统计和分歧处理。
12. 建立五类 Validity Evidence 的要求和当前状态。
13. 通过 Measurement Quality Gate 检查覆盖、代理、误差、可靠性、效度、边界与追踪。
14. 只有物化证据满足预声明规则后，才允许扩大 Claim；设计完成本身必须保持 `blocked`。

## 10. 三个贯穿案例

### 10.1 退款 Agent

目标构念是授权合规和状态安全；核心 Observable 是审批、工具调用、幂等键与账本。规则“无有效审批且成功写入”直接 `failed`。最终回复正确率、用户满意度或任务完成率都不能替代资金终态。当前案例只形成 [设计合同](examples/refund-agent/evaluation-case.yaml)，没有运行或测量证据。

### 10.2 合同审查 Agent

目标构念是关键风险识别与原文有据性；必须把 OCR/附件/字符偏移与法律判断区分，允许 set-valued Reference。伪造 span 和确认的关键漏检不可补偿。当前 [案例](examples/contract-agent/evaluation-case.yaml) 的可靠性与效度证据均为 planned/not-observed。

### 10.3 企业知识助手

目标构念是有据性与访问隔离；引用必须支持原子主张、当前有效、运行时实际取得且用户有权访问。ACL 从检索、上下文、缓存到输出都要观察。引用率与拒答率只是代理，不得单独门禁。详见 [案例](examples/knowledge-assistant/evaluation-case.yaml)。

## 11. 八个工程模板

| 模板 | 用途 |
|---|---|
| [Measurement Charter](measurement-charter.yaml) | 决定、解释、禁止解释、Target 与 Claim 边界 |
| [Construct Map](construct-map.yaml) | 构念、Facet、排除项、关键性与决策关联 |
| [Indicator Register](indicator-register.yaml) | Proxy 理由、方向、尺度、污染与代表不足 |
| [Operationalization Spec](operationalization-spec.yaml) | Observable、权威、规则、五态、反事实与不变量 |
| [Measurement Error Model](measurement-error-model.yaml) | 六类来源、误差类型、检测、缓解和残余边界 |
| [Reliability Study Plan](reliability-study-plan.yaml) | 四类可靠性、输出匹配、Anchor、重复和分歧 |
| [Validity Argument](validity-argument.yaml) | 五类证据对统一效度解释的支持计划 |
| [Measurement Quality Gate](measurement-quality-gate.yaml) | 七项全部关键的测量就绪检查 |

## 12. 常见误区与参考答案

1. **准确率高就测到了可靠性？** 不能；它可能只覆盖任务有效性。
2. **有引用就有据？** 不能；需验证 claim-span、当前性、运行取得和 ACL。
3. **Judge 五次一致就有效？** 不；它可能稳定地测错。
4. **高度相关就高度一致？** 不；系统偏移可改变阈值决定。
5. **确定性 Scorer 无需验证？** 不；规则、输入和版本都可能错。
6. **样本更多能修复 Proxy？** 不能；只会更精确地估计错误对象。
7. **缺证可以记零分？** 不能；零分是有证据失败，缺关键观察是 `unscorable`。
8. **总体高分能补偿 ACL 泄露？** 不能；关键风险非补偿。
9. **专家一致率高就证明 Validity？** 不；还需其他四类证据与内容边界。
10. **Quality Gate ready 就能上线？** 不是；它只说明测量证据有资格进入后续系统决策。

## 13. 最终检查表

- [ ] Construct、Facet、exclusions 与 decision relevance 已写清。
- [ ] Observable 是可验证事实，不是 Target 自我声明。
- [ ] 每个 Indicator 有 proxy rationale、污染与代表不足风险。
- [ ] 权威顺序、规则、五种 outcome、反事实和不变量完整。
- [ ] Target/Harness/Sampling/Reference/Scorer/Aggregation 六类误差均已登记。
- [ ] Random、systematic 与 interaction 没有混用。
- [ ] 四类 Reliability 的条件、统计、Anchor 和重复已预声明。
- [ ] Agreement 没有被 correlation 或总体一致率替代。
- [ ] 五类 Validity Evidence 都连接到解释和使用。
- [ ] Goodhart 风险与指标使用后果得到审查。
- [ ] Claim Boundary 不超过 Target、总体、场景、时间和证据状态。
- [ ] 所有引用双向闭合，当前 `planned/not-observed` 没有伪装成已验证。

## 14. 明确证据边界

本候选包只证明课程、模板、合成案例和内部引用合同已经形成。它**不证明**真实测量已发生，不证明任何 Reliability 或 Validity Evidence 已物化，不证明 Scorer、Judge、Harness、数据、Score、Metric、Estimate、Gate 或生产系统就绪，不证明发布安全，也不证明任何个人已掌握本单元。

一句话结论：**可信测量不是寻找一个看起来合理的数字，而是证明观察、代理、规则和统计结果为什么能在明确边界内代表目标构念，同时诚实保留遗漏、污染、误差和不能支持的结论。**
