# 横向比较一：Task、Dataset 与 Target 怎样对齐

[上一节](../harnesses/harbor-terminal-bench/03-verifier-reward-results.md) · [下一节](02-runner-concurrency-cache-retry.md)

## 本篇要解决什么问题

六套 Harness 都会谈「任务、数据、模型」，可它们用同一个名字指向的对象并不一样：lm-evaluation-harness 让 Task 同时处理文档、请求和 metric，Inspect Task 把 dataset、solver、scorer 与 sandbox 组在一起，OpenAI Evals 从 Registry（注册表）里找到 EvalSpec 并据此建出 Eval，Promptfoo 则从 config 展开 prompt、provider 和 test。DeepEval 可以直接接收已经跑完的 TestCase，Harbor Task 还会带上环境和 verifier，这也说明只看 API 名字，你很容易把这些东西认成同一种结构，所以这一篇要把各家实际承担的动作拆出来，再放到同一套坐标里比较。

## 核心机制

![Task、Dataset 与 Target 的统一坐标](../assets/diagrams/foundations/02-eval-spec-flow.svg)

在这套统一定义里，TaskSpec 说清楚要测什么、允许做什么，Dataset 保存一组带版本的 Sample，Target 划出系统接受评测的范围，Environment 交代它在什么条件下运行，Scorer（评分器）则单独判断结果。上游项目可以把几个对象合在一起，不过你在比较能力之前，得先看清每个对象究竟做了哪些事，不必为了叫法一致去改造它们的 API。

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

每次运行至少要记下 Sample ID、Dataset version、Target resolved identity 和 Scorer identity，因为两个运行即使使用同一个 Task 名称，也可能取了不同的 Dataset，而同名 Provider 也可能连到不同的模型版本。TestCase 带着 actual_output，只能说明输出已经存在，不能说明 Harness 亲自执行过 Target，所以每个 Adapter（适配器）都要列明自己能拿到哪些身份字段，拿不到的就标成 partial/unavailable。

## 动手实验

选择 shipping 的金额 100 样本，分别写成 lm-eval doc、Inspect Sample、Promptfoo test、DeepEval LLMTestCase 和 Harbor Task 的伪结构。

```text
统一坐标：sample_id=amount-100, input.amount=100,
target=buggy, expected.fee=0, scorer=shipping-fee:v1
```

写完这些伪结构后，你还要逐个判断 output 是在执行前就已存在，还是运行后才产生，并找出究竟由哪一层调用 Target。

## 预期输出与答案

lm-eval、Inspect 与 Promptfoo 通常让 Harness 调用模型或 Provider，DeepEval 的 LLMTestCase 模式却直接接收已有的 actual_output，只有 agentic iterator 才会把执行过程收进评测。Harbor 则会在容器里真正运行 Agent。名称可以照着上游写，但统一报告里必须分开保存 SampleSpec、Target identity、Observation 和 Score，不能因为它们在某个项目里挤在同一个对象中就混为一项。

## 如何核对

回到六条源码课程的第一篇，从各自的运行入口往下查，看代码怎样建出这些对象，然后运行下面的测试，确认统一规划器没有悄悄抹平边界：

```bash
uv run pytest tests/test_planner.py tests/test_models.py -q
```

## 本篇不能证明什么

能把对象放进统一坐标，只说明我们已经找到了可以对照的职责，不代表各套工具具备同等能力。字段叫 sandbox，不能证明隔离强度相同，对象叫 Task，也不能证明代码已经分别冻结数据版本、Target 与 Scorer。

[上一节](../harnesses/harbor-terminal-bench/03-verifier-reward-results.md) · [下一节](02-runner-concurrency-cache-retry.md)
