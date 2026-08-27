# 怎样验证本仓库

[上一节](glossary.md) · [下一节](source-and-license-boundaries.md)

本仓库的检查通过，只表示原创教材、Reference Harness、锁定源码链接和确定性 Fixture 满足声明合同——它不能证明任何上游工具已经生产就绪，也不能证明某个 AI 系统可以发布，更不能用作个人能力认证。

## 本地检查

从仓库根目录运行以下检查，因为只有整组命令全部完成，才能确认代码、教材、锁定来源和构建产物符合各自合同。

```bash
uv sync --frozen
uv run pytest -q
uv run python scripts/repository_quality.py
uv run python scripts/sources.py verify
uv run mkdocs build --strict
uv build
```

它们先检查仓库自身。

如果还要观察核心案例怎样生成运行记录、冻结证据并比较两个 Target，可以继续执行以下命令。

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/shipping
uv run eval-harness-ref inspect output/shipping
uv run eval-harness-ref compare output/shipping --candidate-target fixed --baseline-target buggy
```

证据会留在输出目录。

测试会覆盖对象不变量、Trial/Attempt、基础设施 retry、Artifact 摘要和路径、Trace 因果、Scorer/Metric/Gate、Bootstrap、CLI、四个案例、课程结构与永久源码链接，而最终发布流程还会构建 MkDocs 和完整中文 PDF，并逐页渲染以检查布局与中文字体。

## 怎样独立核对源码结论

1. 在 `sources/sources.lock.yml` 找课程对应 commit 与 scope；
2. 用正文永久链接打开锁定文件，不使用 main 分支当前内容；
3. 从入口沿文中调用链逐站核对调用者、输入、状态改变和返回值；
4. 对「机制解释」至少找两个互相支撑的调用点；
5. 公开源码不足时停止推断，将能力标为外部契约或不可核对。

## 结果边界

确定性 Fixture 主要用来验证 Harness 语义，真实模型与 Judge 则属于可选扩展。即使 GitHub Actions 成功，也只能说明该 commit 通过了仓库门禁，不能据此认定 PDF 之外的外部服务、生产环境或任意部署已经得到验证。

[上一节](glossary.md) · [下一节](source-and-license-boundaries.md)
