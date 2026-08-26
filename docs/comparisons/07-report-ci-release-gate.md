# 横向比较七：Report、CI 与 Release Gate

[上一节](06-agent-environment-final-state.md) · [下一节](../cases/shipping-boundary.md)

## 本篇要解决什么问题

一个 Harness 能生成 HTML、上传平台或让 CI 退出非零，并不代表它已经实现组织级发布门禁，因为 Report 负责呈现证据，CI 负责自动执行，Release Gate 才负责按照冻结政策作出判定，而部署授权还排在它们之后。Promptfoo 强调 CI assertions，DeepEval 支持 pytest，Inspect/OpenAI Evals 保存日志，Harbor 汇总 reward，lm-eval 输出 benchmark metric。它们都是 Gate 的构件，却不是同一种治理能力。

## 核心机制

![从断言结果到发布 Gate](../assets/diagrams/harnesses/promptfoo/assertion-ci.svg)

在统一分层中，Artifact/Score 是行级证据，Metric/Comparison 给出统计结论，Report 只是查看这些内容的视图，GateDecision 才是机器可读的政策结果，而 CI 只是承载执行的通道。Gate 必须先验证 evidence admissibility，再应用 threshold/margin/critical checks——网页上的绿勾或测试进程返回 0，都不能替代 GateDecision lineage。

| Harness | 报告/CI 入口 | 适合做什么 | 仍需补齐 |
| --- | --- | --- | --- |
| lm-eval | result JSON/table | benchmark 对比 | 关键风险与发布政策 |
| Inspect | EvalLog/viewer | 深入 sample/trace 审阅 | 组织 Gate DAG |
| OpenAI Evals | Recorder/final report | 事件审计与指标 | 完整性/不确定性政策 |
| Promptfoo | assertions/threshold/CI | 应用回归检查 | 统计与缺失分层 |
| DeepEval | assert_test/pytest/report | 测试式门禁 | Dataset 分母与 release 隔离 |
| Harbor/TB | reward/results/pass@k | Agent 任务结果 | 发布风险组合与授权 |

## 完整流程

1. CI 锁定代码、来源和环境，运行 Eval，不使用浮动分支。
2. 先检查计划完整、Artifact/Trace 摘要、错误率和 Scorer identity。
3. 生成 Metric/Comparison，保存机器 JSON 与人类报告。
4. Gate 应用版本化政策，输出 passed/failed/blocked/inconclusive 和 evidence IDs。
5. CI 根据状态失败或请求人工复核。报告作为 artifact 发布。
6. 组织发布系统读取已批准 Gate，但仍执行权限、变更窗口和回滚流程。

## 关键数据与不变量

Report 可以随时重新渲染，因此不能成为唯一证据源，而 GateDecision 必须绑定 policy version、metric IDs 与 run identity。每次 CI rerun 都要产生新的 Run/Attempt 记录，不能覆盖原来的失败历史。Badge 只显示最新门禁状态，既不能证明任意 commit 的状态，也不能证明生产环境与评测环境一致。

## 动手实验

运行完整闭环并查看三种报告：

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/report-demo
uv run eval-harness-ref inspect output/report-demo
```

比较 `report.json`、`report.md` 和 `report.html`，找出三者共同引用的 Gate ID 与 Metric ID，然后删除一个 Artifact，再执行一次 inspect。

## 预期输出与答案

三种报告来自同一个 EvaluationReport，因此应当显示一致的 Gate，其中 JSON 是机器接口，Markdown/HTML 只是面向人的视图。一旦 Artifact 缺失，运行证据就已经无效，所以旧 HTML 即使仍然显示绿色，也不能继续充当有效 Gate。

## 如何核对

阅读 [`reporting.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/reporting.py)、[`cli.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/cli.py) 和报告测试，确认机器结果如何生成不同视图，再回看 Promptfoo/DeepEval/OpenAI Evals 的报告链。

## 本篇不能证明什么

即使 CI 成功、报告可以访问且 Gate 状态为 passed，也不能据此证明代码已经部署、线上配置与评测配置相同，或者真实用户没有风险。部署与生产验证需要后续的独立证据。

[上一节](06-agent-environment-final-state.md) · [下一节](../cases/shipping-boundary.md)
