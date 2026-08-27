# Promptfoo 断言与 CI：从响应判分到门禁还差哪一步

[上一节](02-test-case-runtime.md) · [下一节](../deepeval/README.md)

## 本篇要解决什么问题

一个响应可同时接受 contains、JSON schema、自定义脚本和模型判分，断言还可带权重、阈值、命名指标、否定前缀与嵌套集合。因此，「pass」并不是 Provider 自带的属性，而是某组判据对某次响应作出的聚合结论。本篇会追踪 `runAssertions` 怎样产生 `GradingResult`，Evaluator 怎样把它并入结果和 metrics——然后再解释为什么这些统计还构不成完整的发布 Gate。

读完后，应能区分单断言失败与执行错误，说明模型判分的 token 成本、断言集合的组件结果和比较型断言的延迟判分，并确定 CI 阈值读取的稳定字段。

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

`Assertion` 包含 type、value、threshold、weight、metric、provider 等字段，`AssertionSet` 用嵌套 assert 数组表达组合判据，而 `AssertionParams` 会把 assertion、标准化 baseType、inverse、output、renderedValue、test、provider、ProviderResponse 和上下文交给 handler。`GradingResult` 至少包含 pass、score、reason，还可以带有 namedScores、tokensUsed、componentResults、assertion 与 metadata。

`EvaluateResult.success` 是整条结果的最终布尔结论，`failureReason` 用来区分目标错误和断言失败，`namedScores` 则支持多个指标。PromptMetrics 会继续汇总 testPassCount、testFailCount、assertPassCount、assertFailCount 与 score。如果只导出 success，就会丢掉为何失败以及哪个判据发生变化的诊断证据。

## 实现取舍与失败语义

统一分派让判据共享模板渲染、反向语义和错误处理，但动态脚本与模型判分也会带来外部代码安全、Judge 偏差和网络失败。集合聚合会保留 componentResults，比只返回总分提供了更多证据，但阈值与权重仍属于产品政策，必须记录版本和采用理由。

断言为 false 表示被测对象不满足契约，handler 抛错表示无法得出结论，评分 Provider 不可用属于 Judge 故障，trace 缺失会让 trace-aware 判据不可判。它们不是一回事。发布规则不能把后三者当作普通负样本计入失败率，否则基础设施故障会伪装成产品质量下降。反过来，也不能忽略这些记录结果，再用缩小后的分母宣布通过。

## 动手实验

为同一响应设计三项断言，其中格式正确的权重是 1，事实一致为 2，安全约束为 3，并计算全部通过、仅事实失败和 Judge 超时时的组件结果与总体状态。然后再设计一个候选 A/B 的 `select-best`，说明为什么它不能在 A 返回后立即判分。最后写 CI Gate 输入契约，涵盖结果集完整性、错误率、核心指标、最小样本数和置信区间策略。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

全部通过时，总体状态是 pass。组件结果仍应逐项保存。事实失败时，总体规则要按配置阈值计算，并保留事实项的 reason，不能只写一个总分。Judge 超时应该标为评分不可用或评测错误，不能等同于事实断言为 false。A/B 比较必须取得同组输出，才能形成相对结论。

合格的 Gate 至少要先验证预期坐标全部出现，并且没有不可解释的重复，再把产品失败与 harness error 分开。随后计算预注册的核心指标及其不确定性，最后依据明确阈值给出 pass/fail/inconclusive。Promptfoo 的 assertions 和 CI 退出码提供了重要构件，但本课程不会把它们自动等同于完整发布制度。

## 如何核对

先从 [`src/assertions/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/assertions/index.ts#L752-L791) 的 `runAssertions` 追到 `runAssertion`、`runAssertionInternal` 和 handler 映射，观察集合、并发与 trace-aware 分支，再到 [`src/evaluator.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator.ts#L1344-L1383) 查 `gradeRunEvalResponse`、`applyGradingResult`、comparison merging 与 metrics 更新。

## 本篇不能证明什么

断言实现再丰富，也不能证明 Judge 与人类判断一致、指标与线上业务相关、阈值合理，或结果具有统计显著性。CI 退出码同样不是发布授权，真实组织仍然需要独立的数据治理、复核、例外流程和回滚机制。

[上一节](02-test-case-runtime.md) · [下一节](../deepeval/README.md)
