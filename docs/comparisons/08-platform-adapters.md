# 平台适配器：LangSmith、Phoenix、MLflow 与 Braintrust 应该接在哪里

> 这些平台都能保存数据集、Trace（轨迹）、反馈或实验结果，却替代不了本仓库的六条主源码课程。本章会按统一对象重新梳理平台能力，说明适配器应该接住什么、哪些语义不能只看字段名来猜，以及怎样避免平台模型反过来污染 Eval Harness。

![平台适配器边界](../assets/diagrams/platform-adapter-boundaries.svg)

## 为什么单独讲适配器

团队经常先选好观测或实验平台，再把平台里的 `run`、`trace`、`score` 字段直接搬来描述评测事实。这样确实很快就能做出第一版，但紧接着会碰到三个问题：

1. 同名字段语义并不相同，
2. 平台没有的概念会被悄悄丢失，
3. 更换平台时，评测协议也被迫重写。

接入平台之前，应该先用下面这份内部合同把对象之间的先后关系定下来。关系定清楚以后，Adapter 才知道哪些语义必须完整带过去，哪些平台字段只能用来表示外部对象。

```text
Dataset → Sample → Trial → Attempt → Observation → Score → Metric → Gate
                         │                │
                         └── Trace ───────┘
```

平台适配器只管导入或导出这些对象，对象究竟代表什么，仍然由内部合同说了算。Adapter 的边界就在这里，不能越位。

## 四类平台各自擅长什么

下表只说明各个平台适合接在哪一层，不给功能排高低。平台能力会随版本变化，真正接入时，你还得对着实际 API 和锁定版本逐项核对。

| 平台 | 常见优势 | 适合承担的适配器角色 | 不能默认等价的概念 |
| --- | --- | --- | --- |
| LangSmith | LLM/Agent Trace、Dataset、反馈与实验 | Trace 导入、Dataset 同步、Score 导出 | Attempt 恢复语义、独立发布授权 |
| Phoenix | OpenTelemetry 观测、Trace、评测与分析 | Trace/Span 导入、评测结果导出 | 预声明 Trial Plan、统计分母 |
| MLflow | 实验、参数、Artifact、指标与模型生命周期 | Run 元数据、Artifact、Metric 导出 | Agent 环境终态、Trial/Attempt 区分 |
| Braintrust | Dataset、实验、Scorer、日志与比较 | Dataset/Experiment 同步、Score 导出 | 本仓库的 canonical Attempt 与 Gate 状态机 |

「不能默认等价」不代表平台一定没有这项能力。这里提醒你的是，在映射并验证合同之前，别因为两边的字段名称相似，就认定它们表达的是同一件事。

## 先写 Capability Contract

每个 Adapter 都应该公开一份下面这样的能力合同，把各项能力目前是什么状态、有哪些已知限制写清楚，让调用方在导入或导出之前就能判断语义会不会丢。

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

不要只写一个模糊的 `supported: true`。平台能保存数字分数，不等于它也保存了 Score 怎样连到 canonical Attempt、Observation Bundle 和 Scorer 版本，这些能力都要逐项拿证据证明。

## 入站适配：从平台导入 Trace

假设 Agent 已经在平台里留下了一条 Trace，入站 Adapter 要先做好下面五件事，才能把这条记录交给本地合同：

1. 读取 Trace 和 Span，
2. 规范化时间、父子关系和事件顺序，
3. 把工具输入输出转换成受控 Artifact 或 Observation，
4. 记录来源平台、对象 ID 和导入时间，
5. 对无法恢复的语义显式标记缺失。

推荐的数据结构如下，它把来源、事件和能力快照一起放进导入结果。以后分析这条记录时，你可以结合当时的 Adapter 能力判断字段有多可信，不必脱离上下文去猜。

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

如果 Trace 没带 Trial 身份，Adapter 不能自己编一个出来。调用方要么明确把它绑定到新建的 Trial，要么先把它当作等待分析的外部 Observation。身份只能来自明确关系，不能靠猜。

## 出站适配：把 Eval 结果写回平台

出站 Adapter 通常要把结果送去展示或协作，因此写回平台时，应优先保留下列能够一路追查来源的内容：

- Trial ID 与 Attempt ID，
- Target、Dataset、Scorer 的版本摘要，
- Score 的状态、值、理由和证据引用，
- Metric 的统计单位、分母与不确定性，
- Gate 的规则结果，但不要把平台标签当作发布授权。

如果平台字段装不下完整合同，不要顺手删掉放不进去的部分，可以把完整合同另存为带版本的 JSON Artifact。采用下面这种形式以后，信息跨过平台边界仍然可以恢复。

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

双向同步 Dataset 之前，必须先定好由哪个系统提供权威身份。只要平台或本地有一边允许原地修改，而两边又都以为自己说了算，下面这些冲突就很难及时发现：

- 平台允许就地修改样本，而本地运行引用旧内容，
- 样本 ID 不变，但输入或参考答案发生变化，
- 附件只保存可变 URL，没有内容摘要，
- 删除平台样本导致历史 Run 无法重放。

为了让历史 Run 在同步之后仍然说得清当时用了什么数据，可以采用下面这组规则：

1. Eval Plan 引用不可变 Dataset revision，
2. 每个 Sample 有内容摘要，
3. 同步是生成新 revision，不覆盖历史 revision，
4. Run 保存实际展开后的 Sample 身份，
5. 平台删除不级联删除本地证据。

## Trace 与 Trial 不是一回事

有些 Trial 只执行纯规则函数，根本不会产生模型 Trace。另一些 Trial 要初始化环境、运行 Agent，再交给 Judge 评分，过程中又可能留下多条 Trace。反过来，平台里的一条 Trace 也可能只是开发时的调试调用，从来没归入任何预先声明的 Eval Trial。

Trace 和 Trial 处在不同层级，因此不要把平台 Trace ID 直接硬编码成 Trial ID，就像下面这样。

```text
platform_trace_id == trial_id
```

真正要表达的是下面这组关系：一个 Trial 可以有多次 Attempt，每次 Attempt 可以留下多条 Trace，而 Score 最后会绑定到从 canonical Attempt 冻结出来的 Observation。

```text
Trial 1 ── 1..N Attempt
Attempt 1 ── 0..N Trace
Trace 1 ── 1..N Event/Span
Score ── 绑定一个 canonical Attempt 的 Observation
```

## 平台 Scorer 与本地 Scorer 怎样共存

平台 Scorer 和本地 Scorer 不必二选一。只要先说清各自在哪里执行、哪一份算正式结果，它们就可以按下面三种模式共存。

### 模式 A：平台只存结果

Scorer 留在本地运行，Adapter 只把 Score 和血缘写到平台。这样最容易让本地合同管住评测语义，也更适合要求证据链稳定的发布门禁。

### 模式 B：平台执行 Scorer

Adapter 发起平台评测并导回结果时，要把平台采用的评测定义、模型、Prompt、版本和原始响应一起记下来。超时和解析失败也要各自保留状态，不能压成一个看起来有效的 0 分。

### 模式 C：双重评分

做校准或迁移时，同一个 Observation 可以同时交给本地和平台 Scorer，但它们产出的两个 Score 仍是彼此独立的事实。看完结果以后再挑较高者充当正式分数，会破坏预先约定的评分规则。

## Gate 为什么必须留在独立边界

平台可以展示比较结果、触发 CI 或发送通知，但做到这些还不算建成了发布 Gate。真正的 Gate 至少还要读入下面几类信息：

- 冻结的 Eval Plan，
- 明确的统计单位和分母，
- 缺失证据策略，
- 多规则组合逻辑，
- 审批或发布系统的责任边界。

Adapter 可以导出 `gate_status=passed`，但这个字段只表示本仓库按规则算出了通过结果，不会自动授予生产发布权限。只有组织的发布系统明确把这个 Gate 注册为授权输入以后，评测判定才真正接进发布流程。

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

测试不能只断言「API 返回 200」，因为数据传过去了，不代表语义也完整保留下来。至少还要覆盖下面这些会影响证据可信度的行为：

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

如果前六个问题里有多个答案还是「不确定」，就先让平台负责观测和协作，别急着把评测事实全交给它保管。先保住证据。

## 自测题与参考答案

### 题 1

平台有 `run_id`，能否直接映射成本仓库 Trial ID？

**参考答案：**不能仅凭名称映射，因为只有在核对它会稳定绑定 Sample、Target、配置、环境和计划身份之后，才能判断两边是否指向同一个 Trial。若它只代表一次 API 调用，最多只能作为 Trace 或 Attempt 的外部标识。

### 题 2

平台不能保存 canonical Attempt，应如何声明？

**参考答案：**应将 `attempt_recovery` 标为 `unavailable` 或 `partial`，同时把完整的 Score Envelope 作为 Artifact 保存，这样后续分析就不必从已经丢失 Attempt 语义的平台聚合结果里反推正式分母。

### 题 3

为什么不把平台的「实验通过」直接当作发布授权？

**参考答案：**实验结果只提供决策所需的证据，而发布授权还要结合风险、审批、环境和责任边界才能形成组织决定，所以两者可以通过明确政策连接，却不能默认等价。

## 继续阅读

- [Trace、Artifact 与血缘](03-trace-artifact-lineage.md)
- [Report、CI 与 Release Gate](07-report-ci-release-gate.md)
- [Run Identity 与可复现性](../engineering/02-run-identity-and-reproducibility.md)
- [LLM-as-a-Judge](../engineering/04-llm-as-judge.md)
- [验证与证据边界](../appendices/verification.md)
