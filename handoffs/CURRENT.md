# Current Handoff

## 已确认决策

1. Evalorium 是独立、开源、企业级的 AI 质量工程平台，与 Loopward、Rein、Vein 解耦。
2. Agent Environment Harness 是深度核心模块；Evalorium 不是通用 Coding Agent 运行时。
3. Academy 和 Platform 都是正式交付物。
4. 公开仓库只保存校订后的课程、工程模板、案例、验证与项目成果，不保存对话、个人回答、私人笔记或中间草稿。
5. Academy 默认由助手完整讲解并给出答案，使用者阅读和理解；不强制在对话中逐题作答。
6. 课程范围保持 8 个阶段、29 个核心章节、不少于 138 个知识单元、8 个阶段 Capstone 和 1 个企业级综合 Capstone。

## 当前状态

- 当前分支：`main`
- 公开仓库：<https://github.com/plwslpld-arch/evalorium>
- 项目成熟度：`learning`
- Academy：`learning`
- Platform：`planned`
- 当前单元：A1.2《从业务需求到评测问题》
- 已验证单元：A1.1《AI 评测的本质》

## A1.1 交付证据

- 正式 Markdown 课程和独立 HTML 阅读版。
- Evaluation Charter、Evaluation Target、Risk Definition、Task Spec、Harness Manifest、Metric Card、Gate Policy、Gate Decision、Monitoring Signal 共 9 类模板。
- 退款 Agent 和合同审查 Agent 两个端到端案例。
- Academy 单元包验证器，覆盖缺失资产、YAML 解析、决策字段和 HTML 可访问文档壳。
- 完整 `npm run check` 共 15 项自动化测试通过。
- 桌面页面和 390px 窄屏实际检查通过，无横向溢出或控制台错误。
- 内容提交：[`b8bb47b`](https://github.com/plwslpld-arch/evalorium/commit/b8bb47b41b0f68e9f51968fac3aeffb7cd6825f8)。
- Linux 远程门禁：[Documentation Quality run 31248603764](https://github.com/plwslpld-arch/evalorium/actions/runs/31248603764)。

## 下一次准确动作

1. 从 A1.2 第一部分开始：区分业务愿望、产品目标、风险陈述、决策问题和评测问题。
2. 用退款 Agent、合同审查 Agent 和企业知识助手展示同一句模糊需求如何导出不同评测设计。
3. 深入 Evaluation Charter、risk taxonomy、stakeholder-impact mapping、construct operationalization 和 evidence requirement。
4. 学完后交付 A1.2 的正式课程、HTML、模板、案例和自动化验证，再进入 A1.3。

## 未解决问题与风险

- Platform 尚无运行时代码。
- GitHub Pages 尚未建设，HTML 需要下载或本地打开；源文件已可从 GitHub 浏览。
- 尚无生产采用、组织影响或工作年限证据，相关声明不得由仓库规模替代。
- 完整 138+ 单元仍需按单元逐步交付；不得使用空正文或占位文件制造完成进度。

## Git 状态语义

- 本 Handoff 的完成证据基于内容提交 `b8bb47b41b0f68e9f51968fac3aeffb7cd6825f8`。
- 对应远程证据为 [Documentation Quality run 31248603764](https://github.com/plwslpld-arch/evalorium/actions/runs/31248603764)。
- Handoff 与状态元数据提交本身的远程运行号不做递归自引用；在最终交接中读取最新 GitHub Actions 即可。
