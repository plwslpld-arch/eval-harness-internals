# A1.8 从评测证据到质量决策

> 本单元讨论如何把评测结果转化为可审计、可执行、可回滚的质量决策。配套数据与结论均为合成教学材料，不代表真实产品已通过评测、获得发布授权或具备生产质量。

## 学习目标

完成本单元后，应能：

1. 区分估计结果、证据评估、门禁判断、质量决策与发布动作；
2. 将业务风险转写为可版本化的质量基线与门禁策略；
3. 正确处理 `passed`、`failed`、`inconclusive` 和 `ready`、`partial`、`blocked`、`invalid`；
4. 设计多层 Gate DAG，阻止无效证据向下游传播；
5. 将门禁接入 CI/CD、灰度发布、生产监控和事故回流；
6. 解释 Partial、Waiver、Override、Risk Acceptance 的边界和治理要求。

## 1. 评测结果不是发布决定

一条严谨的决策链包含五层：

```text
Estimate
  -> Evidence Assessment
  -> Gate Evaluation
  -> Gate Decision
  -> Release Action
```

- **Estimate**：准确率、风险率、差值、置信区间等统计估计。
- **Evidence Assessment**：判断样本、数据、Harness、Scorer 和 Metric 是否足以支持结论。
- **Gate Evaluation**：依据版本化策略，对所有必需检查进行机械计算。
- **Gate Decision**：形成 `ready`、`partial`、`blocked` 或 `invalid` 的不可变记录。
- **Release Action**：根据质量决定、授权与运行条件执行禁止、受限发布、灰度或回滚。

不能把“平均分提高”直接写成“允许发布”。统计结果只回答被定义的问题；发布决定还依赖证据有效性、关键风险、适用范围与治理授权。

## 2. Quality Baseline：先定义什么叫足够好

[quality-baseline.yaml](quality-baseline.yaml) 固化目标、风险等级、适用范围、指标角色、阈值、组合规则和证据要求。基线必须在读取候选结果之前批准，避免看到结果后调整阈值。

### 2.1 指标角色

| 角色 | 回答的问题 | 典型处理 |
|---|---|---|
| `primary` | 核心能力是否达到目标 | 必须满足预先定义的统计判定 |
| `critical_safety` | 严重风险是否受控 | 非补偿性；失败或证据不足即阻断 |
| `evidence_quality` | 证据能否支持上述判断 | 覆盖率、缺失率、有效样本量等 |
| `required_slice` | 关键子群体是否达标 | 不允许被总体均值掩盖 |
| `diagnostic` | 为什么变化 | 用于定位，不单独授权发布 |

关键风险必须采用否决规则。一个高能力分数不能抵消权限越界、隐私泄露或危险工具调用。

### 2.2 阈值应约束决策量

若问题是“候选是否优于基线”，可约束差值置信区间下界；若问题是“事故率是否低于上限”，可约束风险率置信区间上界。点估计恰好越线但不确定性仍跨越阈值时，结论应为 `inconclusive`，而不是勉强通过。

## 3. Gate Policy：把基线变成机械规则

[gate-policy.yaml](gate-policy.yaml) 定义允许状态、判定顺序、阻断条件、Partial 条件、Waiver 资格与传播规则。策略需要满足：

- 同一输入和同一策略版本产生同一结果；
- 关键检查失败或证据不足不能被平均分覆盖；
- 任何身份不匹配、证据过期或链路断裂会使结论失效；
- 决策记录不可原地改写，只能产生新版本并保留旧记录。

### 3.1 三值检查与四值质量状态

检查结果：

- `passed`：证据支持要求已满足；
- `failed`：证据支持要求未满足；
- `inconclusive`：现有证据不足以做出通过或失败结论。

质量状态：

- `ready`：所有必需证据有效，所有必需检查通过；
- `partial`：只有边界明确、可强制隔离且完整通过的子范围可用；
- `blocked`：要求失败，或关键要求的证据不足；
- `invalid`：候选、数据、Harness、Scorer、Metric 或作用域身份不一致，当前判断不能使用。

`inconclusive` 不是 `failed` 的同义词，但对关键发布门禁必须同样阻断。差别在后续动作：失败通常要求修复，证据不足通常要求补样本、修复覆盖或重新评测。

## 4. Gate DAG：质量是依赖图，不是一个总分

[gate-dependency-graph.yaml](gate-dependency-graph.yaml) 将质量门禁建模为有向无环图：

```text
Target Gate -> Data Gate ----------------------+
                    Harness Gate -> Scorer Gate +-> Metric Gate -> System Gate -> Release Gate
```

七类核心 Gate 分别验证：候选身份、数据有效性、执行环境、评分器、指标解释、系统级约束和发布授权。传播规则是：

- 上游 `invalid`，依赖它的下游不能 `ready`；
- 上游 `blocked`，下游不能据此授权；
- 上游 `partial`，下游范围只能取所有前置范围的交集；
- 下游不得扩大语言、任务、工具、用户、地区或数据边界；
- 每个下游结论必须能追溯到全部前置证据身份。

## 5. Evidence Manifest：证明这次判断到底用了什么

[evidence-manifest.yaml](evidence-manifest.yaml) 是一次决策的证据清单，至少包含：候选身份、数据集版本、Harness 版本、Scorer 身份、Metric 定义、作用域、生成时间和前置 Gate 状态。

它解决三类常见错误：把旧数据用于新候选、把不同运行的结果拼接、以及在某个子范围通过后宣称整个系统通过。真实 `ready` 决策必须引用已经物化且可复验的证据；设计占位符不能充当生产证据。

## 6. Gate Evaluation 与 Gate Decision

[gate-evaluation.yaml](gate-evaluation.yaml) 保存策略对证据的机械计算结果；[gate-decision.yaml](gate-decision.yaml) 保存经治理确认的质量决定。二者分开是为了让“规则算出了什么”和“组织正式批准了什么”可分别审计。

一个决定至少应记录：

- 输入证据与策略的不可变身份；
- 每个检查的三值状态和理由；
- 阻断检查的精确集合；
- 允许与禁止范围；
- 范围隔离控制；
- 决策者、时间、到期或失效条件；
- 是否允许进入发布授权流程。

## 7. Partial、Waiver、Override 与 Risk Acceptance

### Partial

`partial` 表示一个可强制隔离的子范围已经完整通过，并不是“整体差一点通过”。必须同时给出非空的允许范围、禁止范围和可验证的隔离控制；允许范围必须是所有前置范围的交集或子集。

### Waiver

[waiver-request.yaml](waiver-request.yaml) 记录对可豁免要求的临时风险接受。Waiver：

- 不能修改原 Gate Decision；
- 不能把失败伪装为通过；
- 必须有负责人、理由、补偿控制、最小范围和明确到期时间；
- 不能豁免标为 `nonwaivable` 的关键要求；
- 到期、范围扩大或控制失效后必须自动失效。

### Override 与 Risk Acceptance

Override 是有权限的主体改变自动化动作，应作为独立、罕见且强审计事件处理。Risk Acceptance 是治理主体明确接受剩余风险。两者都不能改写评测事实，也不能删除原始失败证据。

## 8. Release Disposition 与 CI/CD

[release-disposition.yaml](release-disposition.yaml) 把质量状态转为具体发布处置。推荐流水线：

1. 计算变更影响并冻结候选身份；
2. 选择匹配的基线、数据、场景与策略版本；
3. 运行 Harness，生成不可变证据包；
4. 异步等待评测完成，不把“尚未完成”当成成功；
5. 校验身份与证据闭环，计算 Gate Evaluation；
6. 生成不可变 Gate Decision；
7. 单独执行发布授权；
8. 灰度期间持续检查硬事件与窗口指标；
9. 触发条件满足时冻结、撤销授权或回滚。

CI 成功只证明指定自动检查成功，不自动等于业务发布授权。生产部署还需要环境、权限、变更窗口和责任人等控制。

## 9. 生产质量闭环

[production-response-policy.yaml](production-response-policy.yaml) 定义生产信号、硬事件、窗口指标、动作与事故回流。至少覆盖：

- 模型或提示变化导致的能力退化；
- 输入分布、语言或用户群变化；
- 幻觉、偏见、越权或危险工具调用上升；
- 评分器、日志、采样或监控链路失效；
- 延迟、错误率、成本和依赖服务异常。

硬事件应直接触发冻结、撤销或回滚，而不是等待总体平均指标变差。事故样本必须经过脱敏、归因、场景族扩展和回归保护后进入新的评测资产，避免只把单个事故样本硬编码进测试集。

## 10. 三个合成案例

### 退款 Agent：关键证据不足，整体阻断

[refund-agent/evaluation-case.yaml](examples/refund-agent/evaluation-case.yaml) 中能力指标通过，但未授权退款率的关键证据不足。正确结论是 `blocked`；不能以能力收益或 Shadow 模式替代关键安全证据。

### 合同审查 Agent：可隔离子范围，形成 Partial

[contract-agent/evaluation-case.yaml](examples/contract-agent/evaluation-case.yaml) 只有中文、正文、机器可读输入、风险初筛这个交集完整通过，并配置附件识别和人工路由，因此可形成合成 `partial` 决策。英文、附件、OCR 退化输入和最终法律批准仍被禁止。

### 知识助手：ACL 关键检查失败，不可豁免

[knowledge-assistant/evaluation-case.yaml](examples/knowledge-assistant/evaluation-case.yaml) 的回答质量通过，但访问控制关键检查失败。该要求不可补偿、不可豁免，必须阻断并进入修复与重评。

## 11. 配套契约

| 契约 | 用途 |
|---|---|
| [quality-baseline.yaml](quality-baseline.yaml) | 定义质量要求与证据门槛 |
| [gate-policy.yaml](gate-policy.yaml) | 定义确定性判定规则 |
| [gate-dependency-graph.yaml](gate-dependency-graph.yaml) | 定义 Gate 依赖与传播 |
| [evidence-manifest.yaml](evidence-manifest.yaml) | 固化一次判断的证据身份 |
| [gate-evaluation.yaml](gate-evaluation.yaml) | 保存机械评估结果 |
| [gate-decision.yaml](gate-decision.yaml) | 保存不可变质量决定 |
| [waiver-request.yaml](waiver-request.yaml) | 管理临时风险接受 |
| [release-disposition.yaml](release-disposition.yaml) | 将决定映射为发布动作 |
| [production-response-policy.yaml](production-response-policy.yaml) | 定义监控、回滚与事故回流 |

## 12. 决策审查清单

- 业务风险是否已经转成版本化、预先批准的质量基线？
- 候选、数据、Harness、Scorer、Metric 和作用域身份是否完全一致？
- 关键风险是否采用非补偿、不可任意豁免的规则？
- 置信区间或其他不确定性是否进入判定，而非只看点估计？
- 所有 `inconclusive` 是否得到与风险相称的处理？
- Gate DAG 是否无环、无悬空节点并可追溯到 Release Gate？
- `partial` 是否有真实可执行的范围隔离？
- Waiver 是否独立、最小化、有补偿控制且会到期？
- Release Action 是否与 Gate Decision 一致且没有扩大范围？
- 生产硬事件是否能自动冻结、撤销或回滚？
- 事故是否能转化为可复验的评测与回归资产？

## 证据边界

本单元证明公开课程、机器可读契约和合成案例已经存在，并可由仓库校验器检查其结构与关键语义。它不证明任何真实模型、Agent、数据集、评分器、发布流程或生产系统已经通过质量门禁，也不构成对学习者个人能力的独立认证。
