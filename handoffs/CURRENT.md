# Current Handoff

## 已确认决策

1. Evalorium 是独立、开源、企业级的 AI 质量工程平台，与 Loopward、Rein、Vein 解耦。
2. Agent Environment Harness 是深度核心模块；Evalorium 不是通用 Coding Agent 运行时。
3. Academy 和 Platform 都是正式交付物。
4. 课程采用“学习、复述、实践、测评、通过后文档、验证、提交、下一单元”的固定门禁。
5. 课程范围保持 8 个阶段、29 个核心章节、不少于 138 个知识单元、8 个阶段 Capstone 和 1 个企业级综合 Capstone。

## 当前状态

- 实施分支：`feat/open-source-foundation`
- 项目成熟度：`learning`
- Academy：`learning`
- Platform：`planned`
- 当前单元：A1.1《AI评测的本质》
- 当前关口：学习
- A1.1 测评：尚未通过，0 次尝试

## 已完成证据

- Evidence Gate SVG 品牌源文件和脚本派生 PNG。
- 仓库验证器及 8 个自动化测试。
- 中英文 README。
- 愿景、范围、目标架构、路线图、成熟度、掌握标准和 JD 能力映射。
- 贡献、安全和社区行为文件。

## 本次变更

建立了公开项目信息架构和品牌体系；将成熟度声明绑定到证据；将“先学习、后沉淀”写入机器状态、人类进度和 Handoff 协议。

## 验证结果

已执行完整的 `npm run check`：8 个自动化测试通过，品牌派生文件与 SVG 一致，仓库文档、YAML、链接、UTF-8、SVG 安全和凭据形态验证通过。

## 下一次准确动作

1. 合并并推送到公开仓库，确认远程 Documentation Quality 工作流成功。
2. 回到 A1.1 第一节正式学习。
3. 依次完成复述确认、实践和正式测评。
4. A1.1 通过测评后才创建完成版课程正文和能力证据。
5. 文档验证和提交完成后才进入 A1.2。

## 未解决问题与风险

- Platform 尚无运行时代码。
- GitHub Pages 尚未建设。
- 没有生产采用、组织影响或工作年限证据。
- A1.1 尚未学习完成，不能标记为课程成果。

## Git 状态

- 本 Handoff 基于提交 `63cc108a91b8dc55d27cafb35f35873b4867bac3` 之后的工作。
- 当前真实提交使用 `git rev-parse HEAD` 获取。
- 完成最终验证后再更新远程同步结果。
