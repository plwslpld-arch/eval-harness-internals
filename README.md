<div align="center">
  <img src="docs/assets/brand/lockup-light.svg" alt="Eval Harness 源码内核" width="760">
  <p><strong>从一个样本到一次发布决定，读懂评测系统如何运行。</strong></p>
  <p>
    <a href="https://plwslpld-arch.github.io/eval-harness-internals/">在线阅读</a> ·
    <a href="docs/00-start-here.md">开始学习</a> ·
    <a href="docs/contents.md">完整目录</a> ·
    <a href="https://plwslpld-arch.github.io/eval-harness-internals/downloads/eval-harness-internals-cn.pdf">下载完整中文 PDF</a>
  </p>
</div>

## 这是什么

Eval Harness 源码内核是一套面向开发者的中文源码教材，也包含一个不需要模型凭据和容器即可运行的 Python Reference Harness。它不止介绍怎样调用评测 API，而是沿真实开源项目的锁定源码解释：

- Dataset 怎样物化为预声明 Trial；
- Attempt 恢复为什么不能改变统计分母；
- Trace 与 Artifact 怎样成为可评分 Observation；
- Scorer、Judge、Score 与 Metric 各自对什么负责；
- Candidate 与 Baseline 的差异怎样表达不确定性；
- Gate 凭什么通过、失败、阻断或无法判断。

## 它与 Agent Harness 源码内核有什么区别

| 问题 | Agent Harness 源码内核 | 本仓库：Eval Harness 源码内核 |
| --- | --- | --- |
| 核心决定 | 一次 Agent 任务下一步怎样执行 | 一组实验能支持什么质量结论 |
| 主要对象 | 上下文、Agent Loop、工具、权限、Session | Task、Dataset、Trial、Attempt、Scorer、Metric、Gate |
| Trace 的角色 | 记录模型、工具和状态事件 | 作为待验证、打包与评分的证据 |
| 重试关注 | Agent 策略与会话恢复 | 基础设施恢复不能改变统计对象 |
| 最终输出 | 回答、补丁、工具副作用、环境终态 | Score、比较、不确定性、Gate 与报告 |

两者通过 Target Adapter 连接。Claude、Codex、Gemini、DeepSeek Harness、pi、OpenCode、普通模型 API 或 RAG 服务都可以作为被测 Target；本仓库研究的是如何冻结其身份、创建等价 Trial、采集证据并公平比较，而不是重复讲这些 Agent Harness 内部的 Agent Loop。

```text
被测系统：上下文 → Agent Loop → 工具与环境 → Trace / Diff / 终态
                                           │
                                     Target Adapter
                                           ▼
评测系统：EvalSpec → Trial → Attempt → Observation → Score → Metric → Gate
```

## 内容地图

| 模块 | 内容 | 适合解决的问题 |
| --- | --- | --- |
| [基础篇](docs/foundations/01-agent-vs-eval-harness.md) | 7 篇共同语言课程 | 第一次系统理解 Eval Harness |
| [源码课程](docs/harnesses/lm-evaluation-harness/README.md) | 六条开源实现调用链 | 读懂真实项目怎样组织任务、运行和评分 |
| [工程篇](docs/engineering/01-minimal-eval-loop.md) | 8 篇实现专题 | 设计身份、恢复、Judge、统计、环境和 Gate |
| [横向比较](docs/comparisons/01-task-dataset-target.md) | 8 篇统一抽象比较 | 避免把不同工具的同名字段误认为等价 |
| [案例](docs/cases/shipping-boundary.md) | 4 个完整业务案例与 SWE-bench 机制案例 | 从需求、失败到门禁建立端到端认识 |
| [实验](docs/labs/01-run-one-deterministic-eval.md) | 6 个可运行 Lab | 亲手运行、扩展和比较 Reference Harness |

六条主源码课程覆盖：

1. **lm-evaluation-harness**：Task、Instance、模型请求与聚合；
2. **Inspect AI**：Task、Solver、Sandbox、Scorer 与 EvalLog；
3. **OpenAI Evals**：Registry、EvalSpec、CompletionFn 与 Recorder；
4. **Promptfoo**：配置矩阵、Provider、Assertion 与 CI；
5. **DeepEval**：Golden、TestCase、Metric 与执行策略；
6. **Harbor 与 Terminal-Bench 1**：Job、Trial、Environment、Agent 与 Verifier。

SWE-bench 放在环境型[机制案例](docs/cases/swe-bench-mechanism.md)中；LangSmith、Phoenix、MLflow 与 Braintrust 放在[平台适配器边界](docs/comparisons/08-platform-adapters.md)中。这样既覆盖重要生态，又不把不同深度的研究对象混成一张工具清单。

## 先跑一次完整评测

需要 Python 3.12 和 [`uv`](https://docs.astral.sh/uv/)：

```bash
uv sync --frozen
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/shipping
uv run eval-harness-ref inspect output/shipping
uv run eval-harness-ref compare output/shipping --candidate-target fixed --baseline-target buggy
uv run eval-harness-ref gate output/shipping
```

这个例子比较两个运费函数。订单金额恰好为 100 元时，buggy 版本错误收费，fixed 版本正确免运费。运行会产生 Trial、Attempt、Trace、内容摘要 Artifact、Observation、Score、Metric、Comparison、Gate，以及 JSON、Markdown 和 HTML 报告。

## Reference Harness 目录

```text
src/eval_harness_reference/
├── models/       # EvalSpec、Trial、Attempt、Trace、Score、Metric、Gate
├── targets/      # 函数、子进程与 Agent Trace Target
├── runtime/      # 计划、执行、证据和内容寻址 Artifact
├── scoring/      # 规则 Scorer 与可选离线 Judge 接口
├── statistics/   # 聚合、比较与不确定性
├── gates/        # 多规则质量门禁
├── reporting/    # JSON、Markdown 与 HTML 报告
└── cli.py        # run、inspect、score、compare、gate
```

它刻意保持最小：足够展示合同和失败语义，但不声称复刻任何上游项目，也不提供执行不受信任代码所需的安全沙箱。

## 建议阅读顺序

1. 从[学习入口](docs/00-start-here.md)理解贯穿案例和阅读约定；
2. 按顺序完成七篇[基础课](docs/foundations/01-agent-vs-eval-harness.md)；
3. 运行 Reference Harness，对照生成的证据目录；
4. 选择一条上游源码课程，沿永久链接跟读；
5. 用[横向比较](docs/comparisons/01-task-dataset-target.md)建立可迁移抽象；
6. 完成案例与 Lab，设计自己的 Dataset、Scorer 和 Gate。

也可以直接使用[按角色划分的学习路线](docs/learning-paths.md)。

## 来源、验证与许可证

源码课程只引用 `sources/sources.lock.yml` 固定的上游提交。每篇核心课区分“源码事实”“机制解释”“教学简化”“外部契约”和“不可核对”，避免把教学推导冒充上游保证。

```bash
uv run pytest -q
uv run python scripts/repository_quality.py
uv run python scripts/sources.py verify
uv run mkdocs build --strict
uv build
```

仓库检查与证据能支持什么、不能支持什么，集中说明在[验证与证据边界](docs/appendices/verification.md)。第三方来源和许可证见 [THIRD_PARTY.md](THIRD_PARTY.md)。原创代码采用 [MIT](LICENSE)，原创文档与图示采用 [CC BY 4.0](LICENSE-DOCS)。
