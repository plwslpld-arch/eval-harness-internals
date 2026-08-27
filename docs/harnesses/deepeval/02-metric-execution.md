# DeepEval Metric：有状态评分器怎样产出可解释结果

[上一节](01-dataset-golden-test-case.md) · [下一节](03-async-cache-errors.md)

## 本篇要解决什么问题

你很容易把 Metric 当成一个简单的 `test_case -> float` 函数，可 DeepEval 的 `BaseMetric` 会把 threshold、score、reason、error、success、verbose_logs、evaluation_model 和 cost 全留在自己身上。具体 `measure` 先写回这些状态，执行循环再把它们读出来，组装成 MetricData（指标数据）。这样写自定义指标确实方便，但同一个对象能不能并发复用、旧状态怎样清掉、阈值该怎么解释、错误又该归到哪一类，都成了必须说清的合同。

读完后，你应该能写出一个最小的自定义 Metric，并分清哪些字段记原始测量，哪些字段表达政策判断，哪些字段只用来排查运行问题。你还要能解释，为什么 Judge（裁判模型）和确定性 Scorer（评分器）即使都给出 score，也不能直接横向比较。

## 先建立源码地图

| 源码位置 | 责任 | 阅读焦点 |
| --- | --- | --- |
| [`deepeval/metrics/base_metric.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/metrics/base_metric.py#L54-L93) | Metric 抽象和 `is_successful` | 测量状态与阈值语义 |
| [`deepeval/evaluate/execute/loop.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/execute/loop.py) | 执行、跳过、错误与结果更新 | 对象状态怎样冻结为证据 |
| [`deepeval/evaluate/evaluate.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/evaluate.py) | 指标输入验证和入口行为 | 阈值与 assert_test 的关系 |

## 完整调用链

![DeepEval Metric 的测量与判定](../../assets/diagrams/harnesses/deepeval/metric.svg)

1. 调用者构造 Metric 实例并设置 threshold、strict_mode、evaluation model 等配置；入口验证至少一项指标具有阈值，确保 assert 语义可判定。
2. 执行器为 TestCase 与 Metric 建立 pair。在每次执行前清理 metric.error 等上次状态，并根据同步/异步模式调用 `measure` 或 `a_measure`。
3. 具体 Metric 从 LLMTestCase 读取所需字段。确定性指标直接计算；LLM-as-a-Judge 指标可能生成 prompt、调用评估模型、解析结构化结果并累计 evaluation_cost。
4. Metric 写回 score、reason、verbose_logs 等；若异常被保留，则写 error。`is_successful` 在 error 时返回 false，在无 threshold 时依据 score 是否存在，否则比较 score 与 threshold；strict_mode 可要求满分。
5. 执行公共逻辑把 Metric 状态转换为 MetricData，包括 name、threshold、success、score、reason、strict、evaluationModel、error 与 cost，并挂到 TestResult。
6. `assert_test` 遍历 metrics_data，把 error 非空或 success 为 false 的指标列为失败，生成可读字符串并抛出 AssertionError。
7. 批量 `evaluate` 不只给布尔断言，还保留每个 TestCase 的指标结果供控制台、文件和 TestRun 汇总。

## 关键数据结构

BaseMetric 把 `measure`/`a_measure` 定义成抽象方法，返回的 float 只是接口露出来的一小部分，真正的结果仍留在实例字段里。`score` 记测量值，`threshold` 记当前采用的政策，程序把两者合起来才得出 `success`。`reason` 解释这次测量，`error` 说明没能测出来，`evaluation_cost` 则记下 Judge 花了多少成本。若还要往下排查，可以查看 `score_breakdown` 和 verbose_logs，了解各个组成部分出了什么情况。分数只是其中一项。

因此，保存证据时要把原始 score 和测量配置一并留下，不能只存 success，因为阈值变了以后，你可以不重跑 Target，直接按旧 score 重新判断是否通过。阈值不是测量值。但只要 Metric 换了 prompt、model 或解析逻辑，测量所依据的合同也就变了，此时旧 score 还能不能用，必须看这个指标怎样定义自己的版本。

## 实现取舍与失败语义

有状态基类让自定义 Metric 更好写，控制台也能直接读 reason，可同一个实例一旦同时服务多个 TestCase，字段就可能互相覆盖。执行框架要么为每个任务复制实例，要么串行访问，也可以采用别的隔离办法。无论选哪一种，Metric 开始测新用例前都得清掉上次留下的 error 和 score，否则前一个用例会污染后一个。

分数低于阈值，说明测量已经完成，只是结果没通过。Judge 的输出解析失败，要记成 Metric error。TestCase 少了必需字段，是输入或适配出了问题。Judge API 遭到限流，则是评分基础设施故障。这些情况不能混着算。strict_mode 只会按特定规则收紧通过条件，它属于政策配置，不会让分数变得「更准确」。模型 Judge 写出的 reason 也只是模型生成的解释，不能当作事实证明，因此你仍要做校准、人工复核和对抗样本测试。

## 动手实验

先在纸面上写一个 `ExactJsonMetric`，让它检查 actual_output 能否解析成 JSON，并确认其中有 `answer` 字段，条件满足就给 1，否则给 0，同时写出 reason。接着列出 measure 前后 BaseMetric 的每个字段怎样变化，再设计 `FaithfulnessJudgeMetric`，说明还要锁定哪些模型、模板、温度、解析 schema 和重试策略。最后把 0.7 与 0.9 两个 threshold 分别套在同一批 score 上，并解释为什么这里只是重新判断有没有通过，并没有重新测量。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

ExactJsonMetric 测量前要清空或重置 score、reason 和 error，测量后把 score 写成 0 或 1，并让 reason 说清究竟满足或违反了什么条件。只有指标自己跑不起来时，才应该写 error。Judge Metric 不能只靠一个类名标记身份，至少还要带上评估模型标识、系统与用户模板摘要、参数、输出 schema、库 commit 和依赖版本。

把不同 threshold 套在同一批结果上，只会改变 success 和汇总数字，不会改写原始 score。strict_mode 只要变了，也必须跟着记进结果。若 Judge 已经换了判断逻辑，原 score 所依据的测量合同就不再相同，此时不能只重算 success，再把它说成同一版指标的结果。

## 如何核对

先读 [`deepeval/metrics/base_metric.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/metrics/base_metric.py#L54-L93) 里的字段、抽象方法和 `is_successful`，弄清基类怎样保存并判断状态。再到 [`deepeval/evaluate/execute/loop.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/execute/loop.py#L167-L206) 搜索 `_execute_metric`、MetricData 和 test run update，核对程序遇到异常后还会不会往下走，以及它究竟在什么时候把结果定下来。

## 本篇不能证明什么

Metric 即使带着 reason、threshold 和 cost，也证明不了它测的东西真的有效，Judge 与专家意见一致，或者阈值经过了业务验证。不同指标各自给出的 0.8 也不能直接比较。你还得用独立的验证数据，分别检查指标是否可靠、有没有效度、偏差多大，以及遇到扰动是否稳定。

[上一节](01-dataset-golden-test-case.md) · [下一节](03-async-cache-errors.md)
