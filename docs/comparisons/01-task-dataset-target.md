# 横向比较一：Task、Dataset 与 Target 怎样对齐

[上一节](../harnesses/harbor-terminal-bench/03-verifier-reward-results.md) · [下一节](02-runner-concurrency-cache-retry.md)

## 本篇要解决什么问题

六套 Harness 都会出现“任务、数据、模型”之类名词，但对象边界不同。lm-evaluation-harness 的 Task 同时知道文档、请求和 metric；Inspect Task 把 dataset、solver、scorer 与 sandbox 组合；OpenAI Evals 用 Registry 的 EvalSpec 实例化 Eval；Promptfoo 从 config 展开 prompt/provider/test；DeepEval 可直接接收已执行 TestCase；Harbor Task 还携带环境与 verifier。若只比较 API 名字，新人会误以为它们同构。本篇用统一坐标拆开职责。

## 核心机制

![Task、Dataset 与 Target 的统一坐标](../assets/diagrams/foundations/02-eval-spec-flow.svg)

统一定义：TaskSpec 说明要测什么和允许什么；Dataset 是有版本的 Sample 集合；Target 是被测系统边界；Environment 是执行条件；Scorer 是独立判断。上游项目可以合并这些对象，但比较时先映射能力，不要求改造其 API。

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
3. 查 Task 是否同时包含 Scorer/Metric；若包含，运行身份仍需把数据、目标和评分版本分别保存。
4. 查 Environment 是否显式。模型 benchmark 往往只有调用环境，Agent 任务需要容器终态。
5. 把配置解析后的实际对象写入统一清单，再决定能否比较两个运行。

## 关键数据与不变量

Sample ID、Dataset version、Target resolved identity 和 Scorer identity 是最小四元组。Task 名称相同不代表 Dataset 内容相同；Provider 名称相同不代表模型版本相同；已包含 actual_output 的 TestCase 不能证明 Harness 执行过 Target。任何 Adapter 都必须声明它能提供哪些身份字段，缺失标 partial/unavailable。

## 动手实验

选择 shipping 的金额 100 样本，分别写成 lm-eval doc、Inspect Sample、Promptfoo test、DeepEval LLMTestCase 和 Harbor Task 的伪结构：

```text
统一坐标：sample_id=amount-100, input.amount=100,
target=buggy, expected.fee=0, scorer=shipping-fee:v1
```

指出每种结构中 output 在执行前还是执行后出现，以及谁负责调用 Target。

## 预期输出与答案

lm-eval/Inspect/Promptfoo 通常由 Harness 调用模型/Provider；DeepEval LLMTestCase 模式的 actual_output 已存在，agentic iterator 才把执行纳入；Harbor 在容器里运行 Agent。无论上游命名，统一报告都应分开 SampleSpec、Target identity、Observation 和 Score。

## 如何核对

回到六条源码课程的第一篇，沿各自入口核对对象构造。再运行：

```bash
uv run pytest tests/test_planner.py tests/test_models.py -q
```

## 本篇不能证明什么

对象能映射到统一坐标不表示能力等价。一个字段叫 sandbox 不证明隔离强度相同；一个对象叫 Task 也不证明数据版本、Target 与 Scorer 已独立冻结。

[上一节](../harnesses/harbor-terminal-bench/03-verifier-reward-results.md) · [下一节](02-runner-concurrency-cache-retry.md)
