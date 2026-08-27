# Promptfoo 源码课程：配置矩阵怎样变成可判定的评测运行

[上一节](../openai-evals/03-recorder-metrics-boundaries.md) · [下一节](01-config-provider-prompt.md)

## 本篇要解决什么问题

Promptfoo 常被概括成「用 YAML 对比多个提示词和模型」，可这句话省掉了 Eval Harness 真正干的大部分工作。配置里的 prompt、provider、test、变量、重复次数和断言，合在一起也还不是一条请求，它们只是规定了一张运行计划。程序要先展开这张计划，再逐步调度、执行、判分和持久化，每一步都会改变最后能看到的证据。这组课程会说清配置对象如何变成原子测试、Provider（提供方）如何统一承接调用、运行器为什么有时必须放弃并发，以及断言如何把响应判成通过、得分或失败原因。最后再看 CI 手里的汇总数字，与每条运行留下的证据究竟是什么关系。

课程锁定在 `ce89186a22c59543f4f71a55d42442ff3f0e3654`，只根据这个版本里列出的五个源码文件讲可以核对的事实，同时说清这些事实适用到哪里为止。Promptfoo 还有红队、缓存、Web 界面、远程服务和大量 Provider，但这组入门课不承诺覆盖这些部分。

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
4. 调度器检查 conversation 变量、`storeOutputAs` 和持久浏览器会话等跨步骤状态；这些特性存在时——并发会被降为 1。其余步骤用受限并发执行，并共享速率限制注册表。
5. 单步渲染 prompt 和变量，调用活跃 Provider，得到 `ProviderResponse`；空响应、Provider 错误、超时和目标不可用分别进入不同结果分支。
6. `runAssertions` 对 assertion 或 assertion set 求值，形成 `GradingResult`；Evaluator 再把 success、score、namedScores、failureReason、tokenUsage 和 latency 写回 `EvaluateResult`。
7. Store 与 JSONL writer 持久化单行结果，末尾聚合每个 prompt 的通过数、失败数、错误数和得分，供报告或 CI 决策使用。

## 关键数据结构

`AtomicTestCase` 已经表达了可以运行的测试，其中保留 vars、assert、provider override、metadata 等字段。`RunEvalOptions` 在此基础上再选定具体的 prompt/provider/testIdx/promptIdx，并把超时、缓存和信号一起带进单次执行。目标调用会从 `ProviderResponse` 这条边界返回结果，其中可以有 output，也可以有 error、tokenUsage、latencyMs 和 metadata。`EvaluateResult` 把原测试、响应、评分、成功状态和失败原因留在同一行运行结果中，`GradingResult` 则只收 pass、score、reason、namedScores、componentResults 和 assertion 等判分信息。

这些结构会相互引用，但谁都不能代替谁，类型边界必须留着。Provider 返回了结果，不表示断言就能通过，而断言通过了，也不能证明整个 Trial 有统计代表性，更不能拿 prompt 汇总直接当作发布 Gate。Reference Harness 会用 Trial/Attempt 和独立 Gate 继续把这几层意思拆开。

## 实现取舍与失败语义

配置矩阵让同一组测试可以快速横向比较多个模型和提示词，但程序一旦展开矩阵，配置的一行就不再对应结果的一行，排查数量异常时要先算清展开规则。Provider 统一接口之后，新接一家模型会更省事，可调用中间仍然经过了字符串解析、插件加载和运行时配置。所以复现记录要保存解析后的 Provider 身份，不能只留原始短名。

调度器降低并发，是因为会话历史或前一步输出参与后一步输入时，乱序会直接改变样本本身。Provider 重试、缓存命中和断言发起的模型调用分属不同恢复层，底层多调了几次，不能就多算几个独立样本。如果持久化失败，系统会记下这个故障，并尽量留住 JSONL 权威副本。它能保住已经产生的证据，却不能自动证明整个结果集没有缺口。

## 动手实验

假设配置里有 2 个 prompt、3 个 provider 和 4 个 test，其中一个 test 的变量 `tone` 又有 2 个值。先别跑代码，手算最小步骤数，然后加入 `repeat: 2` 再算一次。随后把字段分到配置身份、目标响应、评分结果和运行汇总四类里，最后解释为什么某个 test 一旦用了会话变量，即使把并发设成 8，也不能真的并发执行。

运行仓库的离线检查：

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

如果四个 test 都只有一种变量组合，基础步骤数就是 `2 × 3 × 4 = 24`。如果其中一个 test 因 `tone` 展开成两个原子测试，总数就会变成 `2 × 3 × (3 + 2) = 30`，全部再重复两次，结果就是 60。真实配置还会受 scenarios、过滤、已完成结果恢复、比较断言和 provider override 影响，因此这里只用最小模型说明展开规则。

会话变量要读前序结果，一旦并发，当前输入就可能读到错的历史，或者读到与预期不同的历史，因此调度器应该让相关步骤串行。课程测试不依赖模型密钥，也不发起网络调用，它只检查课程结构和锁定链接，并没有执行 Promptfoo 的整套集成测试。

## 如何核对

先在 [`src/evaluator.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator.ts) 依次找 `buildTestsFromSuite`、`generateVarCombinations`、`appendRunEvalOptionsForProvider`、`adjustConcurrencyForSerialFeatures`、`runConcurrentEvalSteps` 和 `runEval`。再到 [`src/providers/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/providers/index.ts) 核对 Provider 的多种输入形式，最后在 [`src/assertions/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/assertions/index.ts) 核对断言聚合。

## 本篇不能证明什么

这一篇不能证明某份 Promptfoo 配置已经适合生产发布、模型判分足够可靠、缓存从未被污染，或者所有 Provider 都会做出一样的行为。CI 偶尔一次全绿，也不代表结果具有统计显著性。本篇只给出锁定版本的运行骨架，并告诉你该去哪里核对。

[上一节](../openai-evals/03-recorder-metrics-boundaries.md) · [下一节](01-config-provider-prompt.md)
