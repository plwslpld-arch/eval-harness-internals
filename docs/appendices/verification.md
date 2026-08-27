# 怎样验证本仓库

[上一节](glossary.md) · [下一节](source-and-license-boundaries.md)

本仓库通过检查，只能说明原创教材、Reference Harness、锁定源码链接和确定性 Fixture（测试夹具）符合各自声明的合同。它不能证明上游工具已经可以投入生产，也不能替某个 AI 系统作出发布决定，更不能拿来认证个人能力。

## 本地检查

请从仓库根目录运行下面这组检查，等所有命令都完成以后，才能确认代码和教材符合约定、来源仍锁定在指定版本，构建产物也确实生成成功。

```bash
uv sync --frozen
uv run pytest -q
uv run python scripts/repository_quality.py
uv run python scripts/sources.py verify
uv run mkdocs build --strict
uv build
```

这一步只检查仓库自身。

如果你还想看核心案例怎样写下运行记录、冻结证据，再拿两个 Target 作比较，可以继续运行下面的命令。

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/shipping
uv run eval-harness-ref inspect output/shipping
uv run eval-harness-ref compare output/shipping --candidate-target fixed --baseline-target buggy
```

跑出的证据会留在输出目录。

这组测试会检查对象不变量、Trial/Attempt、基础设施 retry、Artifact 摘要与路径、Trace 因果关系、Scorer/Metric/Gate、Bootstrap、CLI、四个案例、课程结构和永久源码链接。到了最终发布流程，系统还会构建 MkDocs 与完整的中文 PDF，再逐页渲染，看看页面布局和中文字体有没有问题。

## 怎样独立核对源码结论

1. 在 `sources/sources.lock.yml` 找课程对应 commit 与 scope；
2. 用正文永久链接打开锁定文件，不使用 main 分支当前内容；
3. 从入口沿文中调用链逐站核对调用者、输入、状态改变和返回值；
4. 对「机制解释」至少找两个互相支撑的调用点；
5. 公开源码不足时停止推断，将能力标为外部契约或不可核对。

## 结果边界

确定性 Fixture 主要检查 Harness 的语义是否符合约定，真实模型和 Judge（裁判模型）则是可选的扩展。即使 GitHub Actions 全部成功，也只能说明这个 commit 通过了仓库门禁，你不能据此认定外部服务、生产环境或某次部署已经验证完毕，因为这些对象都不在 PDF 和本仓库检查所覆盖的范围内。

[上一节](glossary.md) · [下一节](source-and-license-boundaries.md)
