# Evalorium：跨设备恢复入口

本文件是所有电脑、所有新会话和所有贡献者的统一恢复入口。对话用于交互，Git 仓库才是持久事实来源。

## 产品目标

Evalorium 是独立、开源、企业级的 AI 质量工程平台，目标覆盖质量标准、评测框架、统计测量、LLM-as-Judge、人工评测、Agent Environment Harness、安全红队、CI/CD 质量门禁、生产监控、治理和 Eval-to-RL。

当前先通过 Academy 完成系统学习和实践证据，再逐步实现 Platform。课程不会因一个月节奏目标而缩减。

## 每次恢复的固定顺序

开始前执行：

```powershell
git pull --rebase
```

然后依次完整读取：

1. `START_HERE.md`
2. `progress/state.yaml`
3. `progress/PROGRESS.md`
4. `handoffs/CURRENT.md`

严格从 `progress/state.yaml` 的 `next_actions` 继续，并确认当前单元处于学习、复述、实践、测评、文档整理还是提交阶段。

## 新会话恢复提示词

```text
请完整读取 START_HERE.md、progress/state.yaml、
progress/PROGRESS.md 和 handoffs/CURRENT.md，恢复 Evalorium
的产品决策、学习状态、完成证据和当前上下文。严格从 next_actions
继续，不跳过未通过的单元，不缩减课程范围，不提前生成已完成课程正文。
```

## Academy 单元门禁

每个知识单元只能按以下顺序推进：

```text
学习 → 复述确认 → 实践 → 测评 → 通过后整理文档 → 验证 → 提交 → 下一单元
```

- 课程地图、学习目标和编号可以提前规划。
- 正式课程正文、实验总结和能力证据只能在测评通过后写入。
- 测评未通过时留在当前单元，回到学习阶段。
- 未通过时可以更新尝试次数、误区和纠错信息，但不得标记完成。
- 文档沉淀是学习闭环的最后阶段，不是学习的替代品。

## 每次结束的固定顺序

1. 根据实际结果更新 `progress/state.yaml`。
2. 同步更新 `progress/PROGRESS.md` 和能力矩阵。
3. 测评通过后才创建正式单元正文和学习日志。
4. 将旧 Handoff 移入 `handoffs/archive/`，再生成新的 `handoffs/CURRENT.md`。
5. 运行 `npm ci` 和 `npm run check`。
6. 检查差异和敏感信息。
7. commit 并 push。

发生状态冲突时，停止进入下一单元，通过 Git 历史、最近验证证据和 Handoff 修复；不得静默覆盖。

## 安全要求

- 禁止提交 API Key、Token、密码、Cookie、个人数据或本地登录文件。
- 禁止提交 `.env`、`.codex/`、`.superpowers/` 和 `auth.json`。
- 每台电脑分别使用 `gh auth login` 完成安全授权。
- 曾出现在对话、日志、Issue 或提交中的 Token 必须撤销并轮换。
