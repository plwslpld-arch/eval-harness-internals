# Curriculum

<!-- evalorium-progress current=A1.8 current_status=not_started last_completed=A1.7 last_status=artifact_validated -->

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
- A1.8（尚未开始；正式标题与范围待定义，学习完成前不创建正式成果或占位正文）

#### A1.7 已验证范围

A1.6 将参考标准变成可审计 Scorer 与样本级 Score；A1.7 进一步把 Score Records 转换为可用于决策的 Metric 与 Estimate，显式定义 estimand、目标总体、分析单位、分母、重复运行依赖、micro/macro/目标加权聚合、paired cluster bootstrap、最小支持、效应边界、多重比较、停止规则、缺失与 coverage-risk，以及 Metric Quality Gate。正式成果包含 8 类模板与退款 Agent、合同审查 Agent、企业知识助手 3 个案例；Node 24 本地 `npm ci && npm run check` 共 140 项测试通过，候选提交 [`d7941a4`](https://github.com/plwslpld-arch/evalorium/commit/d7941a43b4e0c7b89e2a512ed41cb8db4cc4a708) 对应的[远端 run 31404873004](https://github.com/plwslpld-arch/evalorium/actions/runs/31404873004) `completed/success`。该验证只证明公开 Metric 设计与证据就绪合同，不证明真实 Score 或 Estimate 已物化、版本比较或统计结论成立、系统可发布、Harness、生产效果或个人能力。

学习目标：

1. 区分 Score、Metric、Estimand、Estimator、Estimate 与 Gate，先定义要估计的量，再选择计算方法。
2. 固定目标总体、分析单位、分母与缺失处理，避免选择偏差、静默丢弃和 Simpson 悖论。
3. 根据任务层级、重复运行与版本配对关系选择 micro、macro、目标加权和分层聚合。
4. 使用成对整簇重采样、置信区间、最小支持和稀有事件界限表达不确定性，不把 run 错当独立样本。
5. 预声明 superiority、non-inferiority、equivalence 或绝对阈值问题，并控制多重比较、可选停止与胜者诅咒。
6. 通过 Estimate Record、Comparison Report 与 Metric Quality Gate 阻止设计稿伪装成统计结论或发布依据。
