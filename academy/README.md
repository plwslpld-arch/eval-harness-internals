# Evalorium Academy

<!-- evalorium-progress current=A2.2 current_status=not_started last_completed=A2.1 last_status=artifact_validated -->

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
| A2.1 | 从抽象质量到可测量构念 | [Markdown](phase-a/chapter-a2/unit-a2-1/README.md) · [HTML](phase-a/chapter-a2/unit-a2-1/index.html) | [Artifact Manifest](phase-a/chapter-a2/unit-a2-1/artifact-manifest.yaml) | 测量设计及构念、代理、误差、可靠性/效度计划与追踪合同已验证 |

Chapter A1 已完成 9 个公开成果合同已验证单元；Chapter A2 的正式标题是《测量理论、效度与可靠性》，A2.1 已验证。当前单元是 A2.2（尚未开始）；必须先定义 A2.2 的正式标题、边界和学习范围，学习完成前不创建正式成果或占位正文。

需要一次性回顾九个单元时，可阅读 [Chapter A1 综合地图与工程闭环复习](phase-a/chapter-a1/README.md)（[独立 HTML 阅读版](phase-a/chapter-a1/index.html)）。该总结串联业务需求、评测对象、任务场景、数据、评分器、指标、质量决定与可复现运行，并集中解释核心英文术语、三个贯穿案例和证据边界。

A2.1 包含 Measurement Charter、Construct Map、Indicator Register、Operationalization Spec、Measurement Error Model、Reliability Study Plan、Validity Argument、Measurement Quality Gate 8 类模板，以及退款 Agent、合同审查 Agent、企业知识助手 3 个完整合成案例。Node 24 本地 `npm ci && npm run check` 共 188 项测试、品牌与仓库验证通过；候选提交 [`9e5f8c7`](https://github.com/plwslpld-arch/evalorium/commit/9e5f8c722b83560517709eb90ca383719f28d580) 的 [Documentation Quality run 31492987925](https://github.com/plwslpld-arch/evalorium/actions/runs/31492987925) 精确匹配且 `completed/success`。该验证只证明公开测量设计及构念、代理、误差、可靠性/效度计划与追踪合同，不证明真实测量、可靠性或效度已经成立、生产就绪、发布授权或个人能力。

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
