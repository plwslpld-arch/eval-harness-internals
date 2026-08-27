# Eval Harness 源码内核：完整目录

第一次读这套教材，建议你从[学习入口](00-start-here.md) 开始，先跟着运费案例跑完整条证据链，再决定后面要往哪里深挖。目录依次安排了「共同语言 → 最小实现 → 上游源码 → 工程专题 → 横向比较 → 案例与实验」，按这个顺序读，你就不会一开始便钻进各种工具名称，更不会把某个项目自己的叫法当成通用语义。

## 入口

- [开始学习](00-start-here.md)：贯穿案例、阅读约定和第一次运行；
- [学习路线](learning-paths.md)：新人、源码阅读、Agent 评测和 Eval-to-RL 路径；
- [仓库首页](https://github.com/plwslpld-arch/eval-harness-internals)：项目定位、内容地图和快速命令；
- [完整中文 PDF](downloads/eval-harness-internals-cn.pdf)：可离线阅读的整书版本；
- [第三方来源](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/THIRD_PARTY.md)：锁定提交、许可证与引用边界。

## 第一部分：基础篇

1. [Agent Harness 与 Eval Harness](foundations/01-agent-vs-eval-harness.md)
2. [Task、Dataset、Target 与 Environment](foundations/02-task-dataset-target-environment.md)
3. [Sample、Trial 与 Attempt](foundations/03-sample-trial-attempt.md)
4. [Trace、Artifact 与 Observation](foundations/04-trace-artifact-observation.md)
5. [Scorer、Judge、Score 与 Metric](foundations/05-scorer-judge-score-metric.md)
6. [不确定性、比较与 Gate](foundations/06-uncertainty-comparison-gate.md)
7. [Eval-to-RL 与独立发布评测](foundations/07-eval-to-rl-and-release-eval.md)

## 第二部分：可运行参考

- [运费边界案例](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/reference/examples/shipping/README.md)
- [`eval-harness-ref` 命令入口](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/cli.py)
- [Reference Harness 自动化测试](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_shipping_e2e.py)

Reference Harness 用一份最小合同把 Trial/Attempt、Trace、按内容寻址的 Artifact、Observation、Score、Metric、Comparison、Gate 和离线报告串了起来。你可以拿它检验教材里讲的机制，但不能因此宣称它复刻了某套上游工具。这条边界不能越过。

## 第三部分：上游源码课程

1. [lm-evaluation-harness：Task 怎样变成批量模型请求](harnesses/lm-evaluation-harness/README.md)
2. [Inspect AI：Solver、Sandbox、Scorer 与 EvalLog](harnesses/inspect-ai/README.md)
3. [OpenAI Evals：Registry、CompletionFn 与 Recorder](harnesses/openai-evals/README.md)
4. [Promptfoo：配置矩阵、Provider、Assertion 与 CI](harnesses/promptfoo/README.md)
5. [DeepEval：Golden、TestCase、Metric 与执行策略](harnesses/deepeval/README.md)
6. [Harbor 与 Terminal-Bench 1：环境、Agent、Verifier 与 Trial](harnesses/harbor-terminal-bench/README.md)

每条源码课程都先用导读带你进门，再分三篇往深处讲。正文会对着锁定的提交，依次找到源码从哪里进入、调用怎样往下走、哪些数据结构最关键，以及失败如何一层层传出来，然后再让你用实验、预期输出和参考答案检验自己是否真的看懂了这些设计取舍。别只记名词。

## 第四部分：工程篇

1. [最小 Eval Loop](engineering/01-minimal-eval-loop.md)
2. [Run Identity 与可复现性](engineering/02-run-identity-and-reproducibility.md)
3. [Retry 与 Recovery](engineering/03-retries-and-recovery.md)
4. [LLM-as-a-Judge](engineering/04-llm-as-judge.md)
5. [统计比较](engineering/05-statistical-comparison.md)
6. [Agent Environment](engineering/06-agent-environments.md)
7. [Quality Gate](engineering/07-quality-gates.md)
8. [Eval-to-RL](engineering/08-eval-to-rl.md)

## 第五部分：横向比较

1. [Task、Dataset 与 Target](comparisons/01-task-dataset-target.md)
2. [Runner、并发、缓存与 Retry](comparisons/02-runner-concurrency-cache-retry.md)
3. [Trace、Artifact 与血缘](comparisons/03-trace-artifact-lineage.md)
4. [Scorer、Judge 与 Outcome](comparisons/04-scorer-judge-outcomes.md)
5. [Metric、统计单位与不确定性](comparisons/05-metric-statistics-uncertainty.md)
6. [Agent Environment 与 Final State](comparisons/06-agent-environment-final-state.md)
7. [Report、CI 与 Release Gate](comparisons/07-report-ci-release-gate.md)
8. [平台适配器边界](comparisons/08-platform-adapters.md)

## 第六部分：案例

- [运费边界](cases/shipping-boundary.md)
- [退款 Agent](cases/refund-agent.md)
- [企业知识助手](cases/knowledge-assistant.md)
- [合同审查 Agent](cases/contract-review-agent.md)
- [SWE-bench 补丁评测机制](cases/swe-bench-mechanism.md)

前四个案例都准备了结果确定的 buggy/fixed Target，你也可以直接把门禁跑起来。SWE-bench 则把重心放在环境怎样影响机制，你会看到补丁、隔离环境、测试证据和实例级判定如何互相约束。

## 第七部分：实验

1. [运行一份确定性 Eval](labs/01-run-one-deterministic-eval.md)
2. [新增 Target Adapter](labs/02-add-a-target-adapter.md)
3. [编写 Scorer](labs/03-write-a-scorer.md)
4. [重复运行并比较](labs/04-repeat-and-compare.md)
5. [导入 Agent Trace](labs/05-evaluate-an-agent-trace.md)
6. [构建 Release Gate](labs/06-build-a-release-gate.md)

## 附录

- [术语表](appendices/glossary.md)
- [验证与证据边界](appendices/verification.md)
- [来源与许可证](appendices/source-and-license-boundaries.md)

## 怎样读一篇源码课

读源码课时，先查清课程锁定了哪个版本，并找到入口，然后顺着调用链逐站追问：谁发起调用，传进来什么，状态在哪里变了，结果怎样返回，失败又怎样传出去，以及哪组测试锁住了这些行为。读完再跑一遍本仓库的确定性实验，拿实际输出检验自己是否看懂了机制，别只记住 API。
