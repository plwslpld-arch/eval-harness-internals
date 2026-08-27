# 01｜Agent Harness 与 Eval Harness：先分清「执行」与「评测」

[上一章](../00-start-here.md) · [下一章](02-task-dataset-target-environment.md)

## 本篇要解决什么问题

Agent 和评测系统都会调用模型、执行工具，也都会保存 Trace，所以只看表面动作，很容易把它们当成同一种 Harness。要分清两者，就看各自负责做什么决定：Agent Harness 要把一项用户任务推进到可以结束，Eval Harness 则按同一套规则比较多次被测行为，再根据证据判断质量。

两边一旦混在一起，评测层就可能替被测 Agent 改提示、补工具结果，甚至让已经答错的任务再答一次。这样算出的分数反映了两个系统联手后的结果，已经不是 Agent 原本交出的答案。反过来，如果只留下 Agent 的最终回答，却没冻结 Dataset、Target 身份和评分策略，你仍然回答不了「这个版本在这组任务上是否更好」。

## 学完你能解释什么

- 为什么 Agent Loop 的停止条件属于被测系统，而 Trial 的停止、取消和预算属于评测协议；
- 为什么 Trace 是两个仓库的接口，却不能因此把两套 Harness 合并；
- 为什么一个 Agent 自己声称「任务完成」只是观察值，不是独立 Score；
- 怎样判断一项能力应该写进 Agent Harness 课程还是 Eval Harness 课程。

## 贯穿案例

运费函数规定订单金额达到 100 元就免运费，旧实现却写成 `amount > 100`。Agent Harness 要管模型怎样读文件、改比较符、跑测试，以及什么时候停下来。Eval Harness 管的是另一组问题：它先冻结金额为 99、100、101 的三个样本，让 buggy 和 fixed 两个 Target 各跑一次，再保存输出、按同一规则评分并形成 Gate。前者解释修复过程，后者回答我们凭什么相信边界行为确实改善了。

## 核心概念与边界

**Agent Harness** 管理模型上下文、Agent Loop、工具暴露、权限、Session、压缩和恢复，所以它通常要判断「这次任务还能不能继续，什么时候可以结束」。**Eval Harness** 管理 EvaluationSpec（评测规格）、Dataset、Trial Plan、Target Adapter（被测对象适配器）、Observation、Scorer、Metric、比较和 Gate，但这些环节各有自己的状态：一次运行可以正常完成，评分却可能失败，即使一组评分全部通过，整体 Gate 仍可能因为缺少样本而无法判断。

Target Adapter 把两边明确隔开：它接收 Trial 和运行约束，调用被测系统，再把系统行为和可观察证据交回来。你可以用它接普通函数、RAG 服务、Coding Agent 或多智能体系统，却不能让它替这些系统重新做内部决策。Agent Harness 产出带有明确语义的 Trace，Eval Harness 则检查 Trace 是否完整、是否确实来自指定 Target，并决定哪些字段可以交给评分环节。

## 机制图

![Agent Harness 与 Eval Harness 责任边界](../assets/diagrams/foundations/01-boundary.svg)

## 调用链与状态变化

1. Eval Planner 依据冻结配置生成 Trial，把输入、Target 身份和重复序号固定下来。
2. Runner 把 Trial 交给 Target Adapter。此后，模型选择工具、Agent 是否继续、如何恢复 Session，均由被测 Agent Harness 负责。
3. Adapter 返回输出、Trace、Diff、日志或环境终态。Runner 只区分产品结果与基础设施故障，不替 Agent 改答案。
4. Eval Harness 把 canonical Attempt 的事件和 Artifact 组成 Observation Bundle。
5. 独立 Scorer 消费 Bundle，Metric 对预声明 Trial 集合聚合，Gate 再依据冻结阈值作决定。

你可以直接从 Reference Harness 的 [`run_evaluation`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/pipeline.py) 和 [`SubprocessTarget`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/targets/subprocess.py) 看出这条边界。

## 关键数据结构

| 对象 | 属于哪一侧 | 必须保留的信息 |
| --- | --- | --- |
| Agent Session | Agent Harness | 消息、工具状态、压缩与恢复点 |
| TargetSpec | Eval Harness | 被测适配器、版本与有效配置 |
| Trial | Eval Harness | Sample、Target、重复序号和稳定 ID |
| TraceEvent | 接口 | 因果父子关系、事件类型与可观察 payload |
| ObservationBundle | Eval Harness | canonical Attempt、Trace 与 Artifact 摘要 |

## 设计取舍

这里适合倒置依赖，让 Eval Harness 只认 Target Adapter 协议，不去绑定 Claude、Codex 或某个 RAG 框架的内部类。这样一来，同一份 Dataset 和同一个 Scorer 就能拿来比较不同系统，不过 Adapter 必须说清楚它能不能导出工具事件、重置环境，以及报告实际模型版本。做不到的能力就直接标成不可用。填一个假的空字段，只会把证据缺口藏起来。

Inspect AI 的锁定源码把通用评测入口放在 [`eval()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py#L118-L157) 和 [`eval_async()`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/eval.py#L413-L452)，再把 Task 的执行逻辑下沉到 `_eval/task`。这是**上游源码事实**。为了比较多套实现，本篇把这套分工归纳成两层责任，这属于**机制解释**，不要求各个项目使用相同的类名或目录结构。

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

打开 `output/shipping/report.json`，分别找出 buggy Target 跑到了什么状态、Score 怎样判、Gate 又怎样判。然后查看 `run.json`，确认错误答案没有触发第二个 Attempt。

## 预期输出与答案

你应该看到 6 个计划 Trial，因为 3 个样本分别交给 2 个 Target 后，正好组成六种配对。buggy 在金额 100 上答错了，但对应 Trial 仍是 `completed`，随后 Score 和 buggy Gate 才各自判为 `failed`。fixed 的三个 Score 都会通过，Gate 为 `passed`。这里要读成「运行已经完成，产品结果随后被独立判错」。如果写成「buggy 运行失败」，就把执行状态和质量结论混到了一起。

## 常见误解

「Agent 已经跑过测试，所以不需要外部 Scorer」这句话漏掉了几种情况：被测系统可能少跑了测试、改过测试，也可能读错输出。「Eval Harness 也有循环，所以它就是 Agent Harness」则把负责调度的循环当成了替 Agent 做决定的循环。日志再多也不等于 Trace 可信，因为一旦缺少身份、因果顺序和摘要约束，你拿到的只是更长的文本。

## 如何核对

先读 [`runner.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/runner.py)，看它怎样分开产品失败和基础设施异常，再读 [`pipeline.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/pipeline.py)，看 Bundle、Score、Metric 和 Gate 按什么顺序生成。核对上游实现时，可以从锁定的 Inspect AI 入口继续追到 [`_eval/task/run.py`](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/src/inspect_ai/_eval/task/run.py#L465-L504)，确认「公共 Eval 入口」和「Task 执行」确实由不同位置负责。

## 与其他 Harness 的关系

lm-evaluation-harness 主要围绕 Task、Model Adapter 和批量请求组织代码，Promptfoo 更强调 Provider、Test Case 与 Assertion，Harbor 则给 Agent 和环境的整个生命周期留出了更多位置。它们切分代码的方式各不相同，但你仍然可以沿着「被测执行、证据、评分、聚合」四个环节来比较。Agent Harness 仓库研究 Claude、Codex、Gemini、DeepSeek Harness、pi、OpenCode 等运行时内部怎样工作，本仓库关心的是如何把这些运行时当作 Target，公平地执行并评分。

## 本篇不能证明什么

分清这条边界，不能证明某个 Agent 已经安全，也不能证明某套 Eval Harness 已经可以用于生产。一次确定性示例更不能直接授权真实业务发布。它能做的是把每项职责摆清楚，并给出可核对的最小实现。真正落到实际系统时，你还要准备独立 Dataset、隔离环境，补上统计设计和风险门禁。

[上一章](../00-start-here.md) · [下一章](02-task-dataset-target-environment.md)
