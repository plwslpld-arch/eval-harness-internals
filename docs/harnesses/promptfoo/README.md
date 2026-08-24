# Promptfoo 源码课程：配置矩阵怎样变成可判定的评测运行

[上一节](../openai-evals/03-recorder-metrics-boundaries.md) · [下一节](01-config-provider-prompt.md)

## 本篇要解决什么问题

Promptfoo 常被介绍为“用 YAML 对比多个提示词和模型”，但这句话省略了 Eval Harness 最关键的部分：配置中的 prompt、provider、test、变量、重复次数与断言并不是一条请求，而是一张需要展开、调度、执行、判分和持久化的运行计划。本课程要回答：配置对象怎样被标准化为原子测试，Provider 怎样成为统一调用边界，运行器为什么有时必须放弃并发，断言怎样把响应转换为通过、得分和失败原因，以及 CI 看见的汇总与单条证据之间是什么关系。

锁定版本为 `ce89186a22c59543f4f71a55d42442ff3f0e3654`。课程只对该版本列出的五个源码文件作可核对解释。Promptfoo 还包含红队、缓存、Web 界面、远程服务与大量 Provider；它们不是本组入门课的覆盖承诺。

## 先建立源码地图

| 站点 | 锁定文件 | 本课关注的问题 |
| --- | --- | --- |
| 总调度器 | [`src/evaluator.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator.ts) | 测试展开、运行步骤、并发、超时、判分和统计 |
| 运行时契约 | [`src/evaluator/runtime.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator/runtime.ts) | Store、结果写入器和运行时依赖 |
| Provider 装配 | [`src/providers/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/providers/index.ts) | 字符串、配置、函数和文件怎样解析为 ApiProvider |
| 断言执行 | [`src/assertions/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/assertions/index.ts) | 单断言、断言集合、模型判分和 trace-aware 判分 |
| 公共类型 | [`src/types/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/types/index.ts) | AtomicTestCase、EvaluateResult、GradingResult 与选项 |

## 完整调用链

![Promptfoo 从配置到结果的主调用链](../../assets/diagrams/harnesses/promptfoo/end-to-end.svg)

1. 配置层提供 prompts、providers、tests、scenarios、defaultTest 与运行选项；加载后的 `TestSuite` 仍不是执行队列。
2. Evaluator 合并默认测试和场景，把变量数组展开为组合，并为每个 test × vars × prompt × provider 生成 `RunEvalOptions`。重复运行和比较断言会继续改变步骤数与分组关系。
3. Provider 解析器把字符串 ID、内联对象、函数或外部文件统一为带 `id()` 与 `callApi()` 的 `ApiProvider`；运行步骤因此不必知道某家模型 SDK。
4. 调度器检查 conversation 变量、`storeOutputAs` 和持久浏览器会话等跨步骤状态；这些特性存在时，并发会被降为 1。其余步骤用受限并发执行，并共享速率限制注册表。
5. 单步渲染 prompt 和变量，调用活跃 Provider，得到 `ProviderResponse`；空响应、Provider 错误、超时和目标不可用分别进入不同结果分支。
6. `runAssertions` 对 assertion 或 assertion set 求值，形成 `GradingResult`；Evaluator 再把 success、score、namedScores、failureReason、tokenUsage 和 latency 写回 `EvaluateResult`。
7. Store 与 JSONL writer 持久化单行结果，末尾聚合每个 prompt 的通过数、失败数、错误数和得分，供报告或 CI 决策使用。

## 关键数据结构

`AtomicTestCase` 是已经可运行的测试语义，包含 vars、assert、provider override、metadata 等；`RunEvalOptions` 再把具体 prompt/provider/testIdx/promptIdx 与超时、缓存和信号装到一次执行。`ProviderResponse` 是目标调用边界，既可能有 output，也可能有 error、tokenUsage、latencyMs 与 metadata。`EvaluateResult` 是一行运行结果，保留原测试、响应、评分、成功状态和失败原因。`GradingResult` 则专注判分：pass、score、reason、namedScores、componentResults 和 assertion。

这些结构相互关联，却不能互换。Provider 有返回不等于断言通过；断言通过不等于整个 Trial 有统计代表性；prompt 汇总也不等于发布 Gate。Reference Harness 会用 Trial/Attempt 和独立 Gate 把这几层进一步拆开。

## 实现取舍与失败语义

配置矩阵让同一组测试可以快速横向比较多个模型和提示词，代价是“配置中的一行”与“结果中的一行”不再一一对应。排查数量异常时必须先计算展开规则。统一 Provider 接口降低接入成本，但字符串解析、插件加载和运行时配置意味着复现记录应保存解析后的 Provider 身份，而不只是原始短名。

并发降级是正确性选择：会话历史或前一步输出参与后一步输入时，乱序会改变样本本身。Provider 重试、缓存命中和断言中的模型调用又是不同恢复层，不能把多次底层调用当成多个独立样本。持久化失败会被记录并尝试保留 JSONL 权威副本；这保护已有证据，但不能自动证明结果集无缺口。

## 动手实验

假设配置有 2 个 prompt、3 个 provider、4 个 test，其中一个 test 的变量 `tone` 有 2 个值。先不运行代码，写出最小步骤数；再加入 `repeat: 2` 重新计算。随后标出哪些字段属于配置身份、目标响应、评分结果和运行汇总。最后解释如果某个 test 使用会话变量，为什么把并发设为 8 也不应并发执行。

运行仓库的离线检查：

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

若四个 test 都只有一个变量组合，基础步骤数是 `2 × 3 × 4 = 24`；若只有其中一个 test 因 `tone` 展开为两个原子测试，总数是 `2 × 3 × (3 + 2) = 30`。全部重复两次则为 60。真实配置还可能受 scenarios、过滤、已完成结果恢复、比较断言和 provider override 影响，因此这是用于理解的最小模型。

会话变量依赖前序结果，任意并发会让输入取到错误历史或不同历史，所以调度器应串行化。课程测试应在无模型密钥、无网络调用时通过；它验证课程结构和锁定链接，不声称执行了 Promptfoo 全套集成测试。

## 如何核对

先在 [`src/evaluator.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator.ts) 依次找 `buildTestsFromSuite`、`generateVarCombinations`、`appendRunEvalOptionsForProvider`、`adjustConcurrencyForSerialFeatures`、`runConcurrentEvalSteps` 和 `runEval`。再到 [`src/providers/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/providers/index.ts) 核对 Provider 的多种输入形式，最后在 [`src/assertions/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/assertions/index.ts) 核对断言聚合。

## 本篇不能证明什么

本篇不能证明某个 Promptfoo 配置适合生产发布、模型判分可靠、缓存无污染、所有 Provider 行为一致，或 CI 中一次全绿具有统计显著性。它提供的是锁定版本的运行骨架和核对方法。

[上一节](../openai-evals/03-recorder-metrics-boundaries.md) · [下一节](01-config-provider-prompt.md)
