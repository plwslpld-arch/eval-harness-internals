# Evalorium：跨设备恢复入口

本文件是所有电脑和所有新会话的统一入口。

## 项目目标

Evalorium 的原始定位保持不变：建设一个独立、开源、企业级的 AI 质量工程平台，完整覆盖质量标准、评测框架、统计测量、LLM-as-Judge、人工评测、Agent Environment Harness、安全红队、CI/CD 质量门禁、生产监控、治理以及 Eval-to-RL。

当前阶段先完成系统化学习和实践项目，再逐步实现完整平台。

## 每次恢复时必须读取

按以下顺序读取：

1. `START_HERE.md`
2. `progress/state.yaml`
3. `progress/PROGRESS.md`
4. `handoffs/CURRENT.md`

然后严格从 `progress/state.yaml` 中的 `next_actions` 继续。

## 新会话恢复提示词

```text
请先完整读取 START_HERE.md、progress/state.yaml、
progress/PROGRESS.md 和 handoffs/CURRENT.md，恢复 Evalorium
的产品决策、学习状态和当前上下文，然后从 next_actions 继续。
不要跳过未通过的知识单元，也不要缩减课程范围。
```

## 跨电脑工作流

开始前：

```powershell
git pull --rebase
```

结束前：

1. 更新 `progress/state.yaml`。
2. 更新 `progress/PROGRESS.md`。
3. 更新 `progress/learning-log/` 中的本次日志。
4. 将旧 handoff 归档并更新 `handoffs/CURRENT.md`。
5. 运行必要验证。
6. 检查敏感信息。
7. commit 并 push。

## 安全要求

- 禁止提交 API Key、Token、密码、Cookie 或本地登录文件。
- 禁止提交 `.env`、`.codex/`、`auth.json` 等本地凭据。
- 每台电脑分别使用 `gh auth login` 完成安全授权。
- 曾经出现在对话或日志中的 Token 必须撤销并轮换。
