# 多电脑 GitHub 同步执行协议

本协议适用于仓库所有者按既定决策直接修改 `main` 的场景。目标是让任意一台已授权电脑都能从 GitHub 恢复到同一个、已验证的学习现场。

## 核心合同

1. GitHub `origin/main` 是唯一可跨设备恢复的状态；未提交或未推送内容不属于可交接状态。
2. 同一时间只有一台电脑或一个 Agent 是 active writer。其他电脑只能读取，直到当前 writer 完成推送和远端验证。
3. 每次工作绑定一个不可变 base SHA。推送前如果远端 `main` 已不再等于这个 SHA，立即停止，不做强推或自动覆盖。
4. 换电脑只发生在 verified commit boundary：提交已推送、该提交的 Actions 已通过、本地和远端 SHA 一致、工作树为空。
5. `progress/state.yaml` 决定学习位置；`progress/PROGRESS.md`、README、成熟度与 Handoff 是必须同步的公开镜像。

## 每台电脑首次设置

1. 安装 Git、GitHub CLI 和支持 `.nvmrc` 的 Node 版本管理工具。
2. 使用 `gh auth login` 的浏览器设备流程授权当前电脑。
3. 运行 `gh auth status`，确认登录的是预期 GitHub 账号。
4. 克隆 `https://github.com/plwslpld-arch/evalorium.git`；不得把访问 Token 放进 URL。
5. 进入仓库后切换至 `.nvmrc` 指定的最新 Node 24 LTS，并运行 `npm ci`。

任何曾出现在对话、日志、Issue、命令历史或文件中的 Token 都必须在 GitHub 撤销并轮换。仓库自带的模式扫描只是补充门禁，不能替代凭证管理。

## 开工检查

```bash
gh auth status
git branch --show-current
git status --short
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git log --oneline origin/main..HEAD
```

必须同时满足：

- 当前分支是 `main`；
- `git status --short` 没有输出；
- `origin/main..HEAD` 没有本地未推送提交；
- `HEAD` 与 `origin/main` 完全相等；
- 本地没有 merge、rebase 或 cherry-pick 中断状态。

满足后执行：

```bash
git pull --ff-only origin main
git rev-parse HEAD
```

保存最后一条输出作为本次工作的 `base SHA`。随后按顺序读取 `START_HERE.md`、`progress/state.yaml`、`progress/PROGRESS.md` 和 `handoffs/CURRENT.md`，只执行 `next_actions`。

## 工作与进度更新

- 学习内容、工程资产和验证合同在同一台 active-writer 电脑上完成。
- 私人回答、对话、草稿和认证文件不进入仓库。
- 单元分两阶段发布：先提交并推送候选单元包，等待该准确提交的远端门禁通过；再用后续状态提交把它标为 `artifact_validated` 并推进 `current.unit`。状态提交本身也必须通过 Actions 后才能交接。
- 进度变化时，同时更新机器状态、可读进度、Academy 导航、README、成熟度/能力镜像和当前 Handoff。
- 公开 artifact 状态不等于个人能力证明；个人能力需要独立证据。

## 提交和推送门禁

先在 Node 24 LTS 下验证：

```bash
node --version
npm ci
npm run check
git diff --check
git status --short
```

复核只包含预期文件且没有敏感信息。然后验证 base SHA 没有失效：

```bash
git fetch origin
git rev-parse origin/main
```

如果输出不等于开工时保存的 base SHA，停止提交，先读取远端变化并人工合并意图。禁止 `git push --force`、破坏性 reset 或静默覆盖。

如果一致，创建可审查的 Conventional Commit，并推送：

```bash
git push origin main
```

随后取得这个准确提交的 Actions 运行并等待结束：

```bash
git rev-parse HEAD
gh run list --workflow docs-quality.yml --commit "$(git rev-parse HEAD)" --limit 1 --json databaseId,headSha,status,conclusion,url
gh run watch "$(gh run list --workflow docs-quality.yml --commit "$(git rev-parse HEAD)" --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
gh run view "$(gh run list --workflow docs-quality.yml --commit "$(git rev-parse HEAD)" --limit 1 --json databaseId --jq '.[0].databaseId')" --json headSha,conclusion,url
```

如果运行尚未出现在列表中，等待片刻后重新查询，不得改为观察其他提交。最后一次查询的 `headSha` 必须等于本地 `HEAD`，`conclusion` 必须为 `success`。只有这两个条件都成立，工作才可交接。最后执行：

```bash
git fetch origin
git status --short
git rev-parse HEAD
git rev-parse origin/main
```

工作树必须为空，两个 SHA 必须一致。

## 异常恢复

| 现场 | 处理 |
|---|---|
| 有未提交修改 | 留在原电脑完成或明确放弃；不要在另一台电脑继续 |
| 有本地未推送提交 | 在原电脑验证并推送；远端不可恢复这些提交 |
| 远端在工作期间前进 | 停止推送，比较 base SHA 与远端提交，人工整合后重新完整验证 |
| Actions 失败 | active writer 在同一台电脑修复并重新推送；不得推进学习状态 |
| 账号或 remote 不匹配 | 停止写操作，修复 `gh` 身份或 remote 后重新执行开工检查 |
| Token 暴露 | 立即撤销和轮换，检查仓库与历史，不继续复用该 Token |

外部贡献者不使用上述直改 `main` 流程，而是遵循 [`CONTRIBUTING.md`](../../CONTRIBUTING.md) 的分支和 Pull Request 流程。
