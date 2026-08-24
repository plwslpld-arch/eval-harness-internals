# 仓库协作说明

## 项目定位

本仓库是面向开发者的中文 Eval Harness 源码教材与可运行参考实现。正文优先解释机制、调用链、数据合同、失败语义和设计取舍，不写项目进度、会话记录、私有交接信息或个人能力声明。

## 内容规则

- 公开内容默认使用中文；代码标识符、项目名称和必须精确匹配的 API 保留英文；
- DeepSeek Harness 首次出现时写全称，不使用孤立的 “DSH”；
- 上游源码事实必须指向 `sources/sources.lock.yml` 所固定提交的永久链接；
- 清楚区分源码事实、机制解释、教学简化、外部契约和不可核对内容；
- 正式架构图、流程图和数据图使用中文标签，并保留可访问的标题与描述；
- 仓库正文不得出现本机绝对路径、凭据、私有数据或聊天式进度说明；
- 不把测试通过、课程完整或第三方结果表述为生产就绪、发布授权或个人能力证明。

## 工具链

项目只要求 Python 3.12 与 `uv`，不依赖 Node.js、NVM 或模型 API 凭据。

```bash
uv sync --frozen
uv run pytest -q
uv run python scripts/repository_quality.py
uv run mkdocs build --strict
uv build
```

涉及锁定来源时还要运行：

```bash
uv run python scripts/sources.py verify
```

## 修改原则

- 保留用户未授权改动，不使用强制推送或破坏性 Git 操作；
- 新增行为先写失败测试，再实现最小改动；
- 新增核心课程时同步更新 `mkdocs.yml`、文档目录、必要图示和自动化检查；
- 修改 Reference Harness 时保持 Trial 与 Attempt、产品失败与基础设施失败、Score 与 Metric、评测 Gate 与发布授权之间的边界；
- 提交前运行完整验证，并在推送后核对该提交对应的 GitHub Actions。
