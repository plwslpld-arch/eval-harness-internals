# DeepEval 源码课程：从测试用例到 MetricData 的评测生命周期

[上一节](../promptfoo/03-assertion-results-ci.md) · [下一节](01-dataset-golden-test-case.md)

## 本篇要解决什么问题

DeepEval 经常被介绍成「像 pytest 一样测试大模型应用」，但源码里的核心远不止一个 `assert score >= threshold`——输入可能是已经包含 actual_output 的 `LLMTestCase`，也可能是等待用户代码执行的 Golden，而指标既可以同步或异步运行，也可以面向单轮、对话或 trace。再把缓存、忽略错误、并发和测试运行管理器放进来，执行方式与记录方式都会随之变化，所以本课程会追踪这些对象怎样汇合成 `TestResult`、`MetricData` 与一次 TestRun。

课程锁定版本为 `a2e0d4cfd3118352d321c1c84bdeba17d4a201bc`。DeepEval 项目还包含大量具体指标、追踪、平台集成和 Agentic 入口，这里只解释锁定范围内能够直接核对的执行骨架，并把它映射到统一的 Dataset → Sample → Target → Scorer → Result 模型，同时保留 DeepEval 自己使用的 Golden、TestCase 与 Metric 命名。

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

`Golden` 更接近等待执行的样本，它保存输入、期望与上下文，但通常没有被测应用产生的 actual_output。`LLMTestCase` 则是一条可评分观测，其中包含 input、actual_output、expected_output、context、retrieval_context、tools_called、expected_tools、metadata 等内容。两者不能互换。`BaseMetric` 是有状态的 Scorer 实例，测量后会持有 score、threshold、reason、error、success、verbose_logs 和 evaluation_cost，而 `MetricData` 负责把这些状态冻结进结果，最后由 `EvaluationResult` 汇总 TestResults、confident link 与 run identity。

一旦进入多测试和并发场景，同一个 Metric 实例怎样重置状态就会变得关键，因为对象字段虽然方便实现具体指标，却要求执行器在每次运行前清理 error 等旧值，还要避免不同协程相互污染。结果证据也应保存 metric 名称、实现与模型版本、threshold、strict mode 和单次输出，而不能只留下最终布尔值。

## 实现取舍与失败语义

允许用户直接提交 TestCase 后，DeepEval 就能评测任意外部系统输出，而 agentic iterator 还能进一步把被测代码执行纳入 trace。两条路径的证据强度并不相同——前者需要信任调用者填入的 actual_output，后者虽然可以关联运行 trace，却仍然要锁定用户代码与执行环境。

Metric 失败表示已经得到有效测量，只是结果低于阈值，而 metric.error 表示根本没有取得可信测量。`ignore_errors=True` 可以让批量运行继续，但错误项不能在统计中静默消失。分母规则必须预先约定。缓存确实能节省 Judge 调用，不过它的 key 必须覆盖测试、指标配置、模型和依赖版本，否则命中结果无法解释。异步并发能够提高吞吐，也会同时暴露有状态 Metric、事件循环与全局 TestRun 管理的隔离要求。

## 动手实验

为问答系统设计一个 Golden 和对应的 LLMTestCase，分别填写 input、actual_output、expected_output、context 与 retrieval_context，并说明每个字段由谁产生。接着设计两个 Metric，一个负责确定性格式检查，另一个使用模型 Judge，再列出 score、threshold、reason、error 和 cost 应当怎样记录。最后比较 Judge 超时时 `evaluate(..., ignore_errors=True)` 与 `assert_test` 各自应该产生什么外部行为。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

Golden 的 input、expected 和 context 属于数据集定义，actual_output 来自 Target 执行，而 retrieval_context 是本次系统观测，并不是预先准备的答案。格式 Metric 可以离线给出确定分数，Judge Metric 则还要记录评分模型、prompt/config 和成本。忽略错误模式应保留 error 并继续运行其他测试，而 `assert_test` 应在失败指标字符串中显示 score、threshold、strict、error 与 reason，随后再抛出异常。

课程门禁不需要 API key，因为它只验证源码锁定、教学结构和本仓库离线实验，并不声称自己运行过具体的 DeepEval Judge。

## 如何核对

先从 [`deepeval/evaluate/evaluate.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/evaluate.py) 比较 `evaluate` 与 `assert_test`，再进入 [`deepeval/evaluate/execute/loop.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/execute/loop.py) 检查同步、异步与 agentic 路径，最后使用 [`deepeval/metrics/base_metric.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/metrics/base_metric.py) 核对 success 的具体语义。

## 本篇不能证明什么

API 易用、指标设置了阈值，或 pytest 能在条件不满足时失败，都不能证明指标有效、Judge 无偏、数据集代表线上分布、运行能够复现，或当前版本可以发布。它们只是评测机制，不是发布授权。

[上一节](../promptfoo/03-assertion-results-ci.md) · [下一节](01-dataset-golden-test-case.md)
