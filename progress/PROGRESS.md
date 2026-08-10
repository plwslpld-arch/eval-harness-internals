# 项目与学习进度

<!-- evalorium-progress current=A1.7 current_status=not_started last_completed=A1.6 last_status=artifact_validated -->

## 当前状态

- 阶段：A
- 章节：A1
- 当前知识单元：A1.7（正式标题与范围待定义）
- 当前状态：尚未开始
- 公开成果合同已验证知识单元：6
- 最近完成：A1.6《从参考标准到评分器》

## A1.1 公开成果结构合同已验证

- [正式 Markdown 课程](../academy/phase-a/chapter-a1/unit-a1-1/README.md)
- [独立 HTML 阅读版](../academy/phase-a/chapter-a1/unit-a1-1/index.html)
- 9 类企业评测工程模板
- 退款 Agent 与合同审查 Agent 两个端到端案例
- Academy 单元合同验证器及对应自动化测试
- 内容提交：[`b8bb47b`](https://github.com/plwslpld-arch/evalorium/commit/b8bb47b41b0f68e9f51968fac3aeffb7cd6825f8)
- 远程验证：[Documentation Quality run 31248603764](https://github.com/plwslpld-arch/evalorium/actions/runs/31248603764)

## A1.2 公开成果与追踪合同已验证

- [正式 Markdown 课程](../academy/phase-a/chapter-a1/unit-a1-2/README.md)与[独立 HTML 阅读版](../academy/phase-a/chapter-a1/unit-a1-2/index.html)
- Evaluation Charter、Stakeholder Impact Map、Risk Taxonomy、Construct Definition、Evidence Requirements、Requirements Traceability 共 6 类模板
- 退款 Agent、合同审查 Agent、企业知识助手 3 个 requirements-to-evidence 完整案例
- Manifest 驱动的单元 profile、规范单元绑定、双向引用与孤儿实体检查
- Node 24 本地 `npm run check`：31 项测试、品牌检查和仓库验证通过
- 内容提交：[`db4a82c`](https://github.com/plwslpld-arch/evalorium/commit/db4a82ce16a76e67136196e446bd0d4d987b9531)
- 远程验证：[Documentation Quality run 31324732289](https://github.com/plwslpld-arch/evalorium/actions/runs/31324732289)
- 限制：验证证明公开成果合同与内部追踪完整，不证明真实 Harness 结果、科学效度或个人掌握程度

## A1.3 公开成果、目标身份与完整性合同已验证

- [正式 Markdown 课程](../academy/phase-a/chapter-a1/unit-a1-3/README.md)与[独立 HTML 阅读版](../academy/phase-a/chapter-a1/unit-a1-3/index.html)
- Evaluation Target、System Boundary、Target Identity、Runtime State、Target Reconciliation、Reevaluation Policy 共 6 类模板
- 退款 Agent、合同审查 Agent、企业知识助手 3 个 target-boundary-version 完整案例
- Canonical profile 检查六模板引用图、四方身份调和、案例引用与证据链、错误类型和缩水绕过
- Node 24 本地 `npm run check`：41 项测试、品牌检查和仓库验证通过
- 内容提交：[`6809164`](https://github.com/plwslpld-arch/evalorium/commit/6809164baf8eeb3fe9b882ceb6f31dced64951f8)
- 远程验证：[Documentation Quality run 31354660150](https://github.com/plwslpld-arch/evalorium/actions/runs/31354660150)
- 限制：验证证明公开成果、目标身份与内部完整性合同，不证明真实 Harness 运行、生产适用性、科学效度或个人掌握程度

## A1.4 任务、场景、覆盖与完整性合同已验证

- [正式 Markdown 课程](../academy/phase-a/chapter-a1/unit-a1-4/README.md)与[独立 HTML 阅读版](../academy/phase-a/chapter-a1/unit-a1-4/index.html)
- Scenario Space、Task Spec、Test Case、Variant Plan、Trajectory Contract、Coverage Matrix 共 6 类模板
- 退款 Agent、合同审查 Agent、企业知识助手 3 个 question-to-task-scenario 完整案例
- Canonical profile 检查任务—场景—案例—变体—轨迹—覆盖引用图、目标与构念传递、执行证据语义、错误类型和缩水绕过
- Node 24 本地 `npm run check`：64 项测试、品牌检查和仓库验证通过
- 内容提交：[`719113a`](https://github.com/plwslpld-arch/evalorium/commit/719113a511ba044c13d494ebfa08c69bc785b880)
- 远程验证：[Documentation Quality run 31361998848](https://github.com/plwslpld-arch/evalorium/actions/runs/31361998848)
- 限制：验证证明公开成果的任务、场景、覆盖与内部完整性合同，不证明真实 Harness 运行、生产适用性、科学效度或个人掌握程度

## A1.5 评测数据治理与完整性合同已验证

- [正式 Markdown 课程](../academy/phase-a/chapter-a1/unit-a1-5/README.md)与[独立 HTML 阅读版](../academy/phase-a/chapter-a1/unit-a1-5/index.html)
- Dataset Charter、Source Register、Sampling Plan、Reference Standard、Annotation Protocol、Split Manifest、Dataset Manifest、Data Quality Gate 共 8 类模板
- 退款 Agent、合同审查 Agent、企业知识助手 3 个 task-scenario-to-evaluation-data 完整案例
- Canonical profile 检查总体与抽样框、来源血缘与授权、Reference/Annotation、五类泄漏边界、不可变版本、受保护视图、Data Quality Gate 语义、引用闭合和缩水绕过
- Node 24 本地 `npm ci && npm run check`：96 项测试、品牌检查和仓库验证通过
- 候选内容提交：[`ea6c538`](https://github.com/plwslpld-arch/evalorium/commit/ea6c53834c453ca8430c9d7ca57a4eeaf854dd82)
- 远程验证：[Documentation Quality run 31377072773](https://github.com/plwslpld-arch/evalorium/actions/runs/31377072773)，head SHA 精确匹配候选提交，状态为 `completed/success`
- 限制：验证只证明公开评测数据治理与内部完整性合同，不证明真实数据已物化、Agent trial、Scorer、Metric、Harness 或系统 Gate、生产效果或个人能力

## A1.6 评分器设计、身份、证据与质量就绪合同已验证

- [正式 Markdown 课程](../academy/phase-a/chapter-a1/unit-a1-6/README.md)与[独立 HTML 阅读版](../academy/phase-a/chapter-a1/unit-a1-6/index.html)
- Scorer Charter、Scoring Unit Spec、Observation Contract、Scoring Rubric、Adjudication Protocol、Scorer Manifest、Scorer Validation Report、Scorer Quality Gate 共 8 类模板
- 退款 Agent、合同审查 Agent、企业知识助手 3 个 reference-to-scorer 完整案例
- Canonical profile 检查 A1.5 上游身份继承、评分单位与 Observation Bundle、Reference/Rubric/Scorer/Score/Metric/Gate 分离、确定性关键失败优先级、不确定/弃权/不可评分/分歧与仲裁、评分器身份版本、验证维度、质量 Gate 语义、引用闭合和缩水绕过
- Node 24 本地 `npm ci && npm run check`：130 项测试、品牌检查和仓库验证通过
- 候选内容提交：[`dfd0c77`](https://github.com/plwslpld-arch/evalorium/commit/dfd0c77ad95f6c1c20f6011454bd626b9e2824f5)
- 远程验证：[Documentation Quality run 31393199383](https://github.com/plwslpld-arch/evalorium/actions/runs/31393199383)，head SHA 精确匹配候选提交，状态为 `completed/success`
- 限制：验证只证明公开 Scorer 设计、身份、证据追踪与质量就绪合同，不证明 A1.5 数据已物化、真实评分器实现或校准、trial、Score、Metric、Harness、统计推断、系统 Gate、生产效果或个人能力

## 完整范围

- 8 个阶段
- 29 个核心章节
- 不少于 138 个知识单元
- 8 个阶段 Capstone
- 1 个企业级综合 Capstone

范围不会为了一个月节奏目标而缩减。时间是学习节奏，不是降低深度或删除证据的理由。

## 公开交付流程

```text
系统学习 → 完整解释与案例 → 校订正式成果 → 工程模板与示例
       → 单元合同验证 → 提交 → 更新总体进度 → 下一单元
```

公开仓库只保存正式成果，不保存对话、个人回答、错误历史、私人学习笔记或中间草稿。单元状态描述的是开源交付物，不用于公开判断个人能力。

## A1.7 下一步

1. 先定义 A1.7 的正式标题与学习范围，再开始循序学习。
2. A1.7 学习完成前不创建正式单元成果或占位正文。
