# Promptfoo 测试运行时：展开、串并行与结果落盘

[上一节](01-config-provider-prompt.md) · [下一节](03-assertion-results-ci.md)

## 本篇要解决什么问题

遇到性能问题，人们很容易怪「并发太低」，遇到正确性问题又容易怪「模型随机」，但下判断前得先看懂 Promptfoo 如何生成并调度每个运行步骤。变量数组会把测试展开成更多份，resume 会滤掉已经跑完的步骤，会话历史和跨步骤输出则会逼着相关步骤串行。调度规则从这里开始改变运行语义，而单步超时、全局超时和持久化失败又会留下各自不同的结果。这一篇会跟着一个原子运行往前走，看它怎样从队列进入结果存储，中间状态又怎样随之变化。

你不用背下每个私有函数，应该检查的是计划有没有正确展开、依赖有没有按顺序执行、错误有没有分层，以及最后以哪份结果为准。

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

`testIdx + promptIdx + provider + vars` 合在一起才能定位一次运行，你不能只看它在数组里排第几个。`EvalProcessingContext` 会收住 concurrency、共享变量集合和目标不可用状态，也会跟着记录它们在本次运行中如何变化。`EvaluateResult` 把 testCase、prompt、provider、response、gradingResult、success、score、namedScores、failureReason、latency 和 tokenUsage 收进同一条结果，Store 则通过 `appendResult`、`readResults`、`hasResultPersistenceFailure`、`recordFinalResult` 等接口与 Evaluator 对接。这样 Evaluator 就不用绑死在某一种数据库实现上。

Prompt metrics 可以写进报告做汇总，但它们代替不了每行结果留下的证据。只看总通过数，你既不知道哪条输入失败、有没有命中缓存、究竟是哪个 Provider 报错，也无法追出比较断言怎样改变了分数。

## 实现取舍与失败语义

受限并发可以提高吞吐，检测到状态依赖时改用串行，又能保住有状态语义，但没有声明的共享状态仍然可能漏过检测。自适应限流会减少连续出现的 429，也会重新排列每步等了多久，所以解释 latency 时要把排队时间与 Provider 真正调用的时间分开。单步 timeout 会留下一条失败记录，全局 max duration 却可能让剩下的步骤根本没有结果。只看失败率，这两种缺口就会混在一起。

持久化会同时借助「数据库 + 流式 JSONL + 失败后内存权威副本」，尽量避免进程跑到中后段时丢掉已有结果。恢复时要把这些来源合到一起，仍然必须靠稳定坐标找回同一条运行，再按明确规则去重。中断保存让运行可以恢复，但恢复前后对同一逻辑测试发起的多次底层调用，不能被算成多个独立 Trial。

## 动手实验

构造六个 RunEvalOptions：前三个不读写状态，第四个写入 `storeOutputAs`，第五个读取该值，第六个使用 conversation 变量。请分别排出并发 3 和并发 1 时的执行顺序，再指出哪一种才能保住原有语义。然后模拟第三条结果没能写进数据库，却成功写入 JSONL，据此给出恢复时的合并键和优先级，并分别记录 Provider 500、断言失败、单步超时、全局到时和用户中断。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

前三个无状态步骤可以在限制内并发，但只要出现跨步骤存取或会话历史，相关序列就必须按原顺序跑，当前实现会直接把整次运行的并发降到 1。恢复键不能省，至少要包含稳定的运行身份以及 test/prompt/provider/vars 坐标。如果数据库已经报告持久化失败，最终就应该让内存或流式权威行覆盖数据库中的陈旧行，同时删掉重复记录。

Provider 500 表示目标出错，断言失败说明有效响应没有满足判据，单步超时应该留下结果行，全局到时则说明仍有步骤没来得及运行。如果是用户中断，还要记下为什么终止。界面完全可以把后四种情况都显示成红色，但机器读到的原因必须把它们区分开。

## 如何核对

先在 [`src/evaluator.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator.ts#L2934-L2969) 核对 `adjustConcurrencyForSerialFeatures`、`runSerialEvalSteps`、`runConcurrentEvalSteps`、`processEvalStepWithTimeout`、`persistEvalRow` 与 `saveInterruptedEval`，再到 [`src/evaluator/runtime.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator/runtime.ts) 核对 Store 的读取、追加和 persistence failure 契约。

## 本篇不能证明什么

即使代码里已经有 resume、JSONL 和自适应限流，你也不能据此证明每个动作恰好执行了一次、跨进程事务完整、远程 Provider 能幂等处理请求，或者中断后的统计没有偏差。课程并未对真实 API 注入故障，这些问题都要另做专项验证。

[上一节](01-config-provider-prompt.md) · [下一节](03-assertion-results-ci.md)
