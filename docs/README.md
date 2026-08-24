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

## 怎样读一篇源码课

每篇核心课程都区分“上游源码事实”“机制解释”“教学简化”“外部契约”和“不可核对”。先看锁定版本与入口，再沿调用链逐站回答：谁调用、输入是什么、状态在哪里改变、返回什么、失败怎样传播、哪组测试锁住行为。最后运行本仓库的确定性实验，验证你理解的是机制而不是 API 记忆。
