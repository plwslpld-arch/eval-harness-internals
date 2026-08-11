# Evalorium Academy

<!-- evalorium-progress current=A2.1 current_status=not_started last_completed=A1.9 last_status=artifact_validated -->

Evalorium Academy 将课程内容、实验、测评和 Capstone 作为产品的一部分交付。

## 已发布单元

| 单元 | 主题 | 可读课程 | 工程资产 | 状态 |
|---|---|---|---|---|
| A1.1 | AI 评测的本质 | [Markdown](phase-a/chapter-a1/unit-a1-1/README.md) · [HTML](phase-a/chapter-a1/unit-a1-1/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-1/artifact-manifest.yaml) | 公开成果结构合同已验证 |
| A1.2 | 从业务需求到评测问题 | [Markdown](phase-a/chapter-a1/unit-a1-2/README.md) · [HTML](phase-a/chapter-a1/unit-a1-2/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-2/artifact-manifest.yaml) | 公开成果与追踪合同已验证 |
| A1.3 | 评测对象、系统边界与版本 | [Markdown](phase-a/chapter-a1/unit-a1-3/README.md) · [HTML](phase-a/chapter-a1/unit-a1-3/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-3/artifact-manifest.yaml) | 公开成果、目标身份与完整性合同已验证 |
| A1.4 | 从评测问题到任务与场景 | [Markdown](phase-a/chapter-a1/unit-a1-4/README.md) · [HTML](phase-a/chapter-a1/unit-a1-4/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-4/artifact-manifest.yaml) | 任务、场景、覆盖与完整性合同已验证 |
| A1.5 | 从任务与场景到评测数据 | [Markdown](phase-a/chapter-a1/unit-a1-5/README.md) · [HTML](phase-a/chapter-a1/unit-a1-5/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-5/artifact-manifest.yaml) | 评测数据治理与完整性合同已验证 |
| A1.6 | 从参考标准到评分器 | [Markdown](phase-a/chapter-a1/unit-a1-6/README.md) · [HTML](phase-a/chapter-a1/unit-a1-6/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-6/artifact-manifest.yaml) | 评分器设计、身份、证据与质量就绪合同已验证 |
| A1.7 | 从样本级评分到可信指标 | [Markdown](phase-a/chapter-a1/unit-a1-7/README.md) · [HTML](phase-a/chapter-a1/unit-a1-7/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-7/artifact-manifest.yaml) | 指标、分母、聚合、不确定性与证据就绪合同已验证 |
| A1.8 | 从评测证据到质量决策 | [Markdown](phase-a/chapter-a1/unit-a1-8/README.md) · [HTML](phase-a/chapter-a1/unit-a1-8/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-8/artifact-manifest.yaml) | 质量基线、Gate DAG、决策、豁免、发布与生产响应合同已验证 |
| A1.9 | 从评测计划到可复现运行 | [Markdown](phase-a/chapter-a1/unit-a1-9/README.md) · [HTML](phase-a/chapter-a1/unit-a1-9/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-9/artifact-manifest.yaml) | 运行身份、Trial/Attempt、Trace、血缘、恢复、预算、适配器与审计合同已验证 |

Chapter A1 已完成 9 个公开成果合同已验证单元。当前单元是 A2.1（尚未开始）；必须先定义 A2 与 A2.1 的正式标题、边界和学习范围，学习完成前不创建正式成果或占位正文。

A1.9 包含 Run Spec、Resolved Run Identity、Trial Plan、Attempt Ledger、Trace Contract、Artifact Lineage Manifest、Execution Policy、Budget and Stopping Policy、Adapter Capability Contract、Run Audit Report 10 类契约，以及退款 Agent、合同审查 Agent、企业知识助手 3 个完整合成案例。Node 24 本地 `npm ci && npm run check` 共 163 项测试、品牌与仓库验证通过；候选提交 [`5e19133`](https://github.com/plwslpld-arch/evalorium/commit/5e191339200528e82ae01c54cc099dbbf6d85631) 的 [Documentation Quality run 31451972040](https://github.com/plwslpld-arch/evalorium/actions/runs/31451972040) 精确匹配且成功。该验证只证明公开运行身份、Trial/Attempt、Trace、血缘、恢复、预算、适配器与审计合同，不证明真实分布式 Harness、第三方适配器、生产运行、发布授权或个人能力。

## 单元交付标准

每个知识单元最终至少包含：

1. 正式学习目标
2. 完整概念讲解
3. 方法原理与适用边界
4. 企业案例
5. 可执行实验
6. 结果分析
7. 单元测评
8. 常见误区
9. 延伸阅读
10. 可发布的 HTML 成果

单元包必须通过 `npm run check`。当前验证器检查必要文件、YAML 合同、HTML 文档壳、UTF-8、相对链接和敏感信息；通过表示公开成果的结构合同成立，不表示 Harness 已真实执行、评测结论已科学验证或个人已经掌握。

公开仓库只保存校订后的课程、模板、案例和项目成果，不保存对话记录、个人回答、私人学习笔记或中间草稿。当前项目进度以 [`../progress/state.yaml`](../progress/state.yaml) 为准。
