# DeepEval 数据对象：Golden 何时变成 LLMTestCase

[上一节](README.md) · [下一节](02-metric-execution.md)

## 本篇要解决什么问题

评测数据很容易把「给模型的输入」「参考答案」「模型实际输出」和「运行时检索证据」塞进同一个模糊的 JSON 对象，而 DeepEval 把 Dataset、Golden 和 LLMTestCase 分开，正好让我们沿着数据的变化看清这些阶段——下文会解释 Dataset 怎样维护单轮或多轮的一致性与数据集身份，也会说明 Golden 为什么可以先于 Target 执行存在，以及 LLMTestCase 为何必须拿到 actual_output 才能交给大多数 Metric 测量。

这不是字段字典。我们会沿对象生命周期追问字段由谁写、何时冻结、怎样关联数据集，还会辨认哪些运行时观测不能回写成参考数据，最后再看 agentic iterator 如何在用户代码执行后补全 TestCase。

## 先建立源码地图

| 源码位置 | 责任 | 核对问题 |
| --- | --- | --- |
| [`deepeval/dataset/dataset.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/dataset/dataset.py) | EvaluationDataset、导入、身份与 iterator | 单轮/多轮、rank、alias/id 怎样维护 |
| [`deepeval/test_case/llm_test_case.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/test_case/llm_test_case.py) | LLMTestCase 与 ToolCall 等观测 | 可评分用例保存哪些运行事实 |
| [`deepeval/evaluate/execute/loop.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/execute/loop.py) | Golden 到 TestCase 的运行转换 | 用户代码和 trace 何时进入证据 |

## 完整调用链

![DeepEval 数据对象的生命周期](../../assets/diagrams/harnesses/deepeval/data-lifecycle.svg)

1. EvaluationDataset 创建后可接收 goldens 或 test_cases；构造器检查元素类型，并根据首个对象确定单轮或多轮数据集。
2. 加入对象时写入私有 `_dataset_alias`、`_dataset_id` 和 `_dataset_rank`。单轮数据集拒绝 ConversationalGolden/TestCase，多轮数据集拒绝单轮对象，防止执行器面对混合语义。
3. CSV/JSON 导入把列映射为 LLMTestCase 或 Golden 字段；导入只完成结构转换，不能证明来源、授权、去重或参考答案质量。
4. 直接 `evaluate(test_cases, metrics)` 时，actual_output 已由调用者提供，执行器只负责测量，不执行 Target。
5. agentic Dataset iterator 逐个 yield Golden，让用户代码处理输入并产生 trace；控制权返回后，执行循环取得当前 trace，从 Golden 和 span attributes 构造 LLMTestCase。
6. 新 TestCase 继承 dataset alias/id/rank，以便 TestResult 回连原样本；trace/span 上的 input、output、context、retrieval context、tools 等成为运行观测。
7. 若 span 声明指标却无法构造 LLMTestCase，执行器记录可解释错误，而不是用空字符串伪造正常评分输入。

## 关键数据结构

Dataset 是有身份的容器，却不是统计单位。Golden 保存的是待执行规格，因此可以带有 input、expected_output、context、additional_metadata 等字段，而 LLMTestCase 记录一次可测观察，核心内容是 input 与 actual_output。expected_output 为参考型指标提供答案，context 常表示预期可用的背景，retrieval_context 则保存系统实际检索到的内容，而 tools_called 与 expected_tools 进一步让工具使用也能被判分。私有 dataset rank 可以还原来源顺序，但位置会随着数据整理而变化，所以稳定身份最好另有 sample id 或内容摘要。

放进统一术语后，一个 Golden 可以映射为 SampleSpec，而一次 Target 执行会生成 Trial/Attempt 以及对应的 LLMTestCase 观测。DeepEval 的对象本身没有强制划分 Trial 和 Attempt，所以调用者一旦进行网络重试或重新生成，就应在外部保留每次尝试的记录，否则最终写入的 actual_output 会覆盖过程，让人误以为它是唯一历史。

## 实现取舍与失败语义

直接 TestCase 模式把 Target 与 Eval 解耦，因而很适合离线导入日志，但 Harness 也就无法独立证明 output 是怎样产生的。agentic iterator 会把执行过程纳入会话，使证据衔接得更完整，不过它依赖全局 trace/session 管理，也要求用户正确埋点。Dataset 强制单轮与多轮保持一致，可以让结构错误尽早暴露——却不会替你检查语义重复、数据泄漏或时间切分。

空数据集、错误对象类型和单轮多轮混用都属于输入合同错误，应该在运行前失败，而用户代码异常属于 Target 或场景执行错误。若 trace 因缺少字段而无法构造 TestCase，问题落在观察或适配层，只有 Metric 得到合法测量后给出低分，才属于产品判据失败。四者不能合并成同一个失败率。

## 动手实验

选择一个「根据知识库回答退款问题」的样本，先写出 Golden 与执行后 LLMTestCase 的最小 JSON 形状，再把预先给定的政策放进 context，把系统实际检索片段放进 retrieval_context，并解释二者为何不同。随后模拟两次网络 Attempt，第一次超时而第二次成功，并指出除了 DeepEval TestCase 以外还要保存哪些 attempt 元数据。最后补出 Dataset 版本清单所需的来源、许可证、内容摘要与切分信息。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

Golden 至少要包含 input 和 expected_output/expected context，而执行完成后的 TestCase 还会增加 actual_output、retrieval_context、tools_called 与运行 metadata。context 表示评测规格提供或期望使用的背景，retrieval_context 则来自被测系统的真实观测，一旦混用，检索指标就失去了要比较的对象。两次 Attempt 都应保存 attempt_id、开始结束时间、错误、重试原因与输入摘要，并明确第二次结果成为 canonical 的规则。

Dataset 版本还要记录生成或采集来源、授权、去重、污染检查、时间戳、分区策略和摘要。能序列化，只是起点。

## 如何核对

先在 [`deepeval/dataset/dataset.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/dataset/dataset.py#L91-L130) 阅读 `EvaluationDataset` 的构造过程、goldens/test_cases setter 与 add 方法，并定位 agentic `evaluate` iterator，然后到 [`deepeval/evaluate/execute/loop.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/execute/loop.py#L167-L206) 核对 Golden 转成 LLMTestCase 的具体过程。

## 本篇不能证明什么

Dataset alias、云端 ID、rank 或一次成功导入，都不能证明样本唯一、没有泄漏、能够代表真实用户，或具备合法公开的条件。即使 LLMTestCase 字段齐全，也无法证明 actual_output 来自声明的模型，还需要独立的运行清单与证据摘要。

[上一节](README.md) · [下一节](02-metric-execution.md)
