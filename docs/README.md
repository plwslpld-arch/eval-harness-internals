# Eval Harness 源码内核：文档目录

本目录按“先建立共同语言，再运行最小实现，然后读上游源码，最后做比较与案例”的顺序组织。第一次阅读请从[学习入口](00-start-here.md)开始；不要直接从某个工具名进入，否则很容易把上游项目自己的命名误认为通用语义。

## 入口

- [开始学习](00-start-here.md)：贯穿案例、阅读方法和第一次运行；
- [学习路线](learning-paths.md)：新人、源码阅读、Agent 评测和 Eval-to-RL 路径；
- [仓库首页](../README.md)：定位、边界和快速命令；
- [第三方来源](../THIRD_PARTY.md)：锁定 commit、许可证与引用边界。

## 基础篇

1. [Agent Harness 与 Eval Harness](foundations/01-agent-vs-eval-harness.md)
2. [Task、Dataset、Target 与 Environment](foundations/02-task-dataset-target-environment.md)
3. [Sample、Trial 与 Attempt](foundations/03-sample-trial-attempt.md)
4. [Trace、Artifact 与 Observation](foundations/04-trace-artifact-observation.md)
5. [Scorer、Judge、Score 与 Metric](foundations/05-scorer-judge-score-metric.md)
6. [不确定性、比较与 Gate](foundations/06-uncertainty-comparison-gate.md)
7. [Eval-to-RL 与独立 Release Eval](foundations/07-eval-to-rl-and-release-eval.md)

## 可运行参考

- [运费边界案例](../reference/examples/shipping/README.md)
- [`eval-harness-ref` 源码](../src/eval_harness_reference/cli.py)
- [Reference Harness 自动化测试](../tests/test_shipping_e2e.py)

## 上游源码课程

1. [lm-evaluation-harness：Task 怎样变成批量模型请求](harnesses/lm-evaluation-harness/README.md)
2. [Inspect AI：Solver、Sandbox、Scorer 与 EvalLog](harnesses/inspect-ai/README.md)
3. [OpenAI Evals：Registry、CompletionFn 与 Recorder](harnesses/openai-evals/README.md)
4. [Promptfoo：配置矩阵、Provider、断言与 CI](harnesses/promptfoo/README.md)
5. [DeepEval：Golden、TestCase、Metric 与执行策略](harnesses/deepeval/README.md)
6. [Harbor 与 Terminal-Bench 1：环境、Agent、Verifier 与 Trial](harnesses/harbor-terminal-bench/README.md)

## 工程篇

1. [最小 Eval Loop](engineering/01-minimal-eval-loop.md)
2. [Run Identity 与可复现性](engineering/02-run-identity-and-reproducibility.md)
3. [Retry 与 Recovery](engineering/03-retries-and-recovery.md)
4. [LLM-as-a-Judge](engineering/04-llm-as-judge.md)
5. [统计比较](engineering/05-statistical-comparison.md)
6. [Agent Environment](engineering/06-agent-environments.md)
7. [Quality Gate](engineering/07-quality-gates.md)
8. [Eval-to-RL](engineering/08-eval-to-rl.md)

## 横向比较

1. [Task、Dataset 与 Target](comparisons/01-task-dataset-target.md)
2. [Runner、并发、缓存与 Retry](comparisons/02-runner-concurrency-cache-retry.md)
3. [Trace、Artifact 与血缘](comparisons/03-trace-artifact-lineage.md)
4. [Scorer、Judge 与 Outcome](comparisons/04-scorer-judge-outcomes.md)
5. [Metric、统计单位与不确定性](comparisons/05-metric-statistics-uncertainty.md)
6. [Agent Environment 与 Final State](comparisons/06-agent-environment-final-state.md)
7. [Report、CI 与 Release Gate](comparisons/07-report-ci-release-gate.md)

## 贯穿案例

- [运费边界](cases/shipping-boundary.md)
- [退款 Agent](cases/refund-agent.md)
- [企业知识助手](cases/knowledge-assistant.md)
- [合同审查 Agent](cases/contract-review-agent.md)

## 实验

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

每篇核心课程都区分“上游源码事实”“机制解释”“教学简化”“外部契约”和“不可核对”。先看锁定版本与入口，再沿调用链逐站回答：谁调用、输入是什么、状态在哪里改变、返回什么、失败怎样传播、哪组测试锁住行为。最后运行本仓库的确定性实验，验证你理解的是机制而不是 API 记忆。
