# Curriculum

<!-- evalorium-progress current=A1.7 current_status=not_started last_completed=A1.6 last_status=artifact_validated -->

完整课程将覆盖 8 个阶段、29 个核心章节、不少于 138 个知识单元、8 个阶段 Capstone 和 1 个企业级综合 Capstone。

课程目录必须与 `progress/state.yaml`、能力矩阵和项目交付物保持可追踪关系。每个单元逐一完成学习、校订、工程化和验证后发布，不用占位正文冒充完成内容。

## Phase A · 评测基础

### Chapter A1 · 评测的对象、证据与决策

- [A1.1｜AI 评测的本质](../phase-a/chapter-a1/unit-a1-1/README.md)（公开成果结构合同已验证）
- [A1.2｜从业务需求到评测问题](../phase-a/chapter-a1/unit-a1-2/README.md)（公开成果与追踪合同已验证）
- [A1.3｜评测对象、系统边界与版本](../phase-a/chapter-a1/unit-a1-3/README.md)（公开成果、目标身份与完整性合同已验证）
- [A1.4｜从评测问题到任务与场景](../phase-a/chapter-a1/unit-a1-4/README.md)（任务、场景、覆盖与完整性合同已验证）
- [A1.5｜从任务与场景到评测数据](../phase-a/chapter-a1/unit-a1-5/README.md)（评测数据治理与完整性合同已验证）
- [A1.6｜从参考标准到评分器](../phase-a/chapter-a1/unit-a1-6/README.md)（评分器设计、身份、证据与质量就绪合同已验证）
- A1.7（尚未开始；正式标题与范围待定义，学习完成前不创建正式成果或占位正文）

#### A1.6 已验证范围

A1.5 定义 Reference Standard 与评测数据治理；A1.6 进一步把参考标准、观察证据与风险构念转为可审计 Scorer，区分 Reference、Rubric、Scorer、Score、Metric 与 Gate，定义从 atomic claim 到 task/trial 的评分单位、Observation Bundle、确定性/程序化/人工/LLM-as-Judge/复合评分器、Rubric anchors、不确定与分歧仲裁、版本身份和质量就绪门。正式成果包含 8 类模板与退款 Agent、合同审查 Agent、企业知识助手 3 个案例；Node 24 本地 `npm ci && npm run check` 共 130 项测试通过，候选提交 [`dfd0c77`](https://github.com/plwslpld-arch/evalorium/commit/dfd0c77ad95f6c1c20f6011454bd626b9e2824f5) 对应的[远端 run 31393199383](https://github.com/plwslpld-arch/evalorium/actions/runs/31393199383) `completed/success`。该验证只证明公开 Scorer 设计、身份、证据追踪与质量就绪合同，不证明 A1.5 数据已物化、真实评分器实现或校准、trial、Score、Metric、Harness、统计推断、系统 Gate、生产效果或个人能力。

学习目标：

1. 严格区分 Reference、Rubric、Scorer、Score、Metric 与 Gate，避免把答案、判定程序和聚合结论混为一体。
2. 选择与构念和决策相匹配的评分单位，并以 Observation Contract 限定评分器可以读取的证据。
3. 组合确定性、程序化、人工与 LLM-as-Judge 评分器，确保高权威关键失败不会被低权威判断覆盖或平均掉。
4. 用尺度、anchors、证据要求、critical errors 与 unscorable 语义构建可审计 Rubric。
5. 显式处理不确定、弃权、不可评分、分歧、仲裁与结论不足，而不是强制生成分数。
6. 固定 Scorer 身份与版本，并从 reliability、validity、calibration、错误画像、偏差、鲁棒性和安全性决定质量就绪状态。
