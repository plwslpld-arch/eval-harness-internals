# 横向比较七：Report、CI 与 Release Gate

[上一节](06-agent-environment-final-state.md) · [下一节](../cases/shipping-boundary.md)

## 本篇要解决什么问题

一个 Harness 能生成 HTML、上传平台或让 CI 退出非零，不代表它已经实现组织的发布门禁。Report 负责呈现证据，CI 负责自动执行，Release Gate 负责按冻结政策判定；部署授权还在其后。Promptfoo 强调 CI assertions，DeepEval 支持 pytest，Inspect/OpenAI Evals 保存日志，Harbor 汇总 reward，lm-eval 输出 benchmark metric。它们都是 Gate 构件，而非同一治理能力。

## 核心机制

![从断言结果到发布 Gate](../assets/diagrams/harnesses/promptfoo/assertion-ci.svg)

统一分层：Artifact/Score 是行级证据，Metric/Comparison 是统计结论，Report 是视图，GateDecision 是机器政策结果，CI 只是执行通道。Gate 要先验证 evidence admissibility，再应用 threshold/margin/critical checks。网页绿勾或测试进程 0 不能替代 GateDecision lineage。

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
5. CI 根据状态失败或请求人工复核；报告作为 artifact 发布。
6. 组织发布系统读取已批准 Gate，但仍执行权限、变更窗口和回滚流程。

## 关键数据与不变量

Report 可重新渲染，不能成为唯一证据源。GateDecision 必须绑定 policy version、metric IDs 和 run identity。CI rerun 产生新 Run/Attempt 记录，不能覆盖失败历史。Badge 只显示最新门禁状态，不证明任意 commit 或生产环境。

## 动手实验

运行完整闭环并查看三种报告：

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/report-demo
uv run eval-harness-ref inspect output/report-demo
```

比较 `report.json`、`report.md` 和 `report.html`：找出共同 Gate ID 与 Metric ID；删除一个 Artifact 后再 inspect。

## 预期输出与答案

三种报告来自同一 EvaluationReport，应显示一致 Gate；JSON 是机器接口，Markdown/HTML 是视图。Artifact 缺失使运行证据无效，即使旧 HTML 仍显示绿色，也不能继续当作有效 Gate。

## 如何核对

阅读 [`reporting.py`](../../src/eval_harness_reference/reporting.py)、[`cli.py`](../../src/eval_harness_reference/cli.py) 和报告测试，再回看 Promptfoo/DeepEval/OpenAI Evals 的报告链。

## 本篇不能证明什么

CI 成功、报告可访问和 Gate passed 不能证明代码已部署、线上配置相同或真实用户无风险。部署与生产验证是后续独立证据。

[上一节](06-agent-environment-final-state.md) · [下一节](../cases/shipping-boundary.md)
