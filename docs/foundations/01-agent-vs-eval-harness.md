# 01｜Agent Harness 与 Eval Harness：先分清“执行”与“评测”

[上一章](../00-start-here.md) · [下一章](02-task-dataset-target-environment.md)

## 本篇要解决什么问题

看到 Agent 调用模型、执行工具、保存 Trace，再看到评测系统也读取 Trace、设置超时和报告成功率，新人很容易把两者理解成同一个 Harness。真正的分界不在“是否调用模型”，而在它为哪一种决定负责：Agent Harness 要完成一次用户任务；Eval Harness 要让许多次被测行为在相同规则下可比较，并把证据转成质量结论。

如果边界不清，评测层会悄悄替被测 Agent 重写提示、补工具结果或重试错误答案，最终测到的是评测器与 Agent 的混合系统；反过来，只保存 Agent 的最终回答而不冻结 Dataset、Target 身份和评分策略，又无法回答“这个版本在这组任务上是否更好”。

## 学完你能解释什么

- 为什么 Agent Loop 的停止条件属于被测系统，而 Trial 的停止、取消和预算属于评测协议；
- 为什么 Trace 是两个仓库的接口，却不能因此把两套 Harness 合并；
- 为什么一个 Agent 自己声称“任务完成”只是观察值，不是独立 Score；
- 怎样判断一项能力应该写进 Agent Harness 课程还是 Eval Harness 课程。

## 贯穿案例

运费函数规定订单金额达到 100 元免运费，旧实现却写成 `amount > 100`。Agent Harness 的视角是：模型怎样读文件、修改比较符、运行测试并停止。Eval Harness 的视角是：怎样冻结金额 99、100、101 三个样本，让 buggy 与 fixed 两个 Target 各运行一次，保存输出，再用同一个规则评分并形成 Gate。前者解释一次修复如何发生；后者解释我们凭什么相信修复改善了边界行为。

## 核心概念与边界

**Agent Harness** 管理模型上下文、Agent Loop、工具暴露、权限、Session、压缩和恢复，它的成功语义通常与“这一次任务能否继续或结束”有关；**Eval Harness** 管理 EvaluationSpec、Dataset、Trial Plan、Target Adapter、Observation、Scorer、Metric、比较和 Gate，它的成功语义分层存在：运行可能完成但评分失败，评分可能通过但整体 Gate 因缺失样本而无法判断。

Target Adapter 是明确接口：它接收 Trial 与运行约束，返回被测行为和可观察证据；它可以包住一个普通函数、RAG 服务、Coding Agent 或多智能体系统，却不应在适配层重新实现这些系统的内部决策。Agent Harness 生产 Trace 的语义——而 Eval Harness 检查 Trace 是否完整、是否属于正确 Target，并决定哪些字段进入评分。

## 机制图

![Agent Harness 与 Eval Harness 责任边界](../assets/diagrams/foundations/01-boundary.svg)

## 调用链与状态变化

1. Eval Planner 依据冻结配置生成 Trial，把输入、Target 身份和重复序号固定下来。
2. Runner 把 Trial 交给 Target Adapter。此后，模型选择工具、Agent 是否继续、如何恢复 Session，均由被测 Agent Harness 负责。
3. Adapter 返回输出、Trace、Diff、日志或环境终态。Runner 只区分产品结果与基础设施故障，不替 Agent 改答案。
4. Eval Harness 把 canonical Attempt 的事件和 Artifact 组成 Observation Bundle。
5. 独立 Scorer 消费 Bundle，Metric 对预声明 Trial 集合聚合，Gate 再依据冻结阈值作决定。

这条边界可以在 Reference Harness 的 [`run_evaluation`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/pipeline.py) 与 [`SubprocessTarget`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/targets/subprocess.py) 之间直接看到。

## 关键数据结构

| 对象 | 属于哪一侧 | 必须保留的信息 |
| --- | --- | --- |
| Agent Session | Agent Harness | 消息、工具状态、压缩与恢复点 |
| TargetSpec | Eval Harness | 被测适配器、版本与有效配置 |
| Trial | Eval Harness | Sample、Target、重复序号和稳定 ID |
| TraceEvent | 接口 | 因果父子关系、事件类型与可观察 payload |
| ObservationBundle | Eval Harness | canonical Attempt、Trace 与 Artifact 摘要 |

## 设计取舍

最干净的实现是依赖倒置：Eval Harness 只依赖 Target Adapter 协议，不依赖 Claude、Codex 或某个 RAG 框架的内部类——优点是同一 Dataset 和 Scorer 可以比较不同系统；代价是 Adapter 必须明确声明能力，例如能否导出工具事件、能否重置环境、能否报告实际模型版本。无法提供的能力应标为不可用，而不是伪造空字段。

Inspect AI 的锁定源码把通用评测入口放在 [`eval()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py#L118-L157) 与 [`eval_async()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py#L413-L452)，并把 Task 执行进一步下沉到 `_eval/task`。这是**上游源码事实**。本篇把它抽象成两层责任，是帮助比较多套实现的**机制解释**；不是说所有项目使用相同类名。

## 失败语义

- Agent 返回错误运费：Target 运行完成、Score 失败；不得换一个 Attempt 再答一次。
- 宿主进程启动失败：Attempt 为基础设施失败；在预算内可创建恢复 Attempt。
- Trace 缺关键终态：运行也许完成，但 Scorer 应返回 `unscorable` 或 `invalid`。
- Target 身份与计划不一致：Trial 证据无效，不能用看似正确的输出替代身份错误。
- 质量阈值未达到：Gate 失败；这不等于 Harness 崩溃。

## 动手实验

在仓库根目录运行：

```bash
eval-harness-ref run reference/examples/shipping/eval.yaml --output output/shipping
eval-harness-ref inspect output/shipping
```

打开 `output/shipping/report.json`，找出 buggy Target 的运行状态、Score 状态和 Gate 状态；再看 `run.json`，确认错误答案没有触发第二个 Attempt。

## 预期输出与答案

应看到 6 个计划 Trial：3 个样本乘 2 个 Target；buggy 在金额 100 上输出错误，但该 Trial 仍是 `completed`，对应 Score 为 `failed`，buggy Gate 为 `failed`；fixed 的三个 Score 均通过，Gate 为 `passed`。答案的关键不是“buggy 运行失败”，而是“运行完成且产品结果被独立判错”。

## 常见误解

“Agent 已运行测试，所以不需要外部 Scorer”忽略了被测系统可以漏测、修改测试或误读输出。“Eval Harness 也有循环，所以它就是 Agent Harness”混淆了调度循环和决策循环。“Trace 越多越可信”也不成立；没有身份、因果顺序和摘要约束的日志只是更多文本。

## 如何核对

先阅读 [`runner.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/runner.py) 中产品失败与基础设施异常的分支，再阅读 [`pipeline.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/pipeline.py) 中 Bundle、Score、Metric 和 Gate 的生成顺序。上游部分可从锁定的 Inspect AI 入口继续追到 [`_eval/task/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py)，核对“公共 Eval 入口”和“Task 执行”确实是不同责任站点。

## 与其他 Harness 的关系

lm-evaluation-harness 更突出 Task、Model Adapter 和批量请求；Promptfoo 更突出 Provider、Test Case 与 Assertion；Harbor 更突出 Agent 与环境生命周期。它们切分代码的位置不同，却都可以放回“被测执行—证据—评分—聚合”坐标系。Agent Harness 仓库研究 Claude、Codex、Gemini、DeepSeek Harness、pi、OpenCode 等运行时内部；本仓库只研究它们作为 Target 时怎样被公平执行和评分。

## 本篇不能证明什么

这条边界不能证明某个 Agent 安全、某套 Eval Harness 生产就绪，也不能把一次确定性示例扩大成真实业务发布授权。它只给出职责划分和可核对的最小实现，实际系统还需要独立 Dataset、环境隔离、统计设计和风险门禁。

[上一章](../00-start-here.md) · [下一章](02-task-dataset-target-environment.md)
