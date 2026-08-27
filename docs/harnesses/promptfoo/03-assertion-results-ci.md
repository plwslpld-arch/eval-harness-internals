# Promptfoo 断言与 CI：从响应判分到门禁还差哪一步

[上一节](02-test-case-runtime.md) · [下一节](../deepeval/README.md)

## 本篇要解决什么问题

同一个响应可以同时交给 contains、JSON schema、自定义脚本和模型判分，每条断言还可以带权重、阈值、命名指标、否定前缀或嵌套集合。所以「pass」不是 Provider 自带的属性，它是一组判据看过某次响应后聚合出的结论。这一篇会追着 `runAssertions` 看它如何生成 `GradingResult`，再看 Evaluator 如何把这份判分写进结果和 metrics，最后说清这些统计为什么还不是一道完整的发布 Gate（门禁）。

读完以后，你应该能分清是某条断言没通过，还是执行本身出了错，并能说明模型判分消耗了多少 token、断言集合留下了哪些组件结果、比较型断言为什么要延后判分，以及 CI 应该从哪个稳定字段读阈值。

## 先建立源码地图

| 源码位置 | 责任 | 阅读焦点 |
| --- | --- | --- |
| [`src/assertions/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/assertions/index.ts#L752-L791) | 断言分派、求值、聚合与比较 | pass/score/reason 怎样生成 |
| [`src/types/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/types/index.ts) | Assertion、AssertionSet、GradingResult | 判分契约保存什么 |
| [`src/evaluator.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator.ts#L1344-L1383) | grading、comparison、metrics 和统计 | 单行结论怎样汇总 |

## 完整调用链

![Promptfoo 断言聚合与 CI 判定边界](../../assets/diagrams/harnesses/promptfoo/assertion-ci.svg)

1. ProviderResponse 进入 `gradeRunEvalResponse`；无断言时返回专门的 no-assert 结果，而不是伪造一个命中的断言。
2. `runAssertions` 将普通 assertion 与 assertion set 展开为待执行项，为每个集合建立子聚合器。若存在 trace-aware assertion，会用 traceId 加载相关 trace 数据。
3. 单项进入 `runAssertionInternal`：模板值先按当前 vars 渲染；脚本型值可能加载外部函数；base type 与 `not-` 反向语义被标准化；最终 handler 接收 AssertionParams。
4. 模型判分型断言可通过 grading Provider 发起额外调用；它返回的 tokenUsage 属于评分成本。不应混入目标模型成本后丢失来源。
5. 每个结果写入主 AssertionsResult；属于集合的结果同时写入子聚合器。结束后集合按 threshold/权重形成组件结论，并保留 `componentResults`。
6. Evaluator 把 GradingResult 应用于 EvaluateResult：设置 success、score、namedScores、reason 和 failureReason，同时累计 assertion token、通过数、失败数。
7. `select-best`、`max-score` 等比较断言必须等待同组候选结果齐备后执行；其结论可能回写某行成功状态与 prompt metrics。
8. CI 可消费结果或汇总并按配置退出非零，但真正发布 Gate 还需要预注册数据版本、统计规则、不确定性处理和缺失结果策略。

## 关键数据结构

`Assertion` 用 type、value、threshold、weight、metric、provider 等字段写一条判据，`AssertionSet` 则在 assert 数组里继续嵌套，以此组合多条判据。运行时，`AssertionParams` 会把 assertion、标准化的 baseType、inverse、output、renderedValue、test、provider、ProviderResponse 和上下文一起交给 handler，`GradingResult` 再至少记下 pass、score 和 reason，也可以继续带上 namedScores、tokensUsed、componentResults、assertion 与 metadata。

`EvaluateResult.success` 给出整条结果最后通过与否，`failureReason` 区分目标出错还是断言失败，`namedScores` 则允许同一条结果携带多个指标，PromptMetrics 再把 testPassCount、testFailCount、assertPassCount、assertFailCount 和 score 继续汇总起来。如果最后只导出 success，你就看不到结果为什么失败、又是哪条判据变了，这些诊断证据会全部丢失。

## 实现取舍与失败语义

统一分派之后，各种判据可以共用模板渲染、反向语义和错误处理，但动态脚本和模型判分也会带来外部代码安全、Judge（裁判模型）偏差和网络失败等问题。集合完成聚合后仍会留下 componentResults，因此比只返回一个总分多了一层可核对证据。但阈值和权重依然是产品政策，你必须记下它们用的版本和选用理由。

断言得到 false，说明被测对象没有满足契约，而 handler 抛错则说明这次根本无法得出结论。评分 Provider 不可用时，故障出在 Judge 一侧，trace 缺失则会让 trace-aware 判据无从判定，这四件事不能混。发布规则如果把后三种情况当成普通负样本算进失败率，就会把基础设施故障伪装成产品质量下降。可你也不能丢掉这些记录，然后拿缩小过的分母宣布通过。

## 动手实验

给同一个响应设计三项断言，格式正确、事实一致和安全约束的权重分别是 1、2、3，然后计算全部通过、只有事实失败以及 Judge 超时时，各自会得到什么组件结果和总体状态。随后为候选 A/B 设计一个 `select-best`，说明为什么 A 刚返回时还不能判分。最后写出 CI Gate 的输入契约，把结果集完整性、错误率、核心指标、最小样本数和置信区间策略都收进去。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

三项断言都通过时，总体状态是 pass，但每项组件结果依然要保存。如果事实项失败，总体规则就要按配置的阈值计算，同时留下该项的 reason，不能只写一个总分。Judge 超时时，结果应该标成评分不可用或评测错误，不能把它当成事实断言得到 false。A/B 必须等同组输出到齐以后再比较，否则无法得出相对结论。

一道合格的 Gate 要先检查预期坐标是否全部出现，并排除无法解释的重复，然后把产品失败和 harness error 分开。接着按预注册方案计算核心指标及其不确定性，最后再对照明确阈值给出 pass、fail 或 inconclusive。Promptfoo 的 assertions 和 CI 退出码提供了重要构件，但这组课程不会把它们直接当成一套完整的发布制度。

## 如何核对

先从 [`src/assertions/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/assertions/index.ts#L752-L791) 的 `runAssertions` 追到 `runAssertion`、`runAssertionInternal` 和 handler 映射，观察集合、并发与 trace-aware 分支，再到 [`src/evaluator.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator.ts#L1344-L1383) 查 `gradeRunEvalResponse`、`applyGradingResult`、comparison merging 与 metrics 更新。

## 本篇不能证明什么

无论断言类型多么丰富，它们都无法证明 Judge 与人类会做出一样的判断、指标真的反映线上业务、阈值设得合理，或者结果具有统计显著性。CI 退出码也不是发布授权，真正的组织流程仍然要独立处理数据治理、人工复核、例外和回滚。

[上一节](02-test-case-runtime.md) · [下一节](../deepeval/README.md)
