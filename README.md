# Eval Harness 源码内核

> 从一个样本到一次发布决定，读懂评测系统如何运行。

这是一套面向开发者的中文 Eval Harness 源码教材，也包含一个可以离线运行的最小 Reference Harness。它不只告诉你“如何调用评测 API”，而是沿真实源码和确定性实验解释：任务怎样被物化为 Trial，运行证据怎样进入 Scorer，分数怎样形成统计估计，以及 Gate 凭什么通过、失败、阻断或无法判断。

[开始学习](docs/00-start-here.md) · [完整目录](docs/README.md) · [选择学习路线](docs/learning-paths.md) · [第三方来源](THIRD_PARTY.md)

## 先用五分钟分清两个 Harness

| 问题 | Agent Harness 源码内核 | 本仓库：Eval Harness 源码内核 |
| --- | --- | --- |
| 核心决定 | 一次 Agent 任务下一步怎样执行 | 一组实验能支持什么质量结论 |
| 主要对象 | 上下文、Agent Loop、工具、权限、Session | Task、Dataset、Trial、Attempt、Scorer、Metric、Gate |
| Trace 角色 | 生产模型、工具与状态事件 | 验证、打包并消费为评分证据 |
| 重试关注 | Agent 自身策略与会话恢复 | 基础设施恢复不能改变统计分母 |
| 最终输出 | 回答、补丁、工具副作用、环境终态 | Score、比较、不确定性、Gate 与报告 |

两者通过 Target Adapter 连接。Claude、Codex、Gemini、DeepSeek Harness、pi、OpenCode 或任意 RAG 服务都可以作为被测 Target；本仓库不重复讲它们内部的 Agent Loop，而是研究怎样冻结身份、创建等价 Trial、采集证据并公平比较。

```text
被测系统：上下文 → Agent Loop → 工具与环境 → Trace / Diff / 终态
                                           │
                                     Target Adapter
                                           ▼
评测系统：EvalSpec → Trial → Attempt → Observation → Score → Metric → Gate
```

## 你会在这里学到什么

- 一套共同语言：Task、Dataset、Target、Environment、Sample、Trial、Attempt、Trace、Artifact、Observation、Scorer、Metric 和 Gate；
- 六条源码课程：lm-evaluation-harness、Inspect AI、OpenAI Evals、Promptfoo、DeepEval、Harbor 与 Terminal-Bench；
- 一个可运行参考实现：Python 3.12、确定性 Target、本地子进程、证据血缘、规则评分、统计聚合、门禁与离线报告；
- 一组横向比较：同名对象如何对应、哪些能力只是部分支持、哪些根本不可等价；
- 一条完整改进链：`Evaluator → RewardAdapter → DPO/GRPO/RFT → independent release eval`。

源码课程只使用锁定 commit 的永久链接。每篇核心课都要给出调用链、关键数据结构、失败语义、设计取舍、可运行实验、预期输出和参考答案，而不是几段概念摘要。

## 先跑一次完整评测

需要 Python 3.12。安装依赖后，从仓库根目录执行：

```bash
uv sync --frozen
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/shipping
uv run eval-harness-ref inspect output/shipping
uv run eval-harness-ref score output/shipping
uv run eval-harness-ref gate output/shipping
```

这个例子比较两个运费函数。订单金额恰好为 100 元时，buggy 版本错误收费，fixed 版本正确免运费。运行会产生 Trial、Attempt、Trace、内容摘要 Artifact、Observation Bundle、Score、Metric、Gate，以及 JSON、Markdown 和 HTML 报告。它不访问模型 API，也不需要容器。

## 建议学习顺序

1. 从[学习入口](docs/00-start-here.md)理解贯穿案例和阅读方法；
2. 完成[基础篇](docs/foundations/01-agent-vs-eval-harness.md)，先建立共同对象和状态语义；
3. 对照 Reference Harness 的代码与实验，把抽象概念变成真实文件；
4. 进入六条上游源码课程，沿锁定调用链比较不同实现；
5. 用案例和 Lab 设计自己的 Dataset、Scorer、统计比较与发布 Gate。

如果你已经在做评测工程，可以从[学习路线](docs/learning-paths.md)选择“源码阅读”“Agent 评测”或“Eval-to-RL”路径。

## Reference Harness 的证据合同

- Trial 是统计对象；Attempt 是基础设施恢复对象；
- 产品失败不能通过增加 Attempt 重试成成功；
- 一个 Trial 最多有一个 canonical Attempt；
- Score 必须绑定 canonical Attempt、Observation Bundle 和 Scorer 身份；
- Metric 分母来自预声明 Trial Plan，不来自成功 Attempt 数；
- invalid、unscorable 或 uncertain 的关键证据不能被 Gate 改写为 passed。

报告可回放评分与门禁，但不会捕获隐藏思维链，也不会把被测系统自述当成独立环境事实。

## 来源与许可证

上游研究对象、锁定 commit、研究路径和许可证见 [`sources/sources.yml`](sources/sources.yml)、[`sources/sources.lock.yml`](sources/sources.lock.yml) 与[第三方来源说明](THIRD_PARTY.md)。上游源码不复制进本仓库；项目名称仅用于识别研究对象，不表示官方认可。

原创代码采用 MIT License；原创文档采用 CC BY 4.0。上游源码、名称和商标继续受各自许可证与规则约束。

## 结论边界

仓库的测试、课程和确定性示例通过，只能说明这些教学材料与参考实现满足自身声明的合同。它不能证明任何上游工具生产就绪，不能替代真实业务的 Dataset 有效性审查，也不构成某个 AI 系统的生产发布授权。
