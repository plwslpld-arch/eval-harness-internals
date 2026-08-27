# 最小 Eval Loop：从冻结规范到可复核报告

[上一节](../foundations/07-eval-to-rl-and-release-eval.md) · [下一节](02-run-identity-and-reproducibility.md)

## 本篇要解决什么问题

一个 Eval Loop 最容易被写成「读数据、调用模型、算平均分」三行伪代码，可这种写法会把决定结果能否复核的责任全部藏起来。在真正运行之前，实现必须固定样本与 Target 身份，还要让每个计划项都拥有稳定的 Trial。一旦基础设施失败，系统就得留下 Attempt，而 Target 输出也要进入 Trace 与 Artifact，否则后续判断根本没有可追溯的依据。Scorer 只能读取明确的 Observation，Metric 需要保留预声明分母，而 Gate 不能直接相信 Target 自报的 success。本篇会沿着 Reference Harness 的运费边界案例，把这些看似分散的责任串成一条完整闭环。

只要具备 Python 基础并熟悉前七篇的共同术语，你就可以从 CLI 一直追到 JSON/Markdown/HTML 报告，再指出某个结果究竟在哪一层改变了状态。Reference Harness 只是教学简化。它虽然不实现分布式队列或真实模型调用，但每个关键对象都承载了一项在生产系统中无法绕开的责任。

## 核心机制

![从 EvalSpec 到 Gate 的最小闭环](../assets/diagrams/foundations/02-eval-spec-flow.svg)

`PipelineConfig` 会先冻结 evaluation_id、Dataset 路径、Target Adapter、repetition、Scorer 和 Gate，然后 `plan_trials` 才将 sample × target × repetition 物化为具体计划，因此分母在执行开始前就已经确定。`run_trial_batch` 以有限的本地并发度执行计划，却依然按计划顺序返回结果，所以并发不会改写试验坐标。在每个 Trial 内部，`run_trial` 负责管理基础设施 Attempt，一旦获得成功输出，就会形成两个 TraceEvent 和内容寻址 Artifact，最后由 `build_observation_bundle` 把它们绑定到 canonical Attempt。

评分器 `FieldMatchesExpectedScorer` 只从 `target_completed` 事件中取出 output 与 expected，因为 Target 的自我评价不能当作独立证据。`aggregate_pass_rate` 以计划中的 Trial ID 作为 denominator，即使某个 Trial 缺少 Score，也不会因此缩小分母。`evaluate_gate` 先检查无效或不可评分证据，再应用预声明 threshold，而 `write_report` 则从同一份 EvaluationReport 生成机器可读 JSON、审阅用 Markdown 和独立 HTML。

## 完整流程

以 `reference/examples/shipping/eval.yaml` 为入口：

1. CLI `run` 检查配置路径，将错误压缩为中文消息而不泄漏 traceback。
2. Pipeline 在配置目录内安全解析 dataset/script，拒绝绝对路径和 `..` 越界。Dataset JSONL 每行验证为 Sample。
3. Planner 为三个金额、两个 Target、一次 repetition 生成六个稳定 Trial。Trial ID 包含运行、Target、Sample 与重复身份。
4. SubprocessTarget 通过 argv 和 stdin JSON 调用本地脚本，禁用 shell。超时/启动失败抛 InfrastructureError，非零退出或非 JSON 输出是 product failure。
5. Runner 只重试 InfrastructureError。一旦 Target 返回有效产品失败或完成结果，就建立唯一 canonical Attempt，不用重试「刷过」。
6. TraceWriter 强制事件序号和父事件存在。ArtifactStore 以 SHA-256 命名输出。ObservationBundle 摘要覆盖 Trial、Attempt、事件与 Artifact 引用。
7. Scorer、Metric 和 Gate 逐层产生不可变对象。报告与 evidence/run 文件最后写入输出目录。

## 关键数据与不变量

整条链路可以按责任分为四组：计划对象是 `EvaluationSpec → Sample → Trial`，执行对象是 `Attempt → TrialResult`，证据对象是 `TraceEvent → ArtifactRef → ObservationBundle`，而判断对象是 `ScoreRecord → MetricEstimate → GateDecision`。这些对象一旦串起来，就必须保持几条不变的关系：一个 Trial 最多一个 canonical Attempt，Bundle 只能绑定该 Attempt，而 Score 必须携带 Bundle digest 与 scorer_id。Metric denominator 必须来自 Trial plan——否则缺失证据会悄悄改写分母，Gate 也不能把 invalid/unscorable 证据强行变成 passed。

错误状态也不能压成一个布尔值，因为 Attempt 有 succeeded/infra_failed/cancelled，Trial 有 completed/blocked/invalid，Score 有 passed/failed/uncertain/unscorable/invalid，Gate 还有 passed/failed/blocked/inconclusive。因此，报告中显示的「fixed-release passed」是 Gate 做出的结论，并不是脚本退出码的另一种写法。

## 动手实验

从仓库根目录运行：

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/shipping
uv run eval-harness-ref inspect output/shipping
uv run eval-harness-ref score output/shipping
uv run eval-harness-ref gate output/shipping
```

打开 `output/shipping/evidence.json` 后，先任选金额 100 的 buggy Trial，沿 trial_id → canonical_attempt_id → bundle digest → score_id → metric_id → gate_id 写出完整链路。接着修改输出 Artifact 的一个字节，再运行 inspect，观察摘要门禁如何拦下被改写的证据。

## 预期输出与答案

运行后会看到 `buggy-release：failed` 与 `fixed-release：passed`，计划中共有 6 个 Trial，两个 pass-rate 的 denominator 各为 3。金额 100 的 buggy 输出是 fee=10，期望则是 fee=0，所以该项 Score failed，buggy 的通过数也只有 2/3，低于 minimum=1.0。一旦 Artifact 被篡改，inspect 就应当以「Artifact 摘要不一致」失败，而不是继续显示原来的 Gate。

重新运行 score/gate 时不会再跑 Target，因为它们只消费已经冻结的 evidence。这正是「执行证据」与「政策判定」能够分离的原因，但在开始重新判定之前，evidence 必须先通过完整性检查。

## 如何核对

从 [`cli.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/cli.py) 的 `run` 进入 [`pipeline.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/pipeline.py)，依次追 `_load_samples`、`plan_trials`、`run_trial_batch`、`build_observation_bundle`、scorer、metric、gate 和 `write_report`。测试入口是 [`test_shipping_e2e.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_shipping_e2e.py) 与 [`test_cli.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_cli.py)。

## 本篇不能证明什么

确定性案例全绿，只能证明这套小型实现满足当前的测试合同，它既不能证明真实模型稳定或数据集代表线上分布，也不能证明当前并发方式适合大规模运行。它更不能授权生产发布。Reference Harness 提供的是一种可执行的共同语言，而不是企业控制面。

[上一节](../foundations/07-eval-to-rl-and-release-eval.md) · [下一节](02-run-identity-and-reproducibility.md)
