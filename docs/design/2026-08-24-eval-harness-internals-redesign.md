# Eval Harness 源码内核：整仓重构设计

## 1. 决策摘要

现有 `evalorium` 仓库将覆盖式重构为 `eval-harness-internals`，中文名称为“Eval Harness 源码内核”。

新仓库是一套面向开发者的中文 Eval Harness 源码教材，并包含一个小而完整、可以本地运行的参考实现。它回答的核心问题是：

> 一组模型、RAG 或 Agent 实验，怎样从任务定义开始，经过可复现执行、证据采集、评分、统计与质量门禁，形成可信且可核对的结论？

它与 `agent-harness-internals` 组成两个职责明确的姊妹仓库：

- `agent-harness-internals` 研究一次 Agent 任务怎样被运行时执行；
- `eval-harness-internals` 研究一组 AI 系统实验怎样被设计、运行、评分、比较并转化为质量决定。

新仓库不继续 A2.2，也不继续“8 个阶段、29 个章节、138 个知识单元”的旧路线。现有 Git 历史保留用于追溯与恢复，但新仓库的公开页面不与旧版本比较，也不把迁移过程作为读者内容。

## 2. 产品定位

### 2.1 仓库名称与对外文案

- GitHub 仓库名：`eval-harness-internals`
- 中文名称：`Eval Harness 源码内核`
- 中文标语：`从一个样本到一次发布决定，读懂评测系统如何运行`
- GitHub About：`面向开发者的中文 Eval Harness 源码教材：解析 lm-evaluation-harness、Inspect AI、OpenAI Evals、Promptfoo、DeepEval 与 Harbor，覆盖任务、运行、评分、统计和发布门禁。`
- 默认语言：中文；必要英文术语在首次出现时给出中文解释和原词，代码标识保留上游原名。

### 2.2 目标读者

主要读者是：

1. 已会一种编程语言，希望系统学习 AI 评测工程的开发者；
2. 需要为模型、RAG、Agent 或多智能体系统建立评测管线的工程师；
3. 希望读懂主流 Eval Harness 源码，而不是只会调用表层 API 的学习者；
4. 需要把评测结果连接到 CI、发布门禁、生产反馈或训练数据的 AI Quality 工程师。

读者不需要拥有付费模型账号。主学习路线必须能通过锁定源码、确定性 Fixture 和本地 Target Stub 完成。

### 2.3 核心价值

仓库必须同时提供三类价值：

1. **共同语言**：解释 Task、Dataset、Target、Trial、Attempt、Trace、Artifact、Scorer、Metric 和 Gate；
2. **源码知识库**：沿锁定提交追踪主流 Eval Harness 的真实调用链；
3. **可运行参考**：用最小 Reference Harness 把概念变成真实文件、事件、结果和报告。

### 2.4 非目标

新仓库不是：

- 通用 Coding Agent 运行时；
- 企业级全栈 AI 质量平台；
- 生产监控 SaaS；
- 模型训练平台；
- 只展示 benchmark 分数的排行榜；
- 以大量 Schema 或 YAML 数量衡量完成度的课程管理系统；
- 对任何上游项目的官方实现或背书。

## 3. 与 Agent Harness 仓库的边界

### 3.1 两条主链

```text
用户目标
  → Agent Harness
  → 模型输入、循环、工具、权限、Session
  → Trace、Diff、日志、环境终态
                 │
                 │ Target Adapter
                 ▼
EvalSpec
  → Eval Harness
  → Dataset、Trial、Attempt、Artifact、Scorer、Metric
  → Comparison、Gate、Report、改进数据
```

### 3.2 责任划分

| 主题 | Agent Harness 源码内核 | Eval Harness 源码内核 |
| --- | --- | --- |
| 模型输入 | 怎样构造上下文、工具和系统提示 | 只记录 Target 身份与有效配置 |
| Agent Loop | 谁控制下一轮与停止条件 | 把一次完整运行视为 Trial 的被测行为 |
| 工具与权限 | 工具如何可见、获准并产生副作用 | 工具事件如何进入 Observation 与安全评分 |
| Session 与恢复 | 会话怎样保存、压缩和继续 | Trial/Attempt 怎样重试、恢复并保持统计分母 |
| Trace | Trace 怎样在运行时产生 | Trace 怎样验证完整性、形成 Artifact 并被评分 |
| 环境 | Agent 怎样使用真实执行环境 | 环境怎样创建、重置、注入故障并检查终态 |
| Eval | 只讲本项目已有的 Eval 接缝 | 完整讲 Task、Scorer、Metric、比较和 Gate |

### 3.3 重叠内容处理规则

- DeepSeek Harness、Codex、Gemini CLI、Claude、pi 和 OpenCode 的内部评测功能仍在 Agent 仓库说明其运行时位置；
- Eval 仓库只通过 Target Adapter 使用这些系统，不重复讲它们的 Agent Loop 内部实现；
- Trace 和 Artifact 是两个仓库的接口。Agent 仓库负责生产语义，Eval 仓库负责消费、验证和判定语义；
- Agent Environment Harness 属于 Eval 仓库，因为它负责实验环境生命周期、状态断言、故障注入和重复运行；
- 两个仓库可以共享同一个“运费边界错误”教学任务，但必须从不同责任面解释。

## 4. 核心源码研究对象

首版使用六条主要课程。纳入前必须确认许可证、公开源码范围、测试可用性和锁定提交。

| 课程 | 主要观察问题 | 课程角色 |
| --- | --- | --- |
| lm-evaluation-harness | Model Adapter、Task、Request、批处理与 Metric 聚合 | 模型 benchmark 型 Harness |
| Inspect AI | Task、Solver、Scorer、Sandbox、Eval Log 与 Agent Eval | 通用且强调安全的 Eval Harness |
| OpenAI Evals | Eval Spec、Registry、Completion Function 与样本执行 | Registry 与配置驱动实现 |
| Promptfoo | Provider、Test Case、Assertion、红队与 CI | 声明式应用评测与发布检查 |
| DeepEval | 测试框架式 Dataset、Metric 与 LLM-as-Judge | 单元测试风格评测 |
| Harbor 与 Terminal-Bench | Agent 任务环境、容器、轨迹、终态检查与比较 | Agent Environment Harness |

SWE-bench 作为机制案例，重点研究任务构造、环境复现、补丁与测试判定，不作为与六条课程同等篇幅的完整主线。

LangSmith、Phoenix、MLflow、Braintrust 等平台只在 Adapter 和可观测性比较中出现。无法由公开源码或官方接口核对的内部能力不做源码推断。

上游源码不复制进 Git 历史。`sources/sources.yml` 保存来源、范围和许可证，`sources/sources.lock.yml` 固定提交，脚本按需检出到 Git 忽略的本地目录；正文链接指向对应提交的永久链接。

## 5. 信息架构

目标目录如下：

```text
README.md
mkdocs.yml
docs/
  00-start-here.md
  README.md
  learning-paths.md
  foundations/
    01-agent-vs-eval-harness.md
    02-task-dataset-target-environment.md
    03-sample-trial-attempt.md
    04-trace-artifact-observation.md
    05-scorer-judge-score-metric.md
    06-uncertainty-comparison-gate.md
    07-eval-to-rl-and-release-eval.md
  harnesses/
    lm-evaluation-harness/
    inspect-ai/
    openai-evals/
    promptfoo/
    deepeval/
    harbor-terminal-bench/
  comparisons/
    01-task-dataset-target.md
    02-runner-concurrency-cache-retry.md
    03-trace-artifact-lineage.md
    04-scorer-judge-outcomes.md
    05-metric-statistics-uncertainty.md
    06-agent-environment-final-state.md
    07-report-ci-release-gate.md
  engineering/
    01-minimal-eval-loop.md
    02-run-identity-and-reproducibility.md
    03-retries-and-recovery.md
    04-llm-as-judge.md
    05-statistical-comparison.md
    06-agent-environments.md
    07-quality-gates.md
    08-eval-to-rl.md
  cases/
    shipping-boundary.md
    refund-agent.md
    knowledge-assistant.md
    contract-review-agent.md
  labs/
    01-run-one-deterministic-eval.md
    02-add-a-target-adapter.md
    03-write-a-scorer.md
    04-repeat-and-compare.md
    05-evaluate-an-agent-trace.md
    06-build-a-release-gate.md
  appendices/
    glossary.md
    verification.md
    source-and-license-boundaries.md
reference/
  pyproject.toml
  src/eval_harness_reference/
  tests/
  examples/
schemas/
sources/
scripts/
assets/
  brand/
  diagrams/
```

实际文件数量由调用链和教学需要决定，不为目录整齐强制每个项目使用相同文章数。

## 6. 教材设计

### 6.1 贯穿任务

基础篇使用一个确定性的运费边界错误：订单金额恰好为 100 元时仍收取运费。它同时出现在两个姊妹仓库中：

- Agent 仓库展示 Agent 如何读取、编辑和运行测试；
- Eval 仓库冻结初始仓库、任务、允许修改范围和测试，执行 Target，收集 Diff 与 Trace，在干净环境独立评分并形成 Gate Decision。

高级篇继续使用退款 Agent、企业知识助手和合同审查 Agent，分别覆盖副作用、RAG/ACL、多值 Reference 和 Judge 仲裁。

### 6.2 每篇核心课程的内容合同

每篇基础、源码、工程和案例正文必须包含与主题相适应的以下内容：

1. 本篇要解决的真实问题；
2. 前置知识与读完后的可解释能力；
3. 一个贯穿案例或具体输入；
4. 核心概念及相邻概念边界；
5. 中文架构图、流程图、时序图或数据血缘图；
6. 锁定提交和永久源码链接；
7. 一条完整调用链，逐站说明调用者、输入、状态变化、返回值和下一站；
8. 关键数据结构或事件字段；
9. 实现思路、设计取舍与替代方案；
10. 错误、重试、缺证和安全失败的语义；
11. 可运行实验或确定性复现；
12. 实验的预期输出与参考答案；
13. 常见误解和反例；
14. 怎样独立核对本文结论；
15. 本项目与其他 Eval Harness 的差异；
16. 本文结论不能证明什么。

内容检查不能只统计行数或文件是否存在。检查器需要验证必要章节、图示引用、源码永久链接、实验入口、答案和上下文导航，同时允许因主题差异调整篇幅。

### 6.3 源码证据等级

正文明确区分：

- **上游源码事实**：在锁定提交的文件或测试中直接可见；
- **机制解释**：根据多个调用点重建的责任边界与数据流；
- **教学简化**：为理解而缩小的伪代码、图示或 Reference Harness；
- **外部契约**：来自官方文档或公开 API，但没有相应内部源码；
- **不可核对**：公开证据不足，正文明确停止推断。

## 7. Reference Harness 设计

### 7.1 技术选择

Reference Harness 使用 Python 3.12、标准库优先、pytest 验证。项目使用 `uv` 锁定开发依赖；即使未安装 `uv`，确定性示例仍可在标准 Python 虚拟环境中安装运行。核心路线不依赖 Node、NVM、容器或付费模型。

文档站使用 MkDocs Material，从同一套 Markdown 构建，不维护第二份 HTML 正文。Reference Harness 的 HTML Reporter 生成独立评测报告，与教材文档站是两个不同产物。

选择 Python 的原因：

- 主要 Eval Harness 上游多数以 Python 为核心；
- 读者可以直接对照上游数据模型和执行方式；
- 统计、数据和测试生态成熟；
- 避免为文档与最小运行时继续绑定 Node 24。

### 7.2 模块边界

```text
spec        冻结 EvaluationSpec、Target、Dataset、Scorer 和 Gate 配置
identity    生成 Run ID、内容摘要和实际身份调和结果
dataset     加载 Sample，并保留稳定 Sample ID
planner     物化 Sample × Target × Repetition 为 Trial
runner      执行 Trial，管理 Attempt、超时、预算和取消
targets     Target Adapter 接口及确定性、本地进程实现
tracing     保存模型、工具、状态和运行事件
artifacts   保存 Diff、日志、环境终态和内容摘要
scorers     确定性规则、测试结果和可选 Judge 接口
metrics     按声明分母聚合 Score，处理缺失和重复依赖
comparison  进行成对比较、效果量与基础不确定性估计
gates       将有效证据转换为通过、失败、阻断或无法判断
reporting   输出 JSON、JSONL、Markdown 和 HTML 报告
cli         提供 run、score、compare、gate 和 inspect 命令
```

命令行入口固定为 `eval-harness-ref`。例如从仓库根目录执行 `eval-harness-ref run reference/examples/shipping/eval.yaml`，即可产生一份可追踪到 Trial、Attempt、Artifact、Score 和 Gate 的确定性报告。

每个模块必须能在不读取其他模块内部实现的情况下解释用途、输入、输出和依赖。

### 7.3 核心对象

```text
EvaluationSpec
  → Run
  → Task
  → Sample
  → Trial
  → Attempt
  → TraceEvent / Artifact
  → ObservationBundle
  → ScoreRecord
  → MetricEstimate
  → GateDecision
```

核心不变量：

- Trial 是统计对象；Attempt 是基础设施恢复对象；
- 产品失败不能通过新增 Attempt 重试到成功；
- 一个 Trial 最多有一个 canonical Attempt；
- ScoreRecord 必须绑定 Observation Bundle、Scorer Identity 和 canonical Attempt；
- Metric 的分母来自预声明 Trial Plan，不来自成功 Attempt 数；
- Gate 不能把无效或不完整证据改写为通过。

### 7.4 状态语义

不同层次使用不同状态，禁止用一个 `success` 字段覆盖所有含义：

| 层次 | 状态 |
| --- | --- |
| Attempt | `succeeded`、`infra_failed`、`cancelled` |
| Trial 执行 | `completed`、`blocked`、`invalid` |
| Score | `passed`、`failed`、`uncertain`、`unscorable`、`invalid` |
| Gate | `passed`、`failed`、`blocked`、`inconclusive` |

`blocked` 表示缺少预声明的执行条件；`inconclusive` 表示已有证据不足以支持通过或失败；`invalid` 表示身份、协议或血缘错误导致该对象不能进入预期推断。

### 7.5 首版能力边界

首版必须支持：

- YAML 或 Python 定义的 EvaluationSpec；
- 本地 Dataset；
- 确定性 Target Stub；
- 本地子进程 Target；
- Agent Trace 导入 Target；
- 顺序执行和有限本地并发；
- Trial/Attempt 与受控基础设施重试；
- JSONL Trace 和内容摘要 Artifact；
- 确定性 Scorer；
- 可选 Judge 接口，但默认测试不访问网络；
- 成对比较和基础 Bootstrap 区间；
- Gate Policy；
- JSON、Markdown 和 HTML 报告。

首版明确不实现分布式队列、云端控制面、用户系统、在线 Dashboard 或生产监控服务。Lease、Fencing Token 和分布式 canonical commit 作为高级课程与模拟实验，不进入最小运行时。

## 8. 图示系统

所有正式图示使用中文标签，技术标识可保留英文原词。优先使用仓库内 SVG，保证 GitHub、离线 PDF 和文档站一致显示。

首批至少需要：

1. Agent Harness 与 Eval Harness 责任边界图；
2. 从 EvalSpec 到 Gate Decision 的总架构图；
3. Sample、Trial、Attempt 对象层级图；
4. Target 执行与 Scorer 分离时序图；
5. Trace、Artifact、Observation、Score、Metric 血缘图；
6. 产品失败与基础设施重试决策图；
7. Candidate/Baseline 成对比较流程图；
8. Agent Environment 创建、运行、断言、重置流程图；
9. LLM-as-Judge 校准与人工对照图；
10. Eval-to-RL 与独立发布评测隔离图；
11. 六套上游 Eval Harness 的共同坐标图；
12. 三个高级案例的领域流程图。

图示必须通过 SVG 安全、尺寸、中文文本和引用完整性检查。

## 9. 现有内容迁移

### 9.1 保留并重写的知识

以下知识迁入新基础、工程或高级章节：

- 从业务决定到评测问题；
- Target、边界、版本和实际身份调和；
- Task、场景、Dataset、Reference 和 Split；
- Scorer、Rubric、Judge、仲裁和质量检查；
- Trial、Attempt、Retry 和 canonical Attempt；
- Trace、Artifact、Observation、Score、Metric 与 Gate 血缘；
- 分母、重复依赖、成对比较和不确定性；
- 构念、Proxy、Reliability、Validity 和 Goodhart 风险；
- 产品预算与 Harness 预算；
- Adapter Capability Contract；
- Eval-to-RL 与独立 Release Eval 隔离；
- 退款 Agent、知识助手和合同审查 Agent 案例。

这些内容按新人学习顺序重写，不保留 A1.1、A1.2 等课程编号。

### 9.2 转换的工程资产

- 现有 YAML 中稳定的领域字段转换为少量 Schema/Pydantic 模型；
- 合成案例转换为可以真正运行的 Fixture、输入和期望结果；
- 验证器从单体课程 profile 改为模块化的内容、Schema、源码链接和实验检查；
- HTML 由 Markdown 构建生成，不再逐篇手工维护重复正文；
- 课程进度门禁改为公开内容质量门禁，不保存个人学习状态。

### 9.3 从最终工作树删除的内容

- `progress/`；
- `handoffs/`；
- 跨设备恢复型 `START_HERE.md`；
- 旧 `academy/` 层级；
- 旧课程进度镜像和能力矩阵；
- `docs/superpowers/` 与施工计划历史；
- 手工重复 HTML；
- 单体 Academy profile 验证器及其按单元增长的测试；
- README 中的当前单元、测试数量、候选提交、Actions run 和个人能力声明；
- 尚未实现的企业平台、监控和治理能力声明。

删除发生在已建立迁移映射和可恢复 Git 提交之后。最终公开仓库不保留“旧版与新版对比”页面。

## 10. 品牌、许可证与 GitHub 页面

### 10.1 品牌

重新设计独立标志，不复用 Agent Harness 仓库图标，也不拼接上游项目商标。视觉概念围绕“实验样本、证据链、判定门”展开，避免机器人头像。

需要生成：

- 方形标志；
- 横向中英文锁定组合；
- 深浅色 SVG；
- GitHub 头像和社交预览 PNG；
- Favicon；
- 品牌使用说明。

### 10.2 许可证

与姊妹仓库保持一致：

- 原创代码使用 MIT；
- 原创文档使用 CC BY 4.0；
- 上游源码、截图、论文、名称和商标保持各自许可证；
- 使用 `THIRD_PARTY.md`、`NOTICE.md` 和 `sources/sources.lock.yml` 明确边界。

### 10.3 GitHub 配置

最终更新：

- 仓库名和远端地址；
- About、Topics 和默认 README；
- 仓库 Logo/社交预览；
- Actions 工作流和 Badge；
- Issue/PR 模板；
- Security、Contributing 和许可证入口；
- GitHub Pages 或静态文档站；
- 完整离线 PDF 下载入口。

最终验证通过后，同一份完整中文 PDF 还要复制到桌面供离线阅读；仓库成品与桌面副本必须通过 SHA-256 证明完全一致。

仓库重命名保留原 Git 历史和 GitHub 自动重定向，不重写贡献者历史。

## 11. 验证策略

### 11.1 Reference Harness 验证

- 单元测试：对象不变量、Digest、状态转换、Scorer 和 Gate；
- 合同测试：Target、Scorer、Reporter Adapter；
- 集成测试：完整确定性 Eval 从 Spec 到 Report；
- 故障测试：超时、基础设施重试、产品失败、Artifact 缺失和身份不匹配；
- 统计测试：Trial 分母、成对比较、Bootstrap 稳定性和缺失处理；
- Golden 测试：JSONL、报告和 Gate Decision；
- 安全测试：路径越界、命令参数、秘密扫描和不可信 Artifact。

### 11.2 教材验证

- Markdown 相对链接和锚点；
- 锁定源码永久链接；
- 来源 Commit、许可证和本地 Checkout 一致；
- 核心文章内容合同；
- 中文图示、安全 SVG 和替代文本；
- 示例命令能够在仓库根目录运行；
- 代码片段与 Reference Harness 同步；
- 中英文术语表一致；
- PDF 目录、书签、链接、图示和逐页渲染检查。

### 11.3 完成声明边界

仓库检查通过只表示教材、参考实现和确定性示例满足声明合同。它不表示任何上游工具生产就绪，也不形成某个 AI 系统的发布授权。此边界在验证文档中集中说明，不在每篇正文和 README 反复堆叠。

## 12. 实施顺序

实施采用可验证的阶段，不继续旧 Academy 单元节奏。

### 阶段 0：建立可恢复边界

- 确认远端 `main` 未变化；
- 为旧 Evalorium 最终状态创建可恢复 Tag；
- 建立内容迁移清单和来源锁定清单；
- 不删除任何内容，先完成新骨架和检查器最小闭环。

### 阶段 1：新仓库骨架与公共入口

- 建立中文 README、学习入口、总目录和边界说明；
- 建立来源锁定、许可证和内容检查；
- 创建基础品牌与首批总览图；
- 暂不更新 GitHub 仓库名，避免远端出现名称与内容短暂不一致。

### 阶段 2：Reference Harness 最小闭环

- 实现 Spec、Dataset、Planner、Runner、Target、Scorer、Metric、Gate 和 Report；
- 完成运费边界确定性案例；
- 建立 Trial/Attempt、状态语义和 Artifact 血缘测试。

### 阶段 3：基础教材与工程篇

- 完成七篇基础正文；
- 完成 Reference Harness 对应八篇工程正文；
- 每篇包含图、代码、实验、答案和核对方式。

### 阶段 4：六条源码课程

- 锁定并核对六组上游来源；
- 按调用链分批完成课程；
- 每完成一条课程即运行源码链接、内容合同和实验检查。

### 阶段 5：比较、案例与实验

- 完成七篇横向比较；
- 把三个现有企业案例转换为可运行 Fixture；
- 完成六个逐步实验和答案。

### 阶段 6：整仓替换与发布

- 确认旧知识迁移完成；
- 删除旧 Academy、进度、Handoff、重复 HTML 和单体验证器；
- 完成全仓导航、品牌、GitHub Pages 与离线 PDF；
- 运行全量代码、内容、来源、许可证、安全和视觉检查；
- 确认远端基线未变化；
- 将 GitHub 仓库重命名为 `eval-harness-internals`；
- 更新本地 remote、仓库 About、Topics 和链接；
- 推送最终提交并等待对应 GitHub Actions 成功。

## 13. 验收标准

整仓改造只有同时满足以下条件才算完成：

1. GitHub 仓库名为 `eval-harness-internals`，About 与实际内容一致；
2. README 能在五分钟内让新人理解 Agent Harness 与 Eval Harness 的差异；
3. 核心学习路线全部为中文，图示也使用中文；
4. 六组上游来源均有锁定提交、许可证和源码课程；
5. 每篇核心课程满足内容合同，不存在只有概念结论而没有调用链或实验的正文；
6. Reference Harness 可以在无模型凭据、无网络条件下运行完整确定性 Eval；
7. Trial 与 Attempt、产品失败与基础设施失败、Score 与 Gate 状态有自动化测试；
8. 运费、退款 Agent、知识助手和合同审查案例至少有可运行 Fixture 或确定性评分；
9. 源码永久链接、相对链接、锚点、图示、许可证和秘密扫描全部通过；
10. 文档站与完整离线 PDF 均可阅读，PDF 完成逐页视觉检查；
11. GitHub 推送和远端门禁成功后，桌面存在与仓库成品哈希一致的完整中文 PDF；
12. 最终工作树不包含旧进度、Handoff、个人能力状态或手工重复 HTML；
13. GitHub Actions 对最终提交成功，远端 `main` 与本地验证提交一致。

## 14. 已确定的取舍

- 选择源码教材加最小参考实现，不建设企业级全栈平台；
- 选择覆盖式新仓库，不在公开正文保留旧版比较；
- 选择中文优先，不维护一套逐页英文镜像；
- 选择 Python Reference Harness，不继续依赖 Node 24/NVM；
- 选择本地文件和 JSONL 作为首版存储，不引入数据库或分布式队列；
- 选择确定性核心路线，真实模型和 Judge 调用为可选扩展；
- 选择六条主要源码课程，SWE-bench 和 SaaS 平台作为机制案例；
- 选择保留 Git 历史和 GitHub 重定向，不重写贡献者历史；
- 选择集中说明证据边界，不在 README 和每篇课程重复施工状态声明。
