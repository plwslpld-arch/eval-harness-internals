# Evalorium：跨设备恢复入口

<!-- evalorium-progress current=A2.2 current_status=not_started last_completed=A2.1 last_status=artifact_validated -->

本文件是所有电脑、新任务和贡献者的统一恢复入口。对话用于交互，Git 仓库是持久事实来源。

## 产品目标

Evalorium 是独立、开源、企业级的 AI 质量工程平台，目标覆盖质量标准、评测框架、统计测量、LLM-as-Judge、人工评测、Agent Environment Harness、安全红队、CI/CD 质量门禁、生产监控、治理和 Eval-to-RL。

当前先通过 Academy 逐单元交付经过校订与验证的课程、模板和案例，再逐步实现 Platform。课程不会因为一个月的节奏目标而缩减。

Chapter A2《测量理论、效度与可靠性》的 A2.1《从抽象质量到可测量构念》已完成公开成果验证：[正式课程](academy/phase-a/chapter-a2/unit-a2-1/README.md)、[独立 HTML](academy/phase-a/chapter-a2/unit-a2-1/index.html)、Measurement Charter、Construct Map、Indicator Register、Operationalization Spec、Measurement Error Model、Reliability Study Plan、Validity Argument、Measurement Quality Gate 共 8 类模板，以及退款 Agent、合同审查 Agent、企业知识助手 3 个合成案例均纳入 canonical profile。Node 24 本地 `npm ci && npm run check` 共 188 项测试、品牌与仓库验证通过；候选内容提交 [`9e5f8c7`](https://github.com/plwslpld-arch/evalorium/commit/9e5f8c722b83560517709eb90ca383719f28d580) 的 [Documentation Quality run 31492987925](https://github.com/plwslpld-arch/evalorium/actions/runs/31492987925) 精确匹配 head SHA 且 `completed/success`。该证据只证明公开测量设计及构念、代理、误差、可靠性/效度计划与追踪合同，不证明真实测量已经发生，不证明可靠性或效度已经成立，也不证明生产就绪、发布授权或个人能力。当前转入 A2.2，须先定义其正式标题、边界和学习范围，学习完成前不创建正式成果或占位正文。

## 每次恢复的固定顺序

GitHub `main` 是跨电脑唯一可交接的事实源；同一时间只能有一台电脑作为 active writer。开始前先确认当前目录、登录身份、分支和工作树：

```bash
gh auth status
git branch --show-current
git status --short
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
```

只有在当前分支为 `main`、工作树为空且没有本地未推送提交时，才执行：

```bash
git pull --ff-only origin main
```

只要存在本地修改、未推送提交、rebase/merge 状态，或 `HEAD` 与 `origin/main` 分叉，就停止恢复流程，不得用另一台电脑覆盖现场。然后依次读取：

1. `START_HERE.md`
2. `progress/state.yaml`
3. `progress/PROGRESS.md`
4. `handoffs/CURRENT.md`

严格从 `progress/state.yaml` 的 `next_actions` 继续。不要把对话记忆当成仓库状态，也不要重复生成已经通过验证的单元。

完整的开工、提交、冲突恢复与换机规则见 [`docs/workflows/cross-device-github.md`](docs/workflows/cross-device-github.md)。

## 新任务恢复提示词

```text
请完整读取 START_HERE.md、progress/state.yaml、progress/PROGRESS.md 和
handoffs/CURRENT.md，恢复 Evalorium 的产品决策、当前单元、已验证证据和下一步。
严格从 next_actions 继续，不缩减课程范围，不重复已完成交付物。
公开仓库只保存正式成果，不保存对话、个人回答或中间草稿。
```

## Academy 单元工作流

```text
系统学习 → 助手给出完整解释与案例 → 校订正式成果 → 工程模板与示例
       → 单元合同验证 → 提交 → 更新总体进度 → 下一单元
```

- 使用者主要阅读和理解，默认不要求在对话中逐题回答。
- 对话中的回答、错误、纠正过程、私人笔记和中间草稿不写入 GitHub。
- 每个已发布单元必须包含正式课程、独立 HTML、工程模板、案例和自动验收合同。
- “单元交付物已验证”只描述开源成果的完整性，不自动形成任何个人能力声明。
- 如需声明个人能力，必须另有与声明等级相匹配的独立证据；该过程不属于默认公开学习记录。
- 一个单元的文件和验证提交完成后，才能把 `current.unit` 切换到下一单元。

## 每次结束的固定顺序

1. 根据实际结果更新 `progress/state.yaml`。
2. 同步更新 `progress/PROGRESS.md`、Academy 导航、成熟度镜像和 `handoffs/CURRENT.md`。
3. 使用 `.nvmrc` 指定的 Node 24 LTS，运行 `npm ci` 和 `npm run check`。
4. 检查差异、相对链接、示例数据和敏感信息。
5. 再次 `git fetch origin`；只有 `origin/main` 仍等于本次开工记录的 base SHA 时才 commit 和 push。
6. 查出刚推送 SHA 对应的 run ID，再用 `gh run watch <run-id> --exit-status` 确认远端 GitHub Actions 通过。
7. 确认工作树为空，且本地 `HEAD` 等于 `origin/main`，再允许换电脑继续。

发生状态冲突时，停止进入下一单元，通过 Git 历史、最近验证证据和 Handoff 修复，不得静默覆盖。

## 安全要求

- 禁止提交 API Key、Token、密码、Cookie、个人数据或本地登录文件。
- 禁止提交 `.env`、`.codex/`、`.superpowers/` 和 `auth.json`。
- 每台电脑分别使用 `gh auth login` 完成安全授权。
- 推荐使用浏览器设备授权；用 `gh auth status` 核对账号，不把 Token 写入命令、remote URL、配置文件或对话。
- 曾出现在对话、日志、Issue 或提交中的 Token 必须撤销并轮换。
