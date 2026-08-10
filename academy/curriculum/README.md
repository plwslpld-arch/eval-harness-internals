# Curriculum

<!-- evalorium-progress current=A1.5 current_status=not_started last_completed=A1.4 last_status=artifact_validated -->

完整课程将覆盖 8 个阶段、29 个核心章节、不少于 138 个知识单元、8 个阶段 Capstone 和 1 个企业级综合 Capstone。

课程目录必须与 `progress/state.yaml`、能力矩阵和项目交付物保持可追踪关系。每个单元逐一完成学习、校订、工程化和验证后发布，不用占位正文冒充完成内容。

## Phase A · 评测基础

### Chapter A1 · 评测的对象、证据与决策

- [A1.1｜AI 评测的本质](../phase-a/chapter-a1/unit-a1-1/README.md)（公开成果结构合同已验证）
- [A1.2｜从业务需求到评测问题](../phase-a/chapter-a1/unit-a1-2/README.md)（公开成果与追踪合同已验证）
- [A1.3｜评测对象、系统边界与版本](../phase-a/chapter-a1/unit-a1-3/README.md)（公开成果、目标身份与完整性合同已验证）
- [A1.4｜从评测问题到任务与场景](../phase-a/chapter-a1/unit-a1-4/README.md)（任务、场景、覆盖与完整性合同已验证）
- A1.5（尚未开始；正式标题与范围待定义，学习完成前不创建占位成果）

#### A1.4 已验证范围

A1.3 锁定“评测的是哪个对象、处于什么系统边界、版本与运行状态”；A1.4 把已经绑定对象的评测问题转化为可执行的场景族、任务规格、变体和覆盖模型。正式成果包含 6 类模板与退款 Agent、合同审查 Agent、企业知识助手 3 个案例；Node 24 本地 `npm run check` 共 64 项测试通过，[远端 run 31361998848](https://github.com/plwslpld-arch/evalorium/actions/runs/31361998848) 成功。数据集治理、统计抽样、Scorer 设计与 Harness 实现不在本单元展开；验证不声明真实 Harness 运行、科学效度或个人能力。

学习目标：

1. 区分用例、场景、任务、测试案例、样本和试次。
2. 从风险、构念和评测问题推导场景空间，而不是直接编写若干 Prompt。
3. 设计正常、失败、边界、对抗、状态化、时序和多轮场景族。
4. 用 Task Spec 定义输入、初始状态、可用动作、成功条件、观察和停止规则。
5. 用覆盖矩阵解释“覆盖了哪些条件、组合和风险”，不把样本数量当成覆盖度。
6. 分清任务不变部分、受控变量和随机变体，为后续数据、Harness 与测量单元提供稳定接口。
