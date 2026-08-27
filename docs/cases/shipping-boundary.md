# 案例一：运费边界错误怎样形成完整评测证据

[上一节](../comparisons/07-report-ci-release-gate.md) · [下一节](refund-agent.md)

## 本篇要解决什么问题

订单满 100 元就应免运费，旧实现却使用 `amount > 100`，所以金额恰好等于 100 元时仍会收费。这个 bug 虽然很小，却足以完整展示 Eval Harness 如何构造边界样本、比较两个 Target、识别脚本自报成功的假象，以及在 Artifact 被篡改或关键边界失败时阻断结果——小问题也需要完整证据。即使总成绩是 2/3，关键边界也不能被另外两条通过记录抹平。Agent Harness 姊妹仓库关心 Agent 怎样修改代码，而本仓库只研究这组实验应该怎样设计与判定。

只要已经理解最小 Eval Loop，你就可以跟着本篇运行案例、手工核对六个 Trial，然后把同一套模式迁移到价格、配额、年龄或日期边界。

## 核心机制

![运费边界案例的数据与判定流](../assets/diagrams/cases/shipping.svg)

Dataset 固定了 99、100、101 三个边界点，对应的 expected fee 依次是 10、0、0，而 Buggy 与 Fixed Target 都经由同一个 SubprocessTarget 调用，从而避免执行路径差异干扰比较。Scorer 只比较 output.fee 和 Sample expected.fee，因为 Gate 要求 pass-rate=1.0，所以任何一个边界失败都会阻断结果。

这三个样本不足以代表全部订单，它们只用来展示测试应该怎样围绕边界构造。边界前、边界点和边界后缺一不可，而且关键合同应当设置非补偿门禁，否则它的失败很容易被大量普通样本稀释。三点必须一起看。

## 完整流程

1. `eval.yaml` 冻结 Dataset、两个脚本、field scorer 和 minimum=1.0；
2. 三个 Sample 与两个 Target 展开为六个 Trial，repetition=1。
3. Runner 以 stdin JSON 传入 amount，脚本 stdout 返回 JSON fee；
4. 每个输出写 TraceEvent 和 Artifact；Bundle 绑定 canonical Attempt。
5. Scorer 读取 output/expected 的 fee：buggy 在 amount=100 得 failed，其余 passed；fixed 三条全 passed；
6. Metric 分母按每个 Target 三个计划 Trial计算，分别为 2/3 与 3/3。
7. Gate 输出 buggy failed、fixed passed；compare 按三个 Sample 配对，平均改进 1/3；
8. inspect 重算 Artifact digest；任何产物被改动，旧报告不能继续作为有效证据。

## 关键数据与不变量

Sample ID 应当表达逻辑边界，不应只记录数组序号，同时 Target identity 要包含脚本与解释器，Trial ID 则固定 Sample、Target 和 repetition 的组合。Score 必须引用 Bundle digest，而 Metric denominator 固定为 3，这样后续才能追回每个汇总值所对应的证据。产品 fee 错误会形成有效的 failed，只有脚本启动失败才属于 infra Attempt，而一旦更换 Scorer field、expected 或 threshold，就必须产生新的身份或政策版本。

## 动手实验

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/shipping-case
uv run eval-harness-ref compare output/shipping-case --candidate-target fixed --baseline-target buggy --seed 17 --iterations 2000
uv run eval-harness-ref inspect output/shipping-case
```

打开 Dataset 和两个脚本手算输出，然后新增 amount=0 与 amount=100.01，但在运行之前要先写下 expected，并说明新样本为什么会同时改变 Metric 分母和 comparison pair_count。

## 预期输出与答案

Buggy 的结果是 2/3，因而 Gate failed，而 Fixed 达到 3/3，因而 Gate passed。配对差值为 `[0,1,0]`，平均值是 0.3333，但因为样本极少，所以区间信息仍然有限。新增两条样本后，每个 Target 的 denominator 和 pair_count 都会变成 5，对应的 Dataset identity 也随之更新，因此新结果不能覆盖旧 run。

若把 Gate 降至 0.6，buggy 从数学上看可能通过，但「金额恰好 100」是明确的业务合同，所以设计中应当给这个关键边界配置 noncompensatory check，不能只依赖总体比例。

## 如何核对

先阅读 [`eval.yaml`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/reference/examples/shipping/eval.yaml)、[`dataset.jsonl`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/reference/examples/shipping/dataset.jsonl) 和两个 Target，等手工推导完边界输出后，再运行 [`test_shipping_e2e.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_shipping_e2e.py)：

```bash
uv run pytest tests/test_shipping_e2e.py -q
```

## 本篇不能证明什么

三条确定性样本只能证明冻结规则下的边界行为，至于真实计价服务中的税费、币种、促销、并发和生产配置，这组实验都没有提供正确性证据，更不代表已经获得发布授权。

[上一节](../comparisons/07-report-ci-release-gate.md) · [下一节](refund-agent.md)
