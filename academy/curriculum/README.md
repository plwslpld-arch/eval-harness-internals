# Curriculum

<!-- evalorium-progress current=A2.1 current_status=not_started last_completed=A1.9 last_status=artifact_validated -->

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
- [A1.7｜从样本级评分到可信指标](../phase-a/chapter-a1/unit-a1-7/README.md)（指标、分母、聚合、不确定性、分析与证据就绪合同已验证）
- [A1.8｜从评测证据到质量决策](../phase-a/chapter-a1/unit-a1-8/README.md)（质量基线、Gate DAG、决策、豁免、发布与生产响应合同已验证）
- [A1.9｜从评测计划到可复现运行](../phase-a/chapter-a1/unit-a1-9/README.md)（运行身份、Trial/Attempt、Trace、血缘、恢复、预算、适配器与审计合同已验证）

#### A1.9 已验证范围

A1.8 将评测证据转化为质量决定；A1.9 进一步把计划转化为身份不可变、统计有效、可恢复和可审计的 Harness 运行，显式定义 Study/Run/Sample/Trial/Attempt 对象模型、三类 Digest 与身份调和、并发租约和 canonical commit、Trace 与 Artifact 血缘、错误/重试/断点恢复、产品与 Harness 预算、停止规则、主流工具 Adapter 能力和运行审计。正式成果包含 10 类契约与退款 Agent、合同审查 Agent、企业知识助手 3 个案例；Node 24 本地 `npm ci && npm run check` 共 163 项测试通过，候选提交 [`5e19133`](https://github.com/plwslpld-arch/evalorium/commit/5e191339200528e82ae01c54cc099dbbf6d85631) 对应的[远端 run 31451972040](https://github.com/plwslpld-arch/evalorium/actions/runs/31451972040) `completed/success`。该验证只证明公开运行合同存在且关键语义可由仓库校验器执行，不证明真实分布式 Harness、第三方适配器、生产运行、发布授权或个人能力。

学习目标：

1. 区分 Study、Run、Sample、Trial、Attempt、Trace、Score Event 与 Aggregation。
2. 使用不可变身份、三类 Digest 和 Planned–Observed Reconciliation 固化运行对象与可比性。
3. 设计租约、fencing token、幂等 canonical commit、稳定聚合、错误分类、受控重试和断点恢复。
4. 建立 Trace、Artifact、Observation Bundle、Score Event、Metric 与 Gate 的完整数据血缘，同时禁止隐藏推理采集。
5. 分离产品预算与 Harness 预算，预声明费用、超时、安全停止、资源停止和证据结论边界。
6. 以明确能力声明接入 Inspect AI、OpenAI Evals、LangSmith、MLflow、Phoenix、DeepEval 与 Promptfoo，不伪造第三方缺失语义。

### Chapter A2 · 正式标题与范围待定义

- A2.1（尚未开始；先定义章节与单元边界，学习完成前不创建正式成果或占位正文）
