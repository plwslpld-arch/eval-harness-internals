# Evalorium：跨设备恢复入口

本文件是所有电脑、新任务和贡献者的统一恢复入口。对话用于交互，Git 仓库是持久事实来源。

## 产品目标

Evalorium 是独立、开源、企业级的 AI 质量工程平台，目标覆盖质量标准、评测框架、统计测量、LLM-as-Judge、人工评测、Agent Environment Harness、安全红队、CI/CD 质量门禁、生产监控、治理和 Eval-to-RL。

当前先通过 Academy 逐单元交付经过校订与验证的课程、模板和案例，再逐步实现 Platform。课程不会因为一个月的节奏目标而缩减。

## 每次恢复的固定顺序

开始前执行：

```powershell
git pull --rebase
```

然后依次读取：

1. `START_HERE.md`
2. `progress/state.yaml`
3. `progress/PROGRESS.md`
4. `handoffs/CURRENT.md`

严格从 `progress/state.yaml` 的 `next_actions` 继续。不要把对话记忆当成仓库状态，也不要重复生成已经通过验证的单元。

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
2. 同步更新 `progress/PROGRESS.md`、Academy 导航和 `handoffs/CURRENT.md`。
3. 运行 `npm ci` 和 `npm run check`。
4. 检查差异、相对链接、示例数据和敏感信息。
5. commit 并 push。
6. 确认对应远程 GitHub Actions 在该提交上通过。

发生状态冲突时，停止进入下一单元，通过 Git 历史、最近验证证据和 Handoff 修复，不得静默覆盖。

## 安全要求

- 禁止提交 API Key、Token、密码、Cookie、个人数据或本地登录文件。
- 禁止提交 `.env`、`.codex/`、`.superpowers/` 和 `auth.json`。
- 每台电脑分别使用 `gh auth login` 完成安全授权。
- 曾出现在对话、日志、Issue 或提交中的 Token 必须撤销并轮换。
