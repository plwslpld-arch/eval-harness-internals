# DeepEval Metric：有状态评分器怎样产出可解释结果

[上一节](01-dataset-golden-test-case.md) · [下一节](03-async-cache-errors.md)

## 本篇要解决什么问题

Metric 很容易被误解为一个纯函数 `test_case -> float`。DeepEval 的 `BaseMetric` 却明确持有 threshold、score、reason、error、success、verbose_logs、evaluation_model 和 cost；具体 `measure` 在对象上写状态，执行循环随后读取这些字段形成 MetricData。这种设计方便自定义指标，却带来并发复用、状态清理、阈值解释和错误分类问题——本篇把这些隐含合同展开。

目标是让读者能够实现一个最小自定义 Metric，并知道哪些字段属于原始测量、哪些属于政策判断、哪些属于运行诊断；同时理解模型 Judge 与确定性 Scorer 为什么不能只按同一个 score 比较。

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

BaseMetric 的抽象方法是 `measure`/`a_measure`，返回 float 只是接口表面——真正结果还在实例字段中。`score` 是测量值，`threshold` 是当前政策，`success` 是两者结合后的派生判断，`reason` 解释测量，`error` 表示测量不可得，`evaluation_cost` 是 Judge 运行成本。`score_breakdown` 和 verbose_logs 提供组件诊断。

因此证据存储应保留原始 score 与配置，而不是只保留 success。阈值变化时可以在不重跑 Target 的情况下重新计算政策结论；但若 Metric prompt/model 或解析逻辑变化，旧 score 是否可复用需要指标自身的版本语义。

## 实现取舍与失败语义

有状态基类让自定义 Metric 编写直观，也允许控制台直接读取 reason；代价是同一实例跨 TestCase 并发复用可能发生数据竞争。执行框架需要复制实例、串行访问或确保任务隔离。一个 Metric 在开始新测试前必须清除上次 error/score，否则前一用例会污染后一用例。

低于阈值是有效失败；解析 Judge 输出失败是 Metric error；TestCase 缺少必需字段是输入/适配错误；Judge API 限流是评分基础设施错误。strict_mode 把通过条件收紧为特定语义，属于政策配置，不是“分数更准确”。模型 Judge 的 reason 是模型生成解释，不是事实证明，仍需校准、人工复核和对抗样本。

## 动手实验

实现纸面版 `ExactJsonMetric`：验证 actual_output 可解析为 JSON 且包含 `answer` 字段，成功得 1，否则得 0，并给 reason。写出 measure 前后 BaseMetric 字段变化。再设计 `FaithfulnessJudgeMetric`，列出额外需要锁定的模型、模板、温度、解析 schema 和重试策略。最后给同一批 score 分别应用 0.7 和 0.9 threshold，说明为何这是重新判定而非重新测量。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

ExactJsonMetric 在测量前 score/reason/error 应为空或重置，测量后 score 为 0/1、reason 描述具体条件、error 仅在指标自身无法运行时出现。Judge Metric 的 identity 不能只有类名，至少包括评估模型标识、系统/用户模板摘要、参数、输出 schema、库 commit 和依赖版本。

应用不同 threshold 只改变 success 和汇总，不改变原始 score；若 strict_mode 改变，必须在结果中记录。若 Judge 逻辑改变，则原 score 的测量合同已变，不能简单重算 success 冒充同一指标版本。

## 如何核对

阅读 [`deepeval/metrics/base_metric.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/metrics/base_metric.py#L54-L93) 的字段、抽象方法和 `is_successful`，再在 [`deepeval/evaluate/execute/loop.py`](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/deepeval/evaluate/execute/loop.py#L167-L206) 搜索 `_execute_metric`、MetricData 和 test run update，核对异常后是否继续以及结果何时冻结。

## 本篇不能证明什么

Metric 有 reason、threshold 和 cost 不能证明构念有效、Judge 与专家一致、阈值经过业务验证或不同指标的 0.8 可直接比较。指标可靠性、效度、偏差和鲁棒性需要独立验证数据。

[上一节](01-dataset-golden-test-case.md) · [下一节](03-async-cache-errors.md)
