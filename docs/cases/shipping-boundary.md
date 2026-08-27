# 案例一：运费边界错误怎样形成完整评测证据

[上一节](../comparisons/07-report-ci-release-gate.md) · [下一节](refund-agent.md)

## 本篇要解决什么问题

订单满 100 元就该免运费，旧实现写的却是 `amount > 100`，所以订单金额恰好等于 100 元时仍会收费。这个 bug 虽然很小，却正好能把 Eval Harness（评测框架）怎样构造边界样本、比较两个 Target、识破脚本自报成功的假象，以及怎样在 Artifact 被篡改或关键边界出错时阻断结果串起来讲清楚。小问题同样需要完整证据。即使总成绩有 2/3，另外两条通过记录也抹不掉关键边界上的错误。Agent Harness 姊妹仓库研究 Agent 怎样修改代码，本仓库则只研究该怎样设计并判定这组实验。

只要你已经理解最小 Eval Loop，就可以照着本篇跑一遍案例，手工核对六个 Trial，再把这套做法迁移到价格、配额、年龄或日期的边界上。

## 核心机制

![运费边界案例的数据与判定流](../assets/diagrams/cases/shipping.svg)

Dataset 固定 99、100、101 三个边界点，对应的 expected fee 依次为 10、0、0。Buggy 和 Fixed Target 都通过同一个 SubprocessTarget 调用，这样两者就不会因为执行路径不同而影响比较。Scorer（评分器）只比较 output.fee 与 Sample expected.fee，而 Gate（门禁）要求 pass-rate=1.0，所以任意一个边界出错都会阻断结果。

这三个样本代表不了全部订单，它们只演示怎样围绕边界选测试点。边界前、边界点和边界后缺一不可，关键合同还要设置非补偿门禁，不然大量普通样本很容易把这个边界上的失败稀释掉。三个点必须一起看。

## 完整流程

1. `eval.yaml` 冻结 Dataset、两个脚本、field scorer 和 minimum=1.0；
2. 三个 Sample 与两个 Target 展开为六个 Trial，repetition=1。
3. Runner 以 stdin JSON 传入 amount，脚本 stdout 返回 JSON fee；
4. 每个输出写 TraceEvent 和 Artifact；Bundle 绑定 canonical Attempt。
5. Scorer 读取 output/expected 的 fee：buggy 在 amount=100 得 failed，其余 passed；fixed 三条全 passed；
6. Metric 分母按每个 Target 三个计划 Trial 计算，分别为 2/3 与 3/3。
7. Gate 输出 buggy failed、fixed passed；compare 按三个 Sample 配对，平均改进 1/3；
8. inspect 重算 Artifact digest；任何产物被改动，旧报告不能继续作为有效证据。

## 关键数据与不变量

Sample ID 应当说清它表示哪个逻辑边界，不能只存一个数组序号。Target identity 要带上脚本和解释器，Trial ID 则把 Sample、Target 与 repetition 固定成一个组合。Score 必须引用 Bundle（证据包）digest，Metric denominator 也要固定为 3，这样以后看到某个汇总值时，才能一路追回支撑它的证据。产品算错 fee 会得到一个有效的 failed，只有脚本启动失败才算 infra Attempt。只要换了 Scorer field、expected 或 threshold，就必须生成新的身份或政策版本。

## 动手实验

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/shipping-case
uv run eval-harness-ref compare output/shipping-case --candidate-target fixed --baseline-target buggy --seed 17 --iterations 2000
uv run eval-harness-ref inspect output/shipping-case
```

打开 Dataset 和两个脚本，先手算每条输入会得到什么输出，再新增 amount=0 与 amount=100.01。注意，运行前要先写下 expected，还要说明为什么加入新样本后，Metric 的分母和 comparison pair_count 都会跟着改变。

## 预期输出与答案

Buggy 只通过 2/3，所以 Gate failed，Fixed 则通过 3/3，因此 Gate passed。三组配对的差值是 `[0,1,0]`，平均值为 0.3333，但样本实在太少，这个区间能说明的信息仍然有限。再加两条样本后，每个 Target 的 denominator 和 pair_count 都会变成 5，Dataset identity 也要随之更新，所以不能拿新结果覆盖旧 run。

若把 Gate 降到 0.6，buggy 按总比例算可能通过，但「金额恰好 100」已经写进明确的业务合同，所以你得为这个关键边界配置 noncompensatory check，不能只盯着总体比例。

## 如何核对

先阅读 [`eval.yaml`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/reference/examples/shipping/eval.yaml)、[`dataset.jsonl`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/reference/examples/shipping/dataset.jsonl) 和两个 Target。等你手工推导出各个边界会返回什么，再运行 [`test_shipping_e2e.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_shipping_e2e.py)：

```bash
uv run pytest tests/test_shipping_e2e.py -q
```

## 本篇不能证明什么

三条确定性样本只能证明系统在冻结规则下怎样处理这些边界。真实计价服务还会遇到税费、币种、促销、并发和生产配置，这组实验没有验证它们是否正确，也不代表系统已经获得发布授权。

[上一节](../comparisons/07-report-ci-release-gate.md) · [下一节](refund-agent.md)
