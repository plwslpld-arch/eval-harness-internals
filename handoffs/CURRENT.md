# Current Handoff

## 已确认决策

1. Evalorium 是独立、开源、企业级的 AI 质量工程平台，与 Loopward、Rein、Vein 解耦。
2. Agent Environment Harness 是深度核心模块；Evalorium 不是通用 Coding Agent 运行时。
3. Academy 和 Platform 都是正式交付物。
4. 课程采用“学习、复述、实践、测评、通过后文档、验证、提交、下一单元”的固定门禁。
5. 课程范围保持 8 个阶段、29 个核心章节、不少于 138 个知识单元、8 个阶段 Capstone 和 1 个企业级综合 Capstone。

## 当前状态

- 当前分支：`main`
- 远程同步：公开仓库 `origin/main` 已包含提交 `98a4b6a88a1a0767c650e893abebb3d6cca33962`
- 项目成熟度：`learning`
- Academy：`learning`
- Platform：`planned`
- 当前单元：A1.1《AI评测的本质》
- 当前关口：学习
- A1.1 测评：尚未通过，0 次尝试

## 已完成证据

- Evidence Gate SVG 品牌源文件和脚本派生 PNG。
- 仓库验证器及 9 个自动化测试。
- 中英文 README。
- 愿景、范围、目标架构、路线图、成熟度、掌握标准和 JD 能力映射。
- 贡献、安全和社区行为文件。
- GitHub Documentation Quality 工作流已在 Linux 上通过：[run 31204362566](https://github.com/plwslpld-arch/evalorium/actions/runs/31204362566)。

## 本次变更

建立了公开项目信息架构和品牌体系；将成熟度声明绑定到证据；将“先学习、后沉淀”写入机器状态、人类进度和 Handoff 协议。正式横版 Logo 已改为纯 SVG 几何路径，消除了 Windows 与 Linux 的字体渲染差异；GitHub Actions 使用已核验的 `actions/checkout@v7` 与 `actions/setup-node@v7`。

## 验证结果

已执行完整的 `npm run check`：9 个自动化测试通过，品牌派生文件与 SVG 一致，仓库文档、YAML、链接、UTF-8、SVG 安全和凭据形态验证通过。提交 `98a4b6a88a1a0767c650e893abebb3d6cca33962` 的远程 Documentation Quality 工作流在 Ubuntu 上通过。

## 下一次准确动作

1. 从 A1.1 第一节《AI评测的本质》开始正式学习。
2. 依次完成复述确认、实践和正式测评。
3. A1.1 通过测评后才创建完成版课程正文和能力证据。
4. 文档验证和提交完成后才进入 A1.2。

## 未解决问题与风险

- Platform 尚无运行时代码。
- GitHub Pages 尚未建设。
- 没有生产采用、组织影响或工作年限证据。
- A1.1 尚未学习完成，不能标记为课程成果。

## Git 状态

- 本 Handoff 基于已通过本地与远程质量门禁的提交 `98a4b6a88a1a0767c650e893abebb3d6cca33962`。
- 对应远程证据为 [Documentation Quality run 31204362566](https://github.com/plwslpld-arch/evalorium/actions/runs/31204362566)。
- 本次元数据提交之后的当前真实 HEAD 使用 `git rev-parse HEAD` 获取；`based_on_commit` 刻意记录被描述且已验证的前序提交，避免自引用。
