# 最小 Eval Loop：从冻结规范到可复核报告

[上一节](../foundations/07-eval-to-rl-and-release-eval.md) · [下一节](02-run-identity-and-reproducibility.md)

## 本篇要解决什么问题

一个 Eval Loop 最容易被写成“读数据、调用模型、算平均分”三行伪代码。真正可复核的实现至少要回答：运行前怎样固定样本和 Target 身份；每个计划项怎样拥有稳定 Trial；基础设施失败怎样留下 Attempt；Target 输出怎样进入 Trace 与 Artifact；Scorer 怎样只读取明确 Observation；Metric 怎样保留预声明分母；Gate 为什么不能直接读取 Target 自报的 success。本篇用 Reference Harness 的运费边界案例贯穿完整闭环。

前置知识是 Python 基础和前七篇共同术语。读完后，你应能从 CLI 一直追到 JSON/Markdown/HTML 报告，并能指出某个结果在哪一层改变状态。Reference Harness 是教学简化：它不实现分布式队列或真实模型调用，但每个关键对象都对应生产系统中必须解决的责任。

## 核心机制

![从 EvalSpec 到 Gate 的最小闭环](../assets/diagrams/foundations/02-eval-spec-flow.svg)

`PipelineConfig` 冻结 evaluation_id、Dataset 路径、Target Adapter、repetition、Scorer 和 Gate。`plan_trials` 物化 sample × target × repetition，确保分母先于执行确定。`run_trial_batch` 以有限本地并发执行，但返回顺序仍与计划一致；每个 Trial 内部由 `run_trial` 管理基础设施 Attempt。成功输出形成两个 TraceEvent 和内容寻址 Artifact，再由 `build_observation_bundle` 绑定 canonical Attempt。

评分器 `FieldMatchesExpectedScorer` 从 `target_completed` 事件取 output 与 expected，不信任 Target 的自我评价。`aggregate_pass_rate` 用计划 Trial ID 作为 denominator，缺少 Score 不会缩小分母。`evaluate_gate` 先检查无效/不可评分证据，再应用预声明 threshold。`write_report` 从同一 EvaluationReport 生成机器可读 JSON、审阅用 Markdown 和独立 HTML。

## 完整流程

以 `reference/examples/shipping/eval.yaml` 为入口：

1. CLI `run` 检查配置路径，将错误压缩为中文消息而不泄漏 traceback。
2. Pipeline 在配置目录内安全解析 dataset/script，拒绝绝对路径和 `..` 越界；Dataset JSONL 每行验证为 Sample。
3. Planner 为三个金额、两个 Target、一次 repetition 生成六个稳定 Trial；Trial ID 包含运行、Target、Sample 与重复身份。
4. SubprocessTarget 通过 argv 和 stdin JSON 调用本地脚本，禁用 shell；超时/启动失败抛 InfrastructureError，非零退出或非 JSON 输出是 product failure。
5. Runner 只重试 InfrastructureError；一旦 Target 返回有效产品失败或完成结果，就建立唯一 canonical Attempt，不用重试“刷过”。
6. TraceWriter 强制事件序号和父事件存在；ArtifactStore 以 SHA-256 命名输出；ObservationBundle 摘要覆盖 Trial、Attempt、事件与 Artifact 引用。
7. Scorer、Metric 和 Gate 逐层产生不可变对象；报告与 evidence/run 文件最后写入输出目录。

## 关键数据与不变量

计划对象是 `EvaluationSpec → Sample → Trial`；执行对象是 `Attempt → TrialResult`；证据对象是 `TraceEvent → ArtifactRef → ObservationBundle`；判断对象是 `ScoreRecord → MetricEstimate → GateDecision`。必须保持：一个 Trial 最多一个 canonical Attempt；Bundle 只能绑定该 Attempt；Score 必须携带 Bundle digest 与 scorer_id；Metric denominator 来自 Trial plan；Gate 不能把 invalid/unscorable 证据变成 passed。

错误状态分层也不能压成一个布尔值。Attempt 有 succeeded/infra_failed/cancelled，Trial 有 completed/blocked/invalid，Score 有 passed/failed/uncertain/unscorable/invalid，Gate 有 passed/failed/blocked/inconclusive。报告显示的“fixed-release passed”是 Gate 结论，不是脚本退出码。

## 动手实验

从仓库根目录运行：

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/shipping
uv run eval-harness-ref inspect output/shipping
uv run eval-harness-ref score output/shipping
uv run eval-harness-ref gate output/shipping
```

打开 `output/shipping/evidence.json`，任选金额 100 的 buggy Trial，沿 trial_id → canonical_attempt_id → bundle digest → score_id → metric_id → gate_id 写出链路。然后修改输出 Artifact 的一个字节，再运行 inspect，观察摘要门禁。

## 预期输出与答案

运行会报告 `buggy-release：failed`、`fixed-release：passed`；计划 Trial 为 6，两个 pass-rate 的 denominator 各为 3。金额 100 的 buggy 输出 fee=10，期望 fee=0，因此 Score failed；buggy 的通过数 2/3，低于 minimum=1.0。篡改 Artifact 后 inspect 应以“Artifact 摘要不一致”失败，而不是仍显示原 Gate。

若重新 score/gate，不会重跑 Target；它们只消费冻结 evidence。这展示“执行证据”和“政策判定”可分离，但前提是 evidence 先通过完整性检查。

## 如何核对

从 [`cli.py`](../../src/eval_harness_reference/cli.py) 的 `run` 进入 [`pipeline.py`](../../src/eval_harness_reference/pipeline.py)，依次追 `_load_samples`、`plan_trials`、`run_trial_batch`、`build_observation_bundle`、scorer、metric、gate 和 `write_report`。测试入口是 [`test_shipping_e2e.py`](../../tests/test_shipping_e2e.py) 与 [`test_cli.py`](../../tests/test_cli.py)。

## 本篇不能证明什么

确定性案例全绿只证明这套小型实现满足其测试合同，不证明真实模型稳定、数据集代表线上分布、并发适合大规模运行或 Gate 可以授权生产发布。Reference Harness 是可执行共同语言，不是企业控制面。

[上一节](../foundations/07-eval-to-rl-and-release-eval.md) · [下一节](02-run-identity-and-reproducibility.md)
