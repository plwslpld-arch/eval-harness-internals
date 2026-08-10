# Evalorium Academy

<!-- evalorium-progress current=A1.6 current_status=not_started last_completed=A1.5 last_status=artifact_validated -->

Evalorium Academy 将课程内容、实验、测评和 Capstone 作为产品的一部分交付。

## 已发布单元

| 单元 | 主题 | 可读课程 | 工程资产 | 状态 |
|---|---|---|---|---|
| A1.1 | AI 评测的本质 | [Markdown](phase-a/chapter-a1/unit-a1-1/README.md) · [HTML](phase-a/chapter-a1/unit-a1-1/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-1/artifact-manifest.yaml) | 公开成果结构合同已验证 |
| A1.2 | 从业务需求到评测问题 | [Markdown](phase-a/chapter-a1/unit-a1-2/README.md) · [HTML](phase-a/chapter-a1/unit-a1-2/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-2/artifact-manifest.yaml) | 公开成果与追踪合同已验证 |
| A1.3 | 评测对象、系统边界与版本 | [Markdown](phase-a/chapter-a1/unit-a1-3/README.md) · [HTML](phase-a/chapter-a1/unit-a1-3/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-3/artifact-manifest.yaml) | 公开成果、目标身份与完整性合同已验证 |
| A1.4 | 从评测问题到任务与场景 | [Markdown](phase-a/chapter-a1/unit-a1-4/README.md) · [HTML](phase-a/chapter-a1/unit-a1-4/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-4/artifact-manifest.yaml) | 任务、场景、覆盖与完整性合同已验证 |
| A1.5 | 从任务与场景到评测数据 | [Markdown](phase-a/chapter-a1/unit-a1-5/README.md) · [HTML](phase-a/chapter-a1/unit-a1-5/index.html) | [Artifact Manifest](phase-a/chapter-a1/unit-a1-5/artifact-manifest.yaml) | 评测数据治理与完整性合同已验证 |

当前单元是 A1.6（尚未开始）；正式标题与范围尚待定义，学习完成前不创建正式成果或占位正文。

A1.5 包含 Dataset Charter、Source Register、Sampling Plan、Reference Standard、Annotation Protocol、Split Manifest、Dataset Manifest、Data Quality Gate 8 类模板，以及退款 Agent、合同审查 Agent、企业知识助手 3 个完整案例。Node 24 本地 `npm ci && npm run check` 共 96 项测试、品牌与仓库验证通过；候选提交 [`ea6c538`](https://github.com/plwslpld-arch/evalorium/commit/ea6c53834c453ca8430c9d7ca57a4eeaf854dd82) 的 [Documentation Quality run 31377072773](https://github.com/plwslpld-arch/evalorium/actions/runs/31377072773) 精确匹配且成功。该验证只证明公开评测数据治理与完整性合同，不证明真实数据已物化、Agent trial、Scorer、Metric、Harness 或系统 Gate、生产效果或个人能力。

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
