<!-- evalorium-progress current=A1.3 current_status=in_progress last_completed=A1.2 last_status=artifact_validated -->

<p align="center">
  <img src="docs/assets/brand/evalorium-logo.svg" alt="Evalorium" width="420">
</p>

<p align="center"><strong>发布之前，证据先行。</strong></p>

<p align="center">
  面向模型、RAG、Agent 与多智能体系统的开源企业级 AI 质量工程平台。
</p>

<p align="center">
  <a href="README.md">English</a> · 简体中文
</p>

<p align="center">
  <a href="https://github.com/plwslpld-arch/evalorium/actions/workflows/docs-quality.yml"><img src="https://github.com/plwslpld-arch/evalorium/actions/workflows/docs-quality.yml/badge.svg" alt="Documentation Quality"></a>
</p>

> **当前状态：Academy 基础建设阶段。** 学习体系和证据系统正在建设；下文 Platform 是目标架构，不代表生产级软件已经交付。

## Evalorium 是什么

Evalorium 将 AI 系统的质量要求和风险转化为可复现评测、发布门禁、生产监控、治理证据和改进数据。

许多评测工具回答的是一个局部问题：“模型在这个数据集上得了多少分？”Evalorium 面向更完整的企业决策：“我们是否有足够可靠的证据发布这个 AI 系统、让它持续运行，并安全地改进它？”

## 核心原则

- **发布之前，证据先行**：任何质量结论都必须追溯到测试、测量和限制条件。
- **显式处理不确定性**：同时考虑抽样、模型、Judge 和执行环境的不确定性。
- **评测完整系统**：覆盖模型、检索、工具、记忆、环境与策略边界。
- **风险驱动**：将能力、可靠性、安全、偏见、成本和运行风险纳入同一个决策模型。
- **可复现**：任务、环境、版本、轨迹和门禁结果都可以重放和审计。
- **没有证据就不提升成熟度**：计划、实现、验证和生产证明是不同状态。

## 两条相互连接的主线

| 主线 | 目的 | 当前状态 |
|---|---|---|
| **Academy** | 发布经过验证的学习成果，并为独立能力证据提供体系 | 学习中 |
| **Platform** | 将方法实现为企业级评测与质量控制平台 | 计划中 |

Academy 公开成果的每个知识单元必须依次经过：

```text
系统学习 → 完整解释与案例 → 校订可发布成果 → 验证 → 提交 → 下一单元
```

课程地图和学习目标可以预先规划。正式课程、工程模板、案例、HTML 和验证合同只有在提交并通过门禁后才算公开交付完成。成果交付状态不代表个人已经掌握；个人能力声明需要与声明等级相匹配的独立证据。

## 目标能力地图

| 能力 | 职责 |
|---|---|
| Standards | 质量模型、风险分类、基线与发布策略 |
| Eval Core | Task、Dataset、Runner、Solver、Scorer、Judge 与报告 |
| Measurement | 抽样、不确定性、置信区间、效应量与显著性 |
| LLM-as-Judge | 校准、偏差检测、可靠性与人工对照 |
| Human Evaluation | 标注设计、抽样、仲裁与一致性 |
| Agent Environment Harness | 受控环境、工具、状态断言、轨迹与故障注入 |
| Security and Red Team | 威胁模型、对抗生成、权限与安全回归 |
| Quality Gates | PR、CI/CD、灰度、发布与例外决策 |
| Observability | 质量退化、幻觉、偏见、延迟、成本与事故信号 |
| Governance | 责任、审批、证据链、审计与风险接受 |
| Eval-to-RL | 失败挖掘、偏好数据、Verifier、Reward 与训练导出 |
| Academy | 正式课程、实验、测评与 Capstone |

详见[目标架构](docs/ARCHITECTURE.md)和[范围边界](docs/SCOPE.md)。

## Agent Environment Harness

Agent Environment Harness 是 Evalorium 内部的深度核心能力。它负责创建和重置环境、提供受控工具、记录行为轨迹、注入故障、检查最终状态，并判断 Agent 是否真正、安全、可靠地完成任务。

它用于评测 Agent 产品，本身不是 Claude Code 类通用 Coding Agent 运行时。

## Eval-to-RL 闭环

```text
评测结果与生产事故
  → 失败聚类与困难样本
  → 人工偏好、Verifier 与 Reward 信号
  → 训练或策略改进
  → 回归评测与发布门禁
```

## 当前成熟度

| 领域 | 状态 | 证据 |
|---|---|---|
| 仓库与品牌基础 | 已实现 | 版本化资产和本地验证 |
| Academy 课程 | 学习中 | A1.1、A1.2 公开成果合同已验证，A1.3 正在进行 |
| Platform 运行时 | 计划中 | 只有设计和路线图 |
| 生产采用 | 未声明 | 需要真实组织的外部证据 |

解释任何能力声明前，请先阅读[项目成熟度模型](docs/PROJECT_MATURITY.md)。

## 学习范围

完整学习计划包括：

- 8 个阶段
- 29 个核心章节
- 不少于 138 个知识单元
- 8 个阶段 Capstone
- 1 个企业级综合 Capstone

课程不会为了一个月节奏目标而缩减。时间只是学习节奏约束，不是删除内容或证据的理由。

## 文档

- [文档索引](docs/README.md)
- [产品愿景](docs/VISION.md)
- [范围和非目标](docs/SCOPE.md)
- [目标架构](docs/ARCHITECTURE.md)
- [路线图](docs/ROADMAP.md)
- [项目成熟度](docs/PROJECT_MATURITY.md)
- [掌握标准](docs/MASTERY_STANDARD.md)
- [岗位能力映射](docs/JD_COMPETENCY_MAP.md)
- [品牌规范](docs/BRAND.md)
- [在另一台电脑恢复学习](START_HERE.md)
- [多电脑 GitHub 同步执行协议](docs/workflows/cross-device-github.md)

## 贡献与安全

提交变更前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题按照 [SECURITY.md](SECURITY.md) 私下报告。社区参与遵循 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 许可证

Apache License 2.0，详见 [LICENSE](LICENSE)。
