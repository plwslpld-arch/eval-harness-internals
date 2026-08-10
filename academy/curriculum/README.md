# Curriculum

<!-- evalorium-progress current=A1.6 current_status=not_started last_completed=A1.5 last_status=artifact_validated -->

完整课程将覆盖 8 个阶段、29 个核心章节、不少于 138 个知识单元、8 个阶段 Capstone 和 1 个企业级综合 Capstone。

课程目录必须与 `progress/state.yaml`、能力矩阵和项目交付物保持可追踪关系。每个单元逐一完成学习、校订、工程化和验证后发布，不用占位正文冒充完成内容。

## Phase A · 评测基础

### Chapter A1 · 评测的对象、证据与决策

- [A1.1｜AI 评测的本质](../phase-a/chapter-a1/unit-a1-1/README.md)（公开成果结构合同已验证）
- [A1.2｜从业务需求到评测问题](../phase-a/chapter-a1/unit-a1-2/README.md)（公开成果与追踪合同已验证）
- [A1.3｜评测对象、系统边界与版本](../phase-a/chapter-a1/unit-a1-3/README.md)（公开成果、目标身份与完整性合同已验证）
- [A1.4｜从评测问题到任务与场景](../phase-a/chapter-a1/unit-a1-4/README.md)（任务、场景、覆盖与完整性合同已验证）
- [A1.5｜从任务与场景到评测数据](../phase-a/chapter-a1/unit-a1-5/README.md)（评测数据治理与完整性合同已验证）
- A1.6（尚未开始；正式标题与范围待定义，学习完成前不创建正式成果或占位正文）

#### A1.5 已验证范围

A1.4 将评测问题转换为任务、场景、变体和覆盖模型；A1.5 进一步定义评测数据的目标总体、分析单位、抽样框、distribution/challenge/regression 分区、来源与血缘权利、Reference Standard、独立盲标与仲裁、五类泄漏控制、不可变版本及 Data Quality Gate。正式成果包含 8 类模板与退款 Agent、合同审查 Agent、企业知识助手 3 个案例；Node 24 本地 `npm ci && npm run check` 共 96 项测试通过，候选提交 [`ea6c538`](https://github.com/plwslpld-arch/evalorium/commit/ea6c53834c453ca8430c9d7ca57a4eeaf854dd82) 对应的[远端 run 31377072773](https://github.com/plwslpld-arch/evalorium/actions/runs/31377072773) `completed/success`。该验证只证明公开评测数据治理与完整性合同，不证明真实数据已物化、Agent trial、Scorer、Metric、Harness 或系统 Gate、生产效果或个人能力。

学习目标：

1. 将 Task Spec 与场景覆盖转换为可审计的 Dataset Charter，显式限定总体、单位、框、用途和结论边界。
2. 分开 distribution、challenge 与 regression 数据的选择机制和分母，不把样本数量当作风险覆盖。
3. 管理数据来源、血缘、授权、隐私、许可、保留和漂移，不让“有文件”代替数据权利。
4. 设计可接受多值、状态与未知的 Reference Standard，并保留独立盲标、分歧与仲裁记录。
5. 按 parent、entity、document、template 与 time 五类边界控制泄漏，保护 Reference 与受保护 split。
6. 通过不可变 Dataset Manifest 和 Data Quality Gate 决定数据是 `ready`、`partial`、`blocked` 还是 `invalid`。
