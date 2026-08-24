# 参与贡献

感谢你帮助改进 Eval Harness 源码内核。贡献可以是源码解释校正、可运行案例、Reference Harness、测试、图示或阅读体验改进。

## 开始之前

较大的源码课程、架构变化、新评测领域或合同语义变更，请先创建 Issue，说明：

- 要解决的问题；
- 影响哪些读者或工程场景；
- 依赖的上游来源与锁定范围；
- 预期证据和验证方法；
- 明确不包含的范围。

小型错字、失效链接和聚焦的测试修复可以直接提交 Pull Request。

## 本地开发

需要 Python 3.12 和 `uv`：

```bash
uv sync --frozen
uv run pytest -q
uv run python scripts/repository_quality.py
uv run mkdocs build --strict
uv build
```

更新上游来源注册表或锁文件时，再运行：

```bash
uv run python scripts/sources.py verify
```

## 文档贡献标准

一篇核心源码课至少应该让读者理解：

1. 要解决的工程问题；
2. 锁定版本与源码入口；
3. 完整调用链和关键数据结构；
4. 状态变化、失败语义与实现取舍；
5. 可运行或可核对的实验；
6. 预期输出、参考答案与证据边界。

不要只罗列 API 或用几句话概括大模块。若源码不足以支持结论，应明确写“不可核对”，不要推测闭源实现。

## 代码贡献标准

- 行为变更先添加会失败的测试；
- 保持确定性测试不需要模型凭据或容器；
- 不把基础设施重试计入新的 Trial 分母；
- 不把产品失败重试成通过；
- Score 必须保留 Observation、canonical Attempt 与 Scorer 身份血缘；
- 新增 Adapter 时提供 `full`、`partial`、`unavailable` 能力合同。

## Pull Request 内容

请说明改了什么、为什么需要、怎样验证、哪些情况仍可能失败，以及该修改不能证明什么。不得提交真实凭据、个人数据、专有样本、未授权源码副本或上游商标资产。
