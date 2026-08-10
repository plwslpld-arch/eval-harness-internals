# A1.7｜从样本级评分到可信指标

> A1.6 解决“某一次运行怎样被可靠裁决”；A1.7 解决“怎样把大量 Score Records 聚合为可以比较、解释和进入后续系统 Gate 的统计证据”。核心结论是：**Metric 不是 Score 的平均值，而是对目标总体中某个决策相关量的版本化统计估计合同。**

[独立 HTML 阅读版](index.html) · [Academy 首页](../../../README.md) · [工程资产清单](artifact-manifest.yaml)

## 1. 学习目标

完成本单元后，应当能够：

1. 严格区分 Construct、Estimand、Estimator、Estimate、Metric 与 Gate。
2. 为指标声明目标总体、分析单位、分母、权重、方向、切片与适用边界。
3. 正确处理重复运行、配对版本、任务簇、文档家族和时间依赖。
4. 解释微平均、宏平均、目标分布加权、条件指标与辛普森悖论。
5. 使用普通、配对、聚类与层级 Bootstrap，并说明其不能修复的偏差。
6. 以效果量、区间、业务意义边界、非劣效或等效边界解释版本比较。
7. 显式处理系统失败、弃权、不可评分、结论不足、选择偏差和多重比较。
8. 建立 Metric Definition、Estimate Record、Comparison Report 和 Metric Quality Gate 的完整证据链。

## 2. Score、Metric 与 Gate 的边界

| 对象 | 回答的问题 | 产物 | 不能冒充什么 |
|---|---|---|---|
| Score Record | 某个评分单位在一次 Scorer 运行中如何被裁决？ | 状态、维度分数、关键错误、证据、理由 | 不能说明总体表现 |
| Metric Definition | 希望估计目标总体中的哪个量？ | 构念、Estimand、分母、聚合和不确定性合同 | 不是一次计算结果 |
| Estimate Record | 某次版本化数据和分析得到了什么估计？ | 点估计、区间、覆盖、切片与局限 | 不自动成为发布决定 |
| Comparison Report | 候选相对基线的效果范围是什么？ | 效果量、可比性、区间与解释 | 不能补偿关键风险 |
| Metric Quality Gate | 统计证据是否具备进入系统决策的资格？ | ready / partial / blocked / invalid | 不是 System Release Gate |

一条 Judge 输出“8 分”仍只是 Score。它没有目标总体、分母、抽样、依赖和区间，不能直接成为“系统质量 8 分”。

## 3. Construct、Estimand、Estimator 与 Estimate

### 3.1 Construct

构念是希望测量的抽象属性，例如退款任务有效性、合同关键风险识别或知识回答有据性。它来自 A1.2，并由 A1.6 的 Rubric 和 Score 字段操作化。

### 3.2 Estimand

Estimand 是属于目标总体的待估量。例如：

> 在下一发布周期符合政策且权威状态可用的退款任务中，Agent 安全完成任务的期望概率。

它必须包含总体、条件、分析单位和数量。Estimand 是问题，不是公式。

### 3.3 Estimator

Estimator 是用有限样本估计该量的方法。简单二元率为：

```text
observed successes / eligible analysis units
```

但只有分母、权重、缺失、依赖和评分器可靠性得到处理时，这个公式才有正确语义。

### 3.4 Estimate

Estimate 是某次实际分析的输出，必须绑定 Target、Dataset、Scorer、Harness、Metric、分析代码和时间。设计模板中的 `not-computed` 不能冒充 Estimate。

## 4. 总体、分析单位与分母

指标至少声明：目标总体、分析单位、纳入条件、排除条件、分母和各种运行状态的处理。分母来自 Estimand，不是“数据清洗后剩下多少”。

必须区分：

- system timeout / crash：通常属于被测系统失败；
- system abstention：由任务和 Rubric 判断正确或错误；
- scorer abstention：评分器识别到越界；
- unscorable：缺少有效评分前提；
- inconclusive：流程完成后仍不足以下结论。

零分表示“有证据确认失败”；`unscorable` 表示“没有判断资格”。二者不能互换，也不能静默删除。

## 5. 微平均、宏平均与目标加权

### 5.1 Micro average

将所有符合条件的单位合并计算，回答随机一条观测的预期结果。高频场景权重大，容易被简单、低风险流量主导。

### 5.2 Macro average

先算每个切片，再等权平均，回答每种场景等权时的平均表现。它会让极小切片与大切片拥有相同权重，不是天然公平。

### 5.3 Target-weighted average

按目标生产总体权重重新聚合，用于风险增强采样与真实流量比例不同的情况。权重必须来自版本化来源、在看结果前确定，并在版本比较中保持一致。

### 5.4 Conditional metric

高风险条件应直接报告：

```text
P(未授权退款 | 审批服务超时)
P(关键条款漏检 | 条款跨页并有附件冲突)
P(ACL 泄露 | 权限已撤销且缓存未刷新)
```

关键风险通常不可补偿，不能只增加一点综合分权重。

## 6. 辛普森悖论与分析单位漂移

如果基线主要评困难任务、候选主要评简单任务，候选总体分数可以上升，即使它在每个难度切片都退化。防护包括：同任务评测、配对比较、相同目标权重、预声明切片与样本构成检查。

Claim、tool call、run、task 和 task family 不能混为独立样本。一份合同产生二十个 claim，不等于二十份独立合同；一百个任务各运行五次，不等于五百个独立业务场景。

## 7. 随机性与层级依赖

不确定性至少来自任务抽样、模型执行、环境变化和评分器误差。典型层级为：

```text
scenario / task family
└── task
    └── repeated run
        └── claim / tool call / state transition
```

重复运行增加对同任务随机性的认识，但不等比例增加对目标任务总体的认识。Cluster key 应选择主要依赖来源，例如 `task_family_id`、`contract_family_id`、`document_family_id`、用户或时间窗口。

## 8. Bootstrap 与非参数估计

Bootstrap 把当前样本的经验分布作为未知总体的近似，有放回地反复抽样并重新计算指标。非参数表示不先强制假设正态分布等固定参数族，但仍要求样本具有代表性、重采样单位正确且簇间具有合理可交换性。

| 数据结构 | 推荐方法 |
|---|---|
| 相对独立任务 | 普通 Bootstrap |
| 同任务版本比较 | Paired Bootstrap |
| 任务内重复运行 | Cluster Bootstrap |
| 配对且存在重复运行 | Paired Cluster Bootstrap |
| 合同家族—合同—运行 | Hierarchical Bootstrap |
| 时间相关生产流量 | Block / time-aware Bootstrap |

重采样必须保持原始依赖结构。对 500 条相关 run 直接普通 Bootstrap 会低估不确定性。

Bootstrap 不能修复总体不代表、极小样本、未观测罕见风险、分布漂移、错误 cluster key、评分器系统偏差或选择性分析。

## 9. 零事件不是零风险

在 `n` 次相对独立试验中观察到零次严重事件，点估计为零，但真实风险并非被证明为零。粗略 95% 上界可用 `3/n` 理解。240 次零事件只支持发生率大致低于 1.25%，若要支持万分之一量级，需要约 30,000 个相对独立且代表风险条件的零事件试验。

罕见事件应结合精确二项区间、Wilson 区间、定向红队、故障注入和风险模型，不能依赖普通 Bootstrap 的零宽度结果。

## 10. 效果量与比较问题

### 10.1 绝对与相对效果

失败率从 0.1% 到 0.2%，绝对增加 0.1 个百分点，相对风险增加 100%。罕见高伤害风险应同时报告两者和预期暴露量。

### 10.2 Superiority

候选是否优于基线。区间完全高于零支持正向效果，但仍需检查是否超过最小有意义差异。

### 10.3 Non-inferiority

候选是否没有退化到不可接受程度。非劣效界值必须在执行前由业务和风险责任人确定，结论依据区间最不利边界，而不是点估计。

### 10.4 Equivalence

两个版本是否足够接近。没有显著差异不等于等效；必须证明完整区间落在预定义等效范围内。

### 10.5 Absolute threshold

候选即使优于不合格基线，也必须满足绝对质量底线。版本比较与绝对达标通常同时需要。

统计显著不等于业务重要；最小可检测差异也不等于最小有意义差异。

## 11. 缺失、弃权与选择偏差

缺失可以是完全随机、条件随机或非随机。AI 系统中常见非随机缺失：越危险的运行越容易超时、崩溃、丢日志或让 Judge 拒判。只分析成功评分样本会产生幸存者偏差。

必须报告完整流转：

```text
sampled → excluded by predeclared rule → executed → system failed
        → scorer abstained → unscorable → scored
```

同时报告 conditional pass rate、scorable coverage、不可评分原因以及缺失全通过/全失败上下界敏感性。

选择性回答系统需要 Coverage、Selective risk、正确/错误弃权、人工负担和 Coverage–Risk 曲线。系统不能通过只回答简单问题制造高准确率。

## 12. 多重比较与分析选择

在真实无差异时，对二十个独立指标各做 5% 检验，至少出现一个偶然“显著”结果的概率约为 64%；一百个指标时约为 99.4%。

必须区分：

- confirmatory：运行前声明主指标、关键指标、切片、阈值、样本量、方法和停止规则；
- exploratory：用于发现新风险，但必须在独立数据中确认。

常见控制包括 Bonferroni、Holm、Benjamini–Hochberg 与同时区间。关键安全事件不依赖显著性免责；观察到不可接受事件即可按政策阻断和调查。

反复查看直到显著再停止属于 optional stopping；同时尝试大量版本再报告最佳值会产生 winner's curse。开发、选择和最终确认数据必须隔离。

## 13. 指标组合而不是综合总分

可信评测通常包含：

1. Primary Metric：主要业务能力；
2. Critical Risk Metrics：不可补偿风险；
3. Guardrails：延迟、成本、拒答、人工负担与群体差距；
4. Diagnostic Metrics：检索、工具和轨迹原因；
5. Evidence-quality Metrics：scorable coverage、缺失、分歧与仲裁。

不能用大量普通任务提升补偿一次未授权写入、伪造引用或 ACL 泄露。

## 14. Metric Quality Gate

| 状态 | 含义 | 允许动作 |
|---|---|---|
| ready | 构念、总体、身份、Scorer、缺失、依赖、不确定性和比较均有独立物化证据 | 进入声明范围的系统 Gate 输入 |
| partial | 仅部分切片或范围证据充分 | 只在明确子范围使用 |
| blocked | 关键证据缺失、支持不足或 Scorer 未就绪 | 补证，不进入正式 Gate |
| invalid | 构念错配、污染、身份错配、分析错误或选择性报告 | 隔离版本并重建 |

Scorer Quality Gate 判断评分器能否使用；Metric Quality Gate 判断统计证据能否进入决策；System Release Gate 才决定发布、灰度、阻断或回滚。

## 15. 三个端到端案例

### 15.1 退款 Agent

按 task family 聚类、同任务和 seed 配对；主要指标为符合条件任务完成率，未授权和重复退款独立不可补偿；审批超时、高价值订单和对抗压力必须切片。当前 Estimate 未执行且 Metric Gate blocked。[查看案例](examples/refund-agent/evaluation-case.yaml)

### 15.2 合同审查 Agent

按合同家族聚类，claim 级有据率不能冒充合同级完整筛查；Critical 漏检和伪造 span 不可补偿；Reference 允许多值解释，文档版本和字符偏移仍需确定验证。[查看案例](examples/contract-agent/evaluation-case.yaml)

### 15.3 企业知识助手

按文档家族聚类；同时报告有据回答、覆盖、正确弃权、人工负担和 ACL 泄露；条件准确率不能掩盖大量拒答，公开知识高分不能补偿权限撤销缓存场景泄露。[查看案例](examples/knowledge-assistant/evaluation-case.yaml)

## 16. 八个工程模板

| 模板 | 用途 |
|---|---|
| [Metric Definition](metric-definition.yaml) | 构念、Estimand、输入、方向、切片与边界 |
| [Population & Denominator](population-denominator.yaml) | 总体、分析单位、纳排、状态处理、流转与权重 |
| [Aggregation Plan](aggregation-plan.yaml) | 层级、重复运行、聚合、关键指标与敏感性 |
| [Uncertainty Plan](uncertainty-plan.yaml) | 依赖、配对、聚类、区间、罕见事件和支持度 |
| [Analysis Plan](analysis-plan.yaml) | 确认性问题、边界、多重比较、停止与探索政策 |
| [Estimate Record](estimate-record.yaml) | 绑定身份、样本流、估计、覆盖、切片和局限 |
| [Comparison Report](comparison-report.yaml) | 可比性、效果、区间、关键回归与解释 |
| [Metric Quality Gate](metric-quality-gate.yaml) | 决定 Metric 证据能否进入系统决策 |

## 17. Score-to-Metric 设计审查

1. 精确继承 A1.6 的 Score schema、Scorer identity 和质量门状态。
2. 写清构念、目标总体、条件、分析单位与待估量。
3. 定义纳入、排除、分母以及 timeout、crash、abstain、unscorable、inconclusive 的处理。
4. 先定义 task 内重复运行汇总，再定义总体聚合和权重。
5. 声明层级、配对和 cluster key；禁止把子项冒充独立任务。
6. 预声明必须切片、缺失上下界和证据覆盖指标。
7. 为普通、配对、聚类、层级或时间依赖选择正确区间方法。
8. 明确优效、非劣效、等效或绝对达标问题及业务意义边界。
9. 区分确认性与探索性分析，控制多重比较与 optional stopping。
10. 绑定 Dataset、Target、Scorer、Harness、Metric 与分析代码身份。
11. 没有物化 Score、Estimate 和独立证据时保持 Metric Gate blocked。

## 18. 常见判断与参考答案

1. **Judge 给 8 分是 Metric 吗？** 不是，只是一条 Score。
2. **五次 run 是五个独立任务吗？** 通常不是，应保留任务簇。
3. **总体提升能否忽略最差切片？** 不能，关键风险需条件指标和独立门禁。
4. **unscorable 能删除吗？** 不能静默删除，要报告覆盖、原因与敏感性。
5. **区间高于零能否上线？** 不能直接推出，还要看业务意义、绝对阈值、关键风险和证据质量。
6. **没有显著差异是否等效？** 不是，等效需要完整区间落入预定义范围。
7. **Bootstrap 十万次一定可信？** 不一定，错误总体或依赖结构不会被重采样修复。
8. **Metric Gate ready 是否代表发布通过？** 不是，只代表统计证据有资格进入 System Gate。

## 19. 明确范围与单元结论

本候选包证明课程、模板、案例和内部追踪合同已经形成；**不证明 A1.5 数据已物化，不证明 A1.6 Scorer 已实现或就绪，不证明真实 trial、Score、Estimate、Comparison、Harness、统计结论或系统发布 Gate 已发生，也不证明生产表现或个人能力。**

一个可信 Metric 必须回答：测量哪个构念、属于哪个目标总体、分析单位和分母是什么、Score 如何进入聚合、权重和切片如何定义、依赖如何保持、区间如何估计、缺失如何处理、比较边界是什么、分析是否预声明，以及凭什么认为证据具备进入决策的资格。

没有这些合同，平均数只是失去上下文的计算；有了这些合同，Score 才能成为可复现、可质疑、可审计的统计证据。
