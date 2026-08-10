# Current Handoff

<!-- evalorium-progress current=A1.8 current_status=not_started last_completed=A1.7 last_status=artifact_validated -->

## 已确认决策

1. Evalorium 是独立、开源、企业级的 AI 质量工程平台，与 Loopward、Rein、Vein 解耦。
2. Agent Environment Harness 是深度核心模块；Evalorium 不是通用 Coding Agent 运行时。
3. Academy 和 Platform 都是正式交付物。
4. 公开仓库只保存校订后的课程、工程模板、案例、验证与项目成果，不保存对话、个人回答、私人笔记或中间草稿。
5. Academy 默认由助手完整讲解并给出答案，使用者阅读和理解；不强制在对话中逐题作答。
6. 课程范围保持 8 个阶段、29 个核心章节、不少于 138 个知识单元、8 个阶段 Capstone 和 1 个企业级综合 Capstone。

## 当前状态

- 当前分支：`main`
- 跨设备策略：GitHub `origin/main` 单一事实源、同一时间一个 active writer、只在远端门禁通过的提交边界换机。
- 规范运行时：最新 Node 24 LTS（见 `.nvmrc`）。
- 公开仓库：<https://github.com/plwslpld-arch/evalorium>
- 项目成熟度：`learning`
- Academy：`learning`
- Platform：`planned`
- 当前单元：A1.8（尚未开始；正式标题与范围待定义）
- 已验证单元：A1.1《AI 评测的本质》、A1.2《从业务需求到评测问题》、A1.3《评测对象、系统边界与版本》、A1.4《从评测问题到任务与场景》、A1.5《从任务与场景到评测数据》、A1.6《从参考标准到评分器》、A1.7《从样本级评分到可信指标》

## A1.1 交付证据

- 正式 Markdown 课程和独立 HTML 阅读版。
- Evaluation Charter、Evaluation Target、Risk Definition、Task Spec、Harness Manifest、Metric Card、Gate Policy、Gate Decision、Monitoring Signal 共 9 类模板。
- 退款 Agent 和合同审查 Agent 两个端到端案例。
- Academy 单元包验证器，覆盖缺失资产、YAML 解析、决策字段和 HTML 可访问文档壳。
- 完整 `npm run check` 共 15 项自动化测试通过。
- 桌面页面和 390px 窄屏实际检查通过，无横向溢出或控制台错误。
- 内容提交：[`b8bb47b`](https://github.com/plwslpld-arch/evalorium/commit/b8bb47b41b0f68e9f51968fac3aeffb7cd6825f8)。
- Linux 远程门禁：[Documentation Quality run 31248603764](https://github.com/plwslpld-arch/evalorium/actions/runs/31248603764)。

## A1.2 交付证据

- 正式 Markdown 课程与独立 HTML 阅读版；桌面和 390px 窄屏实际检查通过，无横向溢出。
- Evaluation Charter、Stakeholder Impact Map、Risk Taxonomy、Construct Definition、Evidence Requirements、Requirements Traceability 共 6 类模板。
- 退款 Agent、合同审查 Agent、企业知识助手 3 个端到端案例；同一句模糊需求分别推导到不同决定、风险、构念、场景和证据。
- 单元验证器支持 canonical profile，保留 A1.1 完整合同，并检查不安全路径、清单完整性、双向引用与孤儿实体。
- Node 24 本地 `npm run check` 共 31 项自动化测试通过，品牌检查和仓库验证通过。
- 内容提交：[`db4a82c`](https://github.com/plwslpld-arch/evalorium/commit/db4a82ce16a76e67136196e446bd0d4d987b9531)。
- Linux 远程门禁：[Documentation Quality run 31324732289](https://github.com/plwslpld-arch/evalorium/actions/runs/31324732289)。
- 证据边界：只证明公开成果与追踪合同，不证明真实评测效度、生产效果或个人能力等级。

## A1.3 交付证据

- 正式 Markdown 课程与独立 HTML 阅读版，覆盖对象层级、system/evaluation/observation/claim 四种边界、版本身份、运行状态、四方调和、对象漂移和重新评测。
- Evaluation Target、System Boundary、Target Identity、Runtime State、Target Reconciliation、Reevaluation Policy 共 6 类模板。
- 退款 Agent、合同审查 Agent、企业知识助手 3 个完整案例；同一句模糊需求分别落到资金状态、法律责任与 ACL/语料/索引边界。
- 单元验证器新增 canonical `target-boundary-version-v1` profile，检查六模板闭合引用、四方 `match` 语义、案例实体与证据链、错误字段类型和缩水绕过。
- Node 24 本地 `npm run check` 共 41 项自动化测试通过，品牌检查和仓库验证通过；本地链接和 HTML 响应式结构检查通过。
- 内容提交：[`6809164`](https://github.com/plwslpld-arch/evalorium/commit/6809164baf8eeb3fe9b882ceb6f31dced64951f8)。
- Linux 远程门禁：[Documentation Quality run 31354660150](https://github.com/plwslpld-arch/evalorium/actions/runs/31354660150)。
- 证据边界：只证明公开成果、目标身份与内部完整性合同；不证明浏览器实机视觉表现、真实 Harness 运行、生产效果、科学效度或个人能力等级。

## A1.4 交付证据

- [正式 Markdown 课程](../academy/phase-a/chapter-a1/unit-a1-4/README.md)与[独立 HTML 阅读版](../academy/phase-a/chapter-a1/unit-a1-4/index.html)，覆盖风险驱动场景空间、任务规格、测试案例、受控变体、轨迹合同与覆盖矩阵。
- Scenario Space、Task Spec、Test Case、Variant Plan、Trajectory Contract、Coverage Matrix 共 6 类模板。
- 退款 Agent、合同审查 Agent、企业知识助手 3 个完整案例，分别覆盖资金状态与幂等、法律风险定位与附件边界、ACL/版本/提示注入边界。
- 单元验证器新增 canonical `question-to-task-scenario-v1` profile，检查任务—场景—案例—变体—轨迹—覆盖闭合引用、目标与构念传递、覆盖状态与执行证据语义、案例追踪和缩水绕过。
- Node 24 本地 `npm run check` 共 64 项自动化测试通过，品牌检查和仓库验证通过。
- 内容提交：[`719113a`](https://github.com/plwslpld-arch/evalorium/commit/719113a511ba044c13d494ebfa08c69bc785b880)。
- Linux 远程门禁：[Documentation Quality run 31361998848](https://github.com/plwslpld-arch/evalorium/actions/runs/31361998848)。
- 证据边界：只证明公开成果的任务、场景、覆盖与内部完整性合同；不证明真实 Harness 运行、生产效果、科学效度或个人能力等级。

## A1.5 交付证据

- [正式 Markdown 课程](../academy/phase-a/chapter-a1/unit-a1-5/README.md)与[独立 HTML 阅读版](../academy/phase-a/chapter-a1/unit-a1-5/index.html)，覆盖目标总体、分析单位、抽样框、三类分区、来源治理、Reference Standard、独立盲标与仲裁、泄漏控制、不可变版本与 Data Quality Gate。
- Dataset Charter、Source Register、Sampling Plan、Reference Standard、Annotation Protocol、Split Manifest、Dataset Manifest、Data Quality Gate 共 8 类模板。
- 退款 Agent、合同审查 Agent、企业知识助手 3 个完整案例，分别处理资金状态与幂等、法律 Reference 多值解释与附件边界、当前授权证据与 ACL/缓存边界。
- 单元验证器新增 canonical `task-scenario-to-evaluation-data-v1` profile，检查八模板与三案例的引用闭合、权利与血缘、Reference/Annotation、五类泄漏、受保护视图、不可变版本、Data Quality Gate 语义、字段类型与缩水绕过。
- Node 24.13 本地 `npm ci && npm run check` 共 96 项自动化测试通过，品牌检查和仓库验证通过；第三轮独立终审 clean。
- 候选内容提交：[`ea6c538`](https://github.com/plwslpld-arch/evalorium/commit/ea6c53834c453ca8430c9d7ca57a4eeaf854dd82)。
- Linux 远程门禁：[Documentation Quality run 31377072773](https://github.com/plwslpld-arch/evalorium/actions/runs/31377072773)，精确匹配候选 head SHA，状态为 `completed/success`。
- 证据边界：只证明公开评测数据治理与内部完整性合同；不证明真实数据已物化、Agent trial、Scorer、Metric、Harness 或系统 Gate、生产效果或个人能力。

## A1.6 交付证据

- [正式 Markdown 课程](../academy/phase-a/chapter-a1/unit-a1-6/README.md)与[独立 HTML 阅读版](../academy/phase-a/chapter-a1/unit-a1-6/index.html)，覆盖评分单位、Observation Bundle、Reference/Rubric/Scorer/Score/Metric/Gate 分离、五类评分器、Rubric anchors、关键错误、不确定与分歧仲裁、评分器身份、验证与质量就绪门。
- Scorer Charter、Scoring Unit Spec、Observation Contract、Scoring Rubric、Adjudication Protocol、Scorer Manifest、Scorer Validation Report、Scorer Quality Gate 共 8 类模板。
- 退款 Agent、合同审查 Agent、企业知识助手 3 个完整案例，分别处理资金状态与幂等关键失败、合同多值法律解释与证据跨度、当前 ACL/语料版本与引用支持。
- 单元验证器新增 canonical `reference-to-scorer-v1` profile，检查 A1.5 上游身份继承、跨模板引用闭合、评分语义分离、确定性关键失败优先级、不确定/弃权/不可评分/分歧与仲裁、评分器版本身份、验证维度、质量 Gate 语义及缩水绕过。
- Node 24 本地 `npm ci && npm run check` 共 130 项自动化测试通过，品牌检查和仓库验证通过。
- 候选内容提交：[`dfd0c77`](https://github.com/plwslpld-arch/evalorium/commit/dfd0c77ad95f6c1c20f6011454bd626b9e2824f5)。
- Linux 远程门禁：[Documentation Quality run 31393199383](https://github.com/plwslpld-arch/evalorium/actions/runs/31393199383)，精确匹配候选 head SHA，状态为 `completed/success`。
- 证据边界：只证明公开 Scorer 设计、身份、证据追踪与质量就绪合同；不证明 A1.5 数据已物化、真实评分器实现或校准、trial、Score、Metric、Harness、统计推断、系统 Gate、生产效果或个人能力。

## A1.7 交付证据

- [正式 Markdown 课程](../academy/phase-a/chapter-a1/unit-a1-7/README.md)与[独立 HTML 阅读版](../academy/phase-a/chapter-a1/unit-a1-7/index.html)，覆盖 Score/Metric/Estimand/Estimator/Estimate/Gate 分离、目标总体与分母、聚合、重复运行依赖、不确定性、效应与分析计划、缺失与 coverage-risk、多重比较及质量门禁。
- Metric Definition、Population & Denominator、Aggregation Plan、Uncertainty Plan、Analysis Plan、Estimate Record、Comparison Report、Metric Quality Gate 共 8 类模板。
- 退款 Agent、合同审查 Agent、企业知识助手 3 个完整案例，分别处理资金安全关键事件、合同风险召回与伪造 span、知识问答 coverage/ACL/选择性预测。
- 单元验证器新增 canonical `score-to-metric-v1` profile，检查上游 Scorer 身份、跨模板引用、分母状态、伪重复、非补偿关键风险、paired cluster bootstrap、预声明分析、计划证据真实性、门禁状态与案例追踪闭环。
- Node 24 本地 `npm ci && npm run check` 共 140 项自动化测试通过，品牌检查和仓库验证通过。
- 候选内容提交：[`d7941a4`](https://github.com/plwslpld-arch/evalorium/commit/d7941a43b4e0c7b89e2a512ed41cb8db4cc4a708)。
- Linux 远程门禁：[Documentation Quality run 31404873004](https://github.com/plwslpld-arch/evalorium/actions/runs/31404873004)，精确匹配候选 head SHA，状态为 `completed/success`。
- 证据边界：只证明公开 Metric 的 estimand、分母、聚合、不确定性、分析、证据边界与质量就绪合同；不证明真实 Score 或 Estimate 已物化、版本比较或统计结论成立、系统可发布、Harness、生产效果或个人能力。

## 下一次准确动作

1. 开始前重新只读确认 `main`、工作树与最新远端门禁。
2. 先定义 A1.8 的正式标题与学习范围，再开始循序学习。
3. A1.8 学习完成前不创建正式单元成果或占位正文。

## 未解决问题与风险

- Platform 尚无运行时代码。
- GitHub Pages 尚未建设，HTML 需要下载或本地打开；源文件已可从 GitHub 浏览。
- 尚无生产采用、组织影响或工作年限证据，相关声明不得由仓库规模替代。
- 完整 138+ 单元仍需按单元逐步交付；不得使用空正文或占位文件制造完成进度。

## Git 状态语义

- 本 Handoff 的完成证据基于 A1.7 候选内容提交 `d7941a43b4e0c7b89e2a512ed41cb8db4cc4a708`。
- 对应远程证据为 [Documentation Quality run 31404873004](https://github.com/plwslpld-arch/evalorium/actions/runs/31404873004)，该 run 的 head SHA 与候选内容提交精确匹配。
- Handoff 与状态元数据提交本身的远程运行号不做递归自引用；在最终交接中读取最新 GitHub Actions 即可。
- 当前仓库的准确 HEAD、同步状态和远程门禁必须在恢复时通过 Git 与 `gh` 实时读取，不把会变化的 HEAD 或 run ID 固化为“当前值”。
- 完整换机步骤见 [`docs/workflows/cross-device-github.md`](../docs/workflows/cross-device-github.md)。
