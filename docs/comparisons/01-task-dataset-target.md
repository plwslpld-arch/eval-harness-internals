# 横向比较一：Task、Dataset 与 Target 怎样对齐

[上一节](../harnesses/harbor-terminal-bench/03-verifier-reward-results.md) · [下一节](02-runner-concurrency-cache-retry.md)

## 本篇要解决什么问题

六套 Harness 都会谈到“任务、数据、模型”，可是这些相同名词背后的对象边界并不相同：lm-evaluation-harness 的 Task 同时知道文档、请求和 metric，Inspect Task 把 dataset、solver、scorer 与 sandbox 组合起来，OpenAI Evals 通过 Registry 中的 EvalSpec 实例化 Eval，而 Promptfoo 会从 config 展开 prompt/provider/test。DeepEval 可以直接接收已经执行完的 TestCase，Harbor Task 则连环境与 verifier 一并携带。只盯着 API 名字看，很容易把它们错当成同一种结构——本篇要做的，就是把这些职责放回同一套坐标里比较。

## 核心机制

![Task、Dataset 与 Target 的统一坐标](../assets/diagrams/foundations/02-eval-spec-flow.svg)

在这套统一定义里，TaskSpec 说明要测什么以及允许什么，Dataset 保存带版本的 Sample 集合，Target 圈定被测系统的边界，Environment 描述执行条件，而 Scorer 负责独立判断。上游项目完全可以把其中几个对象合在一起，但比较能力之前必须先把职责映射出来，并不需要为了统一术语去改造它们的 API。

| Harness | Task/Dataset 入口 | Target 边界 | 主要特点 |
| --- | --- | --- | --- |
| lm-evaluation-harness | Task/ConfigurableTask + docs | LM request methods | benchmark 模板与请求紧密耦合 |
| Inspect AI | Task(dataset, solver, scorer, sandbox) | Model/Solver 完整行为 | 通用、安全与 Agent Eval |
| OpenAI Evals | Registry EvalSpec + samples_jsonl | CompletionFn/Solver | 配置键与类实例化 |
| Promptfoo | TestSuite/tests/scenarios | ApiProvider + prompt | 配置矩阵与应用断言 |
| DeepEval | EvaluationDataset/Golden/TestCase | 外部应用或 agentic iterator | 测试框架式输入 |
| Harbor/TB | Dataset Task files | Agent + container environment | 终端副作用与隐藏 verifier |

## 完整流程

1. 先找实际 Sample 身份从哪里产生，而不是先找名为 Dataset 的类。
2. 标注 Target 是否由 Harness 执行：DeepEval 直接 TestCase 模式只评分已有输出，Harbor 则执行完整 Agent。
3. 查 Task 是否同时包含 Scorer/Metric。若包含，运行身份仍需把数据、目标和评分版本分别保存。
4. 查 Environment 是否显式。模型 benchmark 往往只有调用环境，Agent 任务需要容器终态。
5. 把配置解析后的实际对象写入统一清单，再决定能否比较两个运行。

## 关键数据与不变量

一次运行至少要保存 Sample ID、Dataset version、Target resolved identity 和 Scorer identity 这四项，因为相同的 Task 名称未必指向相同 Dataset，相同的 Provider 名称也未必对应同一模型版本。即便 TestCase 已经带有 actual_output，也不能由此断定 Harness 曾经执行过 Target，所以每个 Adapter 都必须说明自己能提供哪些身份字段，并把缺失项明确标成 partial/unavailable。

## 动手实验

选择 shipping 的金额 100 样本，分别写成 lm-eval doc、Inspect Sample、Promptfoo test、DeepEval LLMTestCase 和 Harbor Task 的伪结构。

```text
统一坐标：sample_id=amount-100, input.amount=100,
target=buggy, expected.fee=0, scorer=shipping-fee:v1
```

写完这些伪结构后，再逐一指出 output 究竟在执行前还是执行后出现，以及哪一层真正负责调用 Target。

## 预期输出与答案

lm-eval、Inspect 与 Promptfoo 通常由 Harness 调用模型或 Provider，而 DeepEval 的 LLMTestCase 模式接收的是已有 actual_output，只有 agentic iterator 才会把执行过程纳入评测。Harbor 会在容器里实际运行 Agent。名称可以沿用上游习惯，但统一报告必须把 SampleSpec、Target identity、Observation 和 Score 分开保存。

## 如何核对

回到六条源码课程的第一篇，沿着各自的运行入口核对对象如何构造，然后再运行下面的测试，确认统一规划器没有悄悄抹平这些边界：

```bash
uv run pytest tests/test_planner.py tests/test_models.py -q
```

## 本篇不能证明什么

对象能够映射到统一坐标，只说明我们找到了可比较的职责，并不代表各套工具已经具备同等能力。字段名叫 sandbox 不能证明隔离强度相同，对象名叫 Task 也不能证明数据版本、Target 与 Scorer 已经分别冻结。

[上一节](../harnesses/harbor-terminal-bench/03-verifier-reward-results.md) · [下一节](02-runner-concurrency-cache-retry.md)
