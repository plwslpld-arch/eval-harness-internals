# Promptfoo 断言与 CI：从响应判分到门禁还差哪一步

[上一节](02-test-case-runtime.md) · [下一节](../deepeval/README.md)

## 本篇要解决什么问题

一个响应可以同时接受 contains、JSON schema、自定义脚本和模型判分；断言还可能有权重、阈值、命名指标、否定前缀与嵌套集合。于是“pass”并不是 Provider 的属性，而是某组判据在某次响应上的聚合结论。本篇追踪 `runAssertions` 怎样产生 `GradingResult`、Evaluator 怎样把它并入结果和 metrics，并解释为什么这些统计还不是一个完整发布 Gate。

读完应能回答：单断言失败和断言执行错误如何区分；模型判分为什么可能额外消耗 token；断言集合怎样保留组件结果；比较型断言为什么要延迟到多行结果齐备；CI 阈值应该读取哪些稳定字段。

## 先建立源码地图

| 源码位置 | 责任 | 阅读焦点 |
| --- | --- | --- |
| [`src/assertions/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/assertions/index.ts) | 断言分派、求值、聚合与比较 | pass/score/reason 怎样生成 |
| [`src/types/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/types/index.ts) | Assertion、AssertionSet、GradingResult | 判分契约保存什么 |
| [`src/evaluator.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator.ts) | grading、comparison、metrics 和统计 | 单行结论怎样汇总 |

## 完整调用链

![Promptfoo 断言聚合与 CI 判定边界](../../assets/diagrams/harnesses/promptfoo/assertion-ci.svg)

1. ProviderResponse 进入 `gradeRunEvalResponse`；无断言时返回专门的 no-assert 结果，而不是伪造一个命中的断言。
2. `runAssertions` 将普通 assertion 与 assertion set 展开为待执行项，为每个集合建立子聚合器。若存在 trace-aware assertion，会用 traceId 加载相关 trace 数据。
3. 单项进入 `runAssertionInternal`：模板值先按当前 vars 渲染；脚本型值可能加载外部函数；base type 与 `not-` 反向语义被标准化；最终 handler 接收 AssertionParams。
4. 模型判分型断言可通过 grading Provider 发起额外调用。它返回的 tokenUsage 属于评分成本，不应混入目标模型成本后丢失来源。
5. 每个结果写入主 AssertionsResult；属于集合的结果同时写入子聚合器。结束后集合按 threshold/权重形成组件结论，并保留 `componentResults`。
6. Evaluator 把 GradingResult 应用于 EvaluateResult：设置 success、score、namedScores、reason 和 failureReason，同时累计 assertion token、通过数、失败数。
7. `select-best`、`max-score` 等比较断言必须等待同组候选结果齐备后执行；其结论可能回写某行成功状态与 prompt metrics。
8. CI 可消费结果或汇总并按配置退出非零，但真正发布 Gate 还需要预注册数据版本、统计规则、不确定性处理和缺失结果策略。

## 关键数据结构

`Assertion` 包含 type、value、threshold、weight、metric、provider 等；`AssertionSet` 用嵌套 assert 数组表达组合判据。`AssertionParams` 把 assertion、标准化 baseType、inverse、output、renderedValue、test、provider、ProviderResponse 和上下文交给 handler。`GradingResult` 至少含 pass、score、reason，并可含 namedScores、tokensUsed、componentResults、assertion 与 metadata。

`EvaluateResult.success` 是整条结果的最终布尔结论，`failureReason` 区分目标错误和断言失败，`namedScores` 支持多个指标。PromptMetrics 再汇总 testPassCount、testFailCount、assertPassCount、assertFailCount 与 score。若只导出 success，会丢掉“为何失败”和“哪个判据变化”的诊断证据。

## 实现取舍与失败语义

统一断言分派使大量判据共享模板渲染、反向语义与错误处理；动态脚本和模型判分提高表达力，也引入外部代码安全、Judge 偏差和额外网络失败。集合聚合保留 componentResults，优于只返回总分；但阈值和权重仍是产品政策，必须有版本与理由。

断言 false 是被测对象不满足契约；断言 handler 抛错是评测系统无法得出结论；评分 Provider 不可用是 Judge 层故障；trace 缺失可能让 trace-aware 判据不可判。发布规则不应把后三者当普通负样本计入失败率，否则基础设施故障会伪装成产品质量下降。反过来，也不能忽略它们后用较小分母宣布通过。

## 动手实验

给同一响应设计三项断言：格式正确权重 1、事实一致权重 2、安全约束权重 3。分别计算全部通过、仅事实失败、Judge 超时三种情况下应保存的组件结果和总体状态。再设计一个候选 A/B 的 `select-best`，说明为什么它不能在 A 返回后立即判分。最后写一份 CI Gate 输入契约，至少包括结果集完整性、错误率、核心指标、最小样本数和置信区间策略。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

全部通过时总体 pass，组件仍应逐项保存；事实失败时总体规则按配置阈值计算，并保留事实项 reason，而不是只写总分；Judge 超时应标为评分不可用或评测错误，不能等同事实断言为 false。A/B 比较必须拿到同组输出才能形成相对结论。

合格 Gate 至少先验证预期坐标全部出现且无不可解释重复，再把产品失败与 harness error 分开；随后计算预注册核心指标及不确定性，最后按明确阈值给 pass/fail/inconclusive。Promptfoo 的 assertions 和 CI 退出码提供重要构件，但课程不把它们自动等同完整发布制度。

## 如何核对

从 [`src/assertions/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/assertions/index.ts) 的 `runAssertions` 追到 `runAssertion`、`runAssertionInternal` 和 handler 映射，观察集合、并发与 trace-aware 分支；再在 [`src/evaluator.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator.ts) 查 `gradeRunEvalResponse`、`applyGradingResult`、comparison merging 与 metrics 更新。

## 本篇不能证明什么

断言实现丰富不能证明 Judge 与人类一致、指标与线上业务相关、阈值合理或结果具有统计显著性。CI 退出码也不是发布授权；真实组织仍需独立数据治理、复核、例外流程和回滚机制。

[上一节](02-test-case-runtime.md) · [下一节](../deepeval/README.md)
