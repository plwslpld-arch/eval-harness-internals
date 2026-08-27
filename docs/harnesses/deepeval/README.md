# DeepEval 源码课程：从测试用例到 MetricData 的评测生命周期

[上一节](../promptfoo/03-assertion-results-ci.md) · [下一节](01-dataset-golden-test-case.md)

## 本篇要解决什么问题

人们常把 DeepEval 说成「像 pytest 一样测试大模型应用」，可源码做的事远不止检查一次 `assert score >= threshold`。输入可以是已经带有 actual_output 的 `LLMTestCase`（大语言模型测试用例），也可以是等着用户代码去执行的 Golden（黄金样本），指标既能同步或异步运行，也能测单轮、对话或 trace。再加上缓存、忽略错误、并发和测试运行管理器，程序怎样执行、结果怎样记录都会跟着变化，所以这组课程会沿着调用链，看这些对象最后怎样组成 `TestResult`、`MetricData` 和一次 TestRun。

课程锁定版本为 `a2e0d4cfd3118352d321c1c84bdeba17d4a201bc`，DeepEval 还提供许多具体指标、追踪功能、平台集成和 Agentic 入口，这里只讲锁定源码里能够直接核对的执行骨架，再把各环节对应到统一的 Dataset → Sample → Target → Scorer → Result 模型。遇到 Golden、TestCase 与 Metric 时，正文仍沿用 DeepEval 自己的叫法。

## 先建立源码地图

| 站点 | 锁定文件 | 责任 |
| --- | --- | --- |
| 公开入口 | [`deepeval/evaluate/evaluate.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/evaluate.py) | `assert_test`、`evaluate`、配置与 TestRun 收尾 |
| 执行循环 | [`deepeval/evaluate/execute/loop.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/execute/loop.py) | 测试、trace、metric 的同步/异步执行与错误处理 |
| 指标基类 | [`deepeval/metrics/base_metric.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/metrics/base_metric.py) | score、threshold、success、reason 与测量接口 |
| 数据集 | [`deepeval/dataset/dataset.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/dataset/dataset.py) | Golden/TestCase 集合、身份和 agentic iterator |
| 单轮用例 | [`deepeval/test_case/llm_test_case.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/test_case/llm_test_case.py) | input、actual_output、expected_output、context、tools 等观测 |

## 完整调用链

![DeepEval 从数据对象到测试运行的主链](../../assets/diagrams/harnesses/deepeval/end-to-end.svg)

1. 调用者选择两种边界：把已执行结果封装成 `LLMTestCase` 交给 `evaluate`，或遍历 Dataset 的 Golden，在用户代码产生输出和 trace 后由 agentic loop 构造 TestCase。
2. `evaluate` 验证输入与 metrics，配置 AsyncConfig、DisplayConfig、CacheConfig、ErrorConfig，并重置或取得全局 TestRunManager。
3. 同步路径调用 `execute_test_cases`，异步路径通过事件循环调用 `a_execute_test_cases`；指标对象会按运行模式初始化并在每个测试上测量。
4. 指标的 `measure`/`a_measure` 写入 score、reason、error 等状态；基类 `is_successful` 按 threshold、strict_mode 和 error 得出成功语义。
5. 执行器把指标状态转换为 MetricData，附着到 TestResult/API test case，更新 TestRun。缓存可复用先前评分，ignore_errors 决定错误是终止还是保留为结果。
6. `evaluate` 输出控制台/文件报告，写入运行时长和超参数，保存临时 TestRun，并根据 CLI 与普通调用模式选择由谁完成 wrap-up。
7. `assert_test` 复用执行器，但在任何有阈值的指标失败或出错时抛出 AssertionError，适合测试框架门禁，不等同统计发布判定。

## 关键数据结构

`Golden` 更像一份等着执行的样本规格，它存着输入、期望和上下文，通常还没有被测应用生成的 actual_output。`LLMTestCase` 记录的则是一次可以评分的观测，里面会放 input、actual_output、expected_output、context、retrieval_context、tools_called、expected_tools、metadata 等内容，这两种对象不能互换。`BaseMetric` 是有状态的 Scorer，测量过后，score、threshold、reason、error、success、verbose_logs 和 evaluation_cost 都留在实例上，`MetricData` 再把这些状态写死到结果里，最后交给 `EvaluationResult` 汇总 TestResults、confident link 和 run identity。

一旦同时跑多个测试，同一个 Metric 实例怎样重置状态就很关键。把结果留在对象字段里，确实方便实现具体指标，可执行器每次测量前都得清掉 error 等旧值，还得防止不同协程互相覆盖。保存结果时也要留下 metric 名称、实现版本、模型版本、threshold、strict mode 和这次测量的输出，不能只留最后那个布尔值。

## 实现取舍与失败语义

用户可以直接提交 TestCase，于是 DeepEval 能拿任意外部系统的输出做评测，agentic iterator 还能把被测代码怎样运行一并记进 trace。两条路径留下的证据强弱不同：前一条要相信调用者填入的 actual_output，后一条虽然能关联运行 trace，仍然必须锁定用户代码和执行环境。

Metric 判定失败，说明测量已经有效完成，只是分数没有达到阈值，metric.error 则表示这次根本没拿到可信的测量结果。`ignore_errors=True` 可以让批量任务继续往下跑，但统计时不能让报错项悄悄消失，分母怎么算必须提前约定。缓存确实能少调几次 Judge，可 key 必须覆盖测试内容、指标配置、模型和依赖版本，否则你无法解释为什么会命中。异步并发能提高吞吐，也会逼着你处理好有状态 Metric、事件循环和全局 TestRun 管理之间的隔离。

## 动手实验

给问答系统设计一个 Golden 和相应的 LLMTestCase，分别填好 input、actual_output、expected_output、context 与 retrieval_context，并说明每个字段是谁写进去的。接着设计两个 Metric，一个检查确定性格式，另一个调用模型 Judge，再列出 score、threshold、reason、error 和 cost 应该怎样落盘。最后让 Judge 模拟超时，比较 `evaluate(..., ignore_errors=True)` 与 `assert_test` 各自在调用方看来会发生什么。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

Golden 里的 input、expected 和 context 由数据集预先定义，actual_output 要等 Target 跑完后写入，retrieval_context 记的则是系统这次真正检索到了什么，并非事先准备好的答案。格式 Metric 可以离线算出确定分数，Judge Metric 还得记下评分模型、prompt/config 和成本。开启忽略错误后，程序应该保留 error，再继续跑其他测试，`assert_test` 则应把 score、threshold、strict、error 和 reason 写进失败信息，然后抛出异常。

课程门禁不需要 API key，因为它只检查源码有没有锁定、教学结构是否完整，以及本仓库的离线实验能不能通过，并没有声称它真的运行过某个 DeepEval Judge。

## 如何核对

先到 [`deepeval/evaluate/evaluate.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/evaluate.py) 比较 `evaluate` 与 `assert_test` 分别做了什么，再进 [`deepeval/evaluate/execute/loop.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/execute/loop.py) 检查同步、异步和 agentic 三条路径怎样执行。最后对照 [`deepeval/metrics/base_metric.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/metrics/base_metric.py)，确认 success 到底按什么规则得出。

## 本篇不能证明什么

API 好用、指标设了阈值，或者 pytest 能在条件不满足时报错，都证明不了指标真的有效、Judge 没有偏差、数据集代表线上分布，或这次运行能够复现，更不能据此批准当前版本发布。它们只提供评测机制，不提供发布授权。

[上一节](../promptfoo/03-assertion-results-ci.md) · [下一节](01-dataset-golden-test-case.md)
