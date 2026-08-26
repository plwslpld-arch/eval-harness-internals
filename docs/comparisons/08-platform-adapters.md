# 平台适配器：LangSmith、Phoenix、MLflow 与 Braintrust 应该接在哪里

> 这些平台都能保存数据集、Trace、反馈或实验结果，但它们并不能替代本仓库的六条主源码课程——本章会把平台能力放回统一对象中，解释适配器应该接住什么、不能凭字段名假设什么，以及怎样避免平台模型反过来污染 Eval Harness 的语义。

![平台适配器边界](../assets/diagrams/platform-adapter-boundaries.svg)

## 为什么单独讲适配器

团队经常先选定观测或实验平台，再把平台里的 `run`、`trace`、`score` 字段直接当成评测系统的事实模型，因为这样很快就能做出第一版，却也会随即遇到三个问题：

1. 同名字段语义并不相同，
2. 平台没有的概念会被悄悄丢失，
3. 更换平台时，评测协议也被迫重写。

在接入任何平台之前，先定义下面这份内部合同会更稳妥，因为对象的先后关系一旦固定，Adapter 才知道哪些语义必须保留，哪些平台字段只能充当外部表示。

```text
Dataset → Sample → Trial → Attempt → Observation → Score → Metric → Gate
                         │                │
                         └── Trace ───────┘
```

平台适配器只负责导入或导出这些对象，至于对象本身代表什么，仍由内部合同决定。边界就在这里——Adapter 不能越位。

## 四类平台各自擅长什么

下表给出的是工程定位，而不是功能排行榜，因为平台能力会随版本变化，所以真正接入时仍要拿实际 API 和锁定版本逐项复核。

| 平台 | 常见优势 | 适合承担的适配器角色 | 不能默认等价的概念 |
| --- | --- | --- | --- |
| LangSmith | LLM/Agent Trace、Dataset、反馈与实验 | Trace 导入、Dataset 同步、Score 导出 | Attempt 恢复语义、独立发布授权 |
| Phoenix | OpenTelemetry 观测、Trace、评测与分析 | Trace/Span 导入、评测结果导出 | 预声明 Trial Plan、统计分母 |
| MLflow | 实验、参数、Artifact、指标与模型生命周期 | Run 元数据、Artifact、Metric 导出 | Agent 环境终态、Trial/Attempt 区分 |
| Braintrust | Dataset、实验、Scorer、日志与比较 | Dataset/Experiment 同步、Score 导出 | 本仓库的 canonical Attempt 与 Gate 状态机 |

“不能默认等价”并不是断言平台一定缺少这项能力，而是提醒实现者，在完成合同映射和验证之前，不能仅凭相似的字段名称就认定两边语义相同。

## 先写 Capability Contract

每个 Adapter 都应该公开一份如下所示的能力合同，并把每项能力的状态和已知限制写清楚，让调用方在导入或导出之前就知道会不会发生语义损失。

```yaml
adapter: example-platform
direction: bidirectional
capabilities:
  dataset: full
  sample_identity: full
  trial_identity: partial
  attempt_recovery: unavailable
  trace_import: full
  artifact_digest: partial
  score_lineage: partial
  metric_export: full
  release_gate: unavailable
limitations:
  - 平台 run_id 不包含预声明 Trial 身份
  - 导入 Trace 时无法恢复 canonical Attempt
```

状态只允许下面三种，不再另设含糊的布尔开关：

- `full`：已证明可以保持该语义，
- `partial`：能传输部分信息，但存在明确损失，
- `unavailable`：接口不能表达，或适配器没有实现。

不要使用模糊的 `supported: true`，因为平台能够保存一个数字分数，并不代表它也保存了 Score 与 canonical Attempt、Observation Bundle、Scorer 版本之间的血缘。能力要逐项证明。

## 入站适配：从平台导入 Trace

假设 Agent 已经在平台里产生了一条 Trace，那么入站 Adapter 在把它交给本地合同之前，至少要完成下面五件事：

1. 读取 Trace 和 Span，
2. 规范化时间、父子关系和事件顺序，
3. 把工具输入输出转换成受控 Artifact 或 Observation，
4. 记录来源平台、对象 ID 和导入时间，
5. 对无法恢复的语义显式标记缺失。

推荐的数据结构如下所示，它把来源、事件和能力快照放在同一个导入结果里，因此后续分析不必脱离当时的 Adapter 能力去猜测字段可信度。

```json
{
  "trace_id": "local-trace-01",
  "source": {
    "adapter": "platform-x",
    "external_trace_id": "tr_123",
    "imported_at": "2026-08-24T00:00:00Z"
  },
  "events": [],
  "capability_snapshot": {
    "causal_order": "full",
    "artifact_digest": "partial",
    "attempt_identity": "unavailable"
  }
}
```

如果 Trace 没有 Trial 身份，Adapter 就不能自行猜出一个身份，而应该由调用方明确地把它绑定到新建 Trial，或者只把它当作等待分析的外部 Observation。身份不能靠猜。

## 出站适配：把 Eval 结果写回平台

出站 Adapter 通常服务于可视化和协作，因此写回平台时应优先保留下面这些能够支撑追溯的内容：

- Trial ID 与 Attempt ID，
- Target、Dataset、Scorer 的版本摘要，
- Score 的状态、值、理由和证据引用，
- Metric 的统计单位、分母与不确定性，
- Gate 的规则结果，但不要把平台标签当作发布授权。

如果平台字段装不下完整合同，与其删掉无法展开的字段，不如把这部分合同保存成版本化 JSON Artifact，例如下面的形式就能让信息跨过平台边界后仍可恢复。

```json
{
  "schema": "eval-harness.score.v1",
  "trial_id": "trial-001",
  "canonical_attempt_id": "attempt-002",
  "observation_digest": "sha256:...",
  "scorer_digest": "sha256:...",
  "status": "passed",
  "value": 1
}
```

## Dataset 同步为什么危险

双向同步 Dataset 之前，必须先决定哪个系统才是身份真相源，否则平台和本地只要有一边允许原地修改，下面这些冲突就很难被察觉：

- 平台允许就地修改样本，而本地运行引用旧内容，
- 样本 ID 不变，但输入或参考答案发生变化，
- 附件只保存可变 URL，没有内容摘要，
- 删除平台样本导致历史 Run 无法重放。

为了让历史 Run 在同步之后仍能解释，可以采用下面这组规则：

1. Eval Plan 引用不可变 Dataset revision，
2. 每个 Sample 有内容摘要，
3. 同步是生成新 revision，不覆盖历史 revision，
4. Run 保存实际展开后的 Sample 身份，
5. 平台删除不级联删除本地证据。

## Trace 与 Trial 不是一回事

一个 Trial 可能没有模型 Trace，例如它只执行纯规则函数，而带有环境初始化、Agent 执行和评分 Judge 的 Trial 又可能产生多条 Trace。反过来，一条平台 Trace 也可能只是开发阶段的调试调用，根本不属于任何预声明 Eval Trial。

因为两者不是同一个层级的对象，所以不要采用下面这种把平台 Trace ID 与 Trial ID 直接等同起来的硬编码。

```text
platform_trace_id == trial_id
```

真正需要表达的关系更接近下面这种 Trial、Attempt、Trace 和 Score 的关联形式，其中 Score 最终绑定的是 canonical Attempt 的 Observation。

```text
Trial 1 ── 1..N Attempt
Attempt 1 ── 0..N Trace
Trace 1 ── 1..N Event/Span
Score ── 绑定一个 canonical Attempt 的 Observation
```

## 平台 Scorer 与本地 Scorer 怎样共存

平台 Scorer 和本地 Scorer 不必互相替代，只要把执行位置与正式结果的归属讲清楚，它们就可以按下面三种模式共存。

### 模式 A：平台只存结果

Scorer 在本地运行，而 Adapter 只把 Score 和血缘写到平台，因此评测语义最容易由本地合同控制，也更适合需要稳定证据链的发布门禁。

### 模式 B：平台执行 Scorer

Adapter 发起平台评测再导回结果时，必须同时记录平台评测定义、模型、Prompt、版本和原始响应，而超时与解析失败也要保留为独立状态，不能折叠成一个看似有效的 0 分。

### 模式 C：双重评分

当同一个 Observation 同时送给本地和平台 Scorer 做校准或迁移时，两个 Score 仍是由不同 Scorer 产生的独立事实，因此不能在看到结果后再挑较高者充当正式分数。

## Gate 为什么必须留在独立边界

平台可以展示比较结果、触发 CI 或发送通知，但这些动作还不足以构成发布 Gate，因为真正的 Gate 至少还需要下面几类输入：

- 冻结的 Eval Plan，
- 明确的统计单位和分母，
- 缺失证据策略，
- 多规则组合逻辑，
- 审批或发布系统的责任边界。

Adapter 可以导出 `gate_status=passed`，但这个字段只代表本仓库规则算出的结果，并不会自动变成“允许生产发布”。只有当组织的发布系统明确把该 Gate 注册成授权输入时，两者才真正建立联系。

## 一个可测试的 Adapter 接口

```python
from typing import Protocol

class TraceImporter(Protocol):
    capability_contract: dict[str, str]

    def import_trace(self, external_id: str) -> "ImportedTrace": ...

class ResultExporter(Protocol):
    capability_contract: dict[str, str]

    def export_score(self, score: "ScoreEnvelope") -> "ExportReceipt": ...
```

测试不能只断言“API 返回 200”，因为传输成功并不能证明语义完整，至少还要覆盖下面这些会影响证据可信度的行为：

- 身份字段是否稳定往返，
- 丢失字段是否按合同报告，
- 重复导出是否幂等，
- 外部对象被修改后是否能检测漂移，
- 凭证或敏感内容是否被日志过滤，
- 平台不可用时是否保留本地正式结果。

## 选型时问的八个问题

1. Dataset 是否有不可变 revision？
2. Trace 是否保留稳定的因果顺序？
3. Artifact 是否能绑定内容摘要？
4. Scorer 定义是否可版本化和导出？
5. 错误、跳过和无效是否区别于数值 0？
6. Metric 是否能展示真实统计分母？
7. 数据导出后能否独立重放关键结论？
8. 平台停用时，Eval Plan 与原始证据是否仍然可用？

如果前六个问题里出现了多个“不确定”，就应该先把平台定位成观测与协作层，而不要让它独自承担评测系统的事实源。先保住证据。

## 自测题与参考答案

### 题 1

平台有 `run_id`，能否直接映射成本仓库 Trial ID？

**参考答案：**不能仅凭名称映射，因为只有在核对它会稳定绑定 Sample、Target、配置、环境和计划身份之后，才能判断两边是否指向同一个 Trial。若它只代表一次 API 调用，最多只能作为 Trace 或 Attempt 的外部标识。

### 题 2

平台不能保存 canonical Attempt，应如何声明？

**参考答案：**应将 `attempt_recovery` 标为 `unavailable` 或 `partial`，同时把完整的 Score Envelope 作为 Artifact 保存，这样后续分析就不必从已经丢失 Attempt 语义的平台聚合结果里反推正式分母。

### 题 3

为什么不把平台的“实验通过”直接当作发布授权？

**参考答案：**实验结果只提供决策所需的证据，而发布授权还要结合风险、审批、环境和责任边界才能形成组织决定，所以两者可以通过明确政策连接，却不能默认等价。

## 继续阅读

- [Trace、Artifact 与血缘](03-trace-artifact-lineage.md)
- [Report、CI 与 Release Gate](07-report-ci-release-gate.md)
- [Run Identity 与可复现性](../engineering/02-run-identity-and-reproducibility.md)
- [LLM-as-a-Judge](../engineering/04-llm-as-judge.md)
- [验证与证据边界](../appendices/verification.md)
