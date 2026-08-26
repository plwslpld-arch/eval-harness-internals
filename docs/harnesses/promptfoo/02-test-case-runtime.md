# Promptfoo 测试运行时：展开、串并行与结果落盘

[上一节](01-config-provider-prompt.md) · [下一节](03-assertion-results-ci.md)

## 本篇要解决什么问题

评测性能问题常被简单归因于“并发太低”，结果正确性问题又常被归因于“模型随机”。Promptfoo 的 Evaluator 表明，两者都要先理解运行步骤怎样生成和调度：变量数组会扩大测试数，resume 会过滤已完成步骤，会话历史和跨步骤输出会强制串行，超时可以发生在单步或全局，持久化失败还会触发恢复副本。本篇解释一次原子运行从队列到结果存储的生命周期。

重点不是记住每个私有函数，而是建立四个检查点：计划是否正确展开、调度是否保持依赖顺序、错误是否归到正确层、持久化是否保留权威结果。

## 先建立源码地图

| 源码位置 | 责任 | 需要核对的行为 |
| --- | --- | --- |
| [`src/evaluator.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator.ts) | Evaluator、runEval、串并行调度 | 计划、超时、速率限制、统计 |
| [`src/evaluator/runtime.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator/runtime.ts) | Store 与 writer 契约 | 结果怎样追加、读取和恢复 |
| [`src/types/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/types/index.ts) | 运行选项与结果类型 | timeout/cache/abort 和结果字段 |

## 完整调用链

![Promptfoo 原子测试的运行与持久化](../../assets/diagrams/harnesses/promptfoo/runtime.svg)

1. Evaluator 合并 default tests 与 scenarios，准备变量并应用 input transform，得到 AtomicTestCase 列表。
2. 变量数组经 `generateVarCombinations` 展开，随后按 Provider 和 Prompt 生成 RunEvalOptions。resume 模式会读取已有结果并过滤已完成坐标。
3. `adjustConcurrencyForSerialFeatures` 检查 conversation 变量、`storeOutputAs` 和浏览器持久会话。任何一步依赖前一步状态时，最大并发被改成 1；其余步骤进入 `forEachOfLimit`。
4. 调度器为每步检查 abort/global duration，并给单步包裹 timeout；共享 RateLimitRegistry 可以根据 Provider 的限流反馈调整并发。
5. `runEval` 创建状态，渲染 prompt，构造 Provider context，调用 Provider，再处理 trace、delay、transform、空响应与 grading。
6. `EvaluateResult` 先更新 prompt metrics 和全局 stats，然后追加到 Store 与 JSONL writer。数据库追加失败会登记 persistence failure；之后在内存保留权威副本，供终局合并覆盖陈旧行。
7. 中断时保存已完成进度；目标被判定不可用时结束剩余步骤并保存当前结果。最终 Store 汇集结果、prompts、vars 与统计。

## 关键数据结构

运行坐标由 `testIdx + promptIdx + provider + vars` 共同确定，不能只用数组序号。`EvalProcessingContext` 持有 concurrency、共享变量集合、目标不可用状态等本次运行状态。`EvaluateResult` 同时保存 testCase、prompt、provider、response、gradingResult、success、score、namedScores、failureReason、latency 与 tokenUsage。Store 提供 `appendResult`、`readResults`、`hasResultPersistenceFailure`、`recordFinalResult` 等接口，使 Evaluator 不绑定某个数据库。

Prompt metrics 是对结果行的派生汇总。它们适合报告，但不能替代行级证据：总通过数无法回答哪条输入失败、是否缓存命中、哪个 Provider 返回错误，或一次比较断言怎样改变最终得分。

## 实现取舍与失败语义

受限并发提升吞吐，串行特性检测保护有状态语义；难点是任何未声明的共享状态都可能绕过检测。自适应限流减少持续 429，但重排等待时间可能影响时间相关指标，因此 latency 的解释要区分排队与 Provider 调用。单步 timeout 生成一条失败结果，全局 max duration 则可能让剩余步骤从未产生结果，这两种缺口不能只看失败率区分。

持久化采用“数据库 + 流式 JSONL + 失败后内存权威副本”的韧性策略。它降低进程中后段丢结果风险，但恢复合并仍需稳定坐标与去重规则。中断保存是运行恢复能力，不应把同一逻辑测试恢复后的多次底层调用统计成多个独立 Trial。

## 动手实验

构造六个 RunEvalOptions：前三个无状态，第四个写 `storeOutputAs`，第五个读取该值，第六个使用 conversation 变量。分别给出并发 3 和并发 1 时允许的执行顺序，指出哪一种保持语义。再模拟第三条结果数据库写失败但 JSONL 成功，写出终局恢复时需要的合并键和优先级。最后区分 Provider 500、断言失败、单步超时、全局到时和用户中断应产生的证据。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

前三个无状态步骤可受限并发；出现跨步骤存取或会话历史后，相关序列必须保持顺序，当前实现会把整次运行并发降为 1，以简单规则换正确性。恢复键至少要包含稳定运行身份与 test/prompt/provider/vars 坐标；当数据库已报告持久化失败，最终内存/流式权威行应覆盖数据库陈旧行，但重复行必须去重。

Provider 500 是目标错误；断言失败是有效响应未满足判据；单步超时应有对应结果行；全局到时意味着已完成行之外存在未运行步骤；用户中断还应记录终止原因。把后四种都显示成红色可以，但机器可读原因必须不同。

## 如何核对

在 [`src/evaluator.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator.ts#L2934-L2969) 核对 `adjustConcurrencyForSerialFeatures`、`runSerialEvalSteps`、`runConcurrentEvalSteps`、`processEvalStepWithTimeout`、`persistEvalRow` 与 `saveInterruptedEval`；在 [`src/evaluator/runtime.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator/runtime.ts) 核对 Store 的读取、追加和 persistence failure 契约。

## 本篇不能证明什么

存在 resume、JSONL 和自适应限流不能证明恰好一次执行、跨进程事务完整、远程 Provider 幂等或中断后统计无偏。课程也没有对真实 API 做故障注入；这些属于部署环境中的专项验证。

[上一节](01-config-provider-prompt.md) · [下一节](03-assertion-results-ci.md)
