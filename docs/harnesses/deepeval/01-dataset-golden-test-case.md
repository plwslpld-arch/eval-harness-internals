# DeepEval 数据对象：Golden 何时变成 LLMTestCase

[上一节](README.md) · [下一节](02-metric-execution.md)

## 本篇要解决什么问题

评测数据常把「给模型的输入」「参考答案」「模型实际输出」和「运行时检索证据」全塞进一个含糊的 JSON 对象，DeepEval 却把 Dataset、Golden（黄金样本）和 LLMTestCase（大语言模型测试用例）分开了。你可以顺着数据往下看：Dataset 怎样保证单轮和多轮不混在一起，又怎样标记数据集，Golden 为什么在 Target 运行前就能存在，LLMTestCase 又为何要等 actual_output 写进来，才能交给大多数 Metric 测量。

这不是字段字典。你要跟着对象一路往下追，看每个字段由谁写入、到什么时候不能再改、又靠什么回连数据集，同时分清哪些运行时观测绝不能倒灌进参考数据，最后再看 agentic iterator 怎样等用户代码跑完后补齐 TestCase。

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

Dataset 是带身份的容器，却不是统计单位。Golden 记下的是待执行规格，所以可以带 input、expected_output、context、additional_metadata 等字段，LLMTestCase 则记下实际发生的一次观测，其中最要紧的是 input 和 actual_output。参考型指标从 expected_output 取答案，context 给出预期可用的背景，retrieval_context 保存系统这次真正检索到的内容，tools_called 和 expected_tools 还让你能判断工具用得对不对。私有 dataset rank 可以帮你还原原先的排列顺序，但整理数据时位置会变，要想稳稳认出同一个样本，最好另外保存 sample id 或内容摘要。

按统一术语来对应，一个 Golden 可以看作 SampleSpec，Target 每运行一次，就会产生 Trial/Attempt 和相应的 LLMTestCase 观测。DeepEval 自己没有强制把 Trial 与 Attempt 分开，因此调用者只要遇到网络重试或重新生成，就得在框架外逐次留档，否则最后写进去的 actual_output 会遮住中间过程，看起来像是从来只有这一个结果。

## 实现取舍与失败语义

直接提交 TestCase，可以把 Target 执行和 Eval 测量拆开，很适合离线导入日志，可 Harness 也就无法独自查明 output 到底怎么来的。agentic iterator 会把执行过程一并记进会话，前后证据接得更紧，不过它依赖全局 trace/session 管理，也要求用户把埋点写对。Dataset 会拦住单轮和多轮混用，让结构错误早点暴露，但它不会替你查语义重复、数据泄漏或时间切分。

空数据集、对象类型不对以及单轮多轮混用，都说明输入没有遵守合同，程序应该在运行前就报错。用户代码抛异常，则是 Target 或场景执行出了问题。若 trace 缺字段，执行器连 TestCase 都建不出来，问题就在观测或适配这一层。只有 Metric 拿到合法输入并完成测量后给出低分，才算产品没有通过判据。这四类失败不能混成一个失败率。

## 动手实验

选一个「根据知识库回答退款问题」的样本，先写出 Golden 和运行后 LLMTestCase 最小需要哪些 JSON 字段，再把预先给定的政策放进 context，把系统这次真正检索到的片段放进 retrieval_context，并解释这两份内容为什么不能混。随后模拟两次网络 Attempt，第一次超时、第二次成功，再指出除了 DeepEval TestCase 之外，每次尝试还要留下哪些元数据。最后补齐 Dataset 版本清单，写明来源、许可证、内容摘要和切分信息。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

Golden 至少要有 input 和 expected_output/expected context，系统跑完之后，TestCase 还要添上 actual_output、retrieval_context、tools_called 和运行 metadata。context 是评测规格给出的背景，或是规格要求系统使用的背景，retrieval_context 则是这次运行真正观察到的检索结果。两者一旦混在一起，检索指标就没了可以比较的两边。两次 Attempt 都要保存 attempt_id、起止时间、错误、重试原因和输入摘要，还要写清为什么第二次结果被选为 canonical。

Dataset 的每个版本还要写明数据从哪里生成或采集、拿到了什么授权、怎样去重和检查污染，并留下时间戳、分区策略与摘要。能序列化，只是起点。

## 如何核对

先看 [`deepeval/dataset/dataset.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/dataset/dataset.py#L91-L130)，弄清 `EvaluationDataset` 怎样构造对象，goldens/test_cases setter 与 add 方法怎样收进数据，再找到 agentic `evaluate` iterator。然后去 [`deepeval/evaluate/execute/loop.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/execute/loop.py#L167-L206)，核对执行器究竟怎样把 Golden 变成 LLMTestCase。

## 本篇不能证明什么

Dataset alias、云端 ID、rank 或一次成功导入，都证明不了样本是否唯一、是否泄漏、能否代表真实用户，也证明不了它可以合法公开。即便 LLMTestCase 的字段一个不少，你仍然无法确认 actual_output 真由声明的模型生成，还得另存运行清单和证据摘要。

[上一节](README.md) · [下一节](02-metric-execution.md)
