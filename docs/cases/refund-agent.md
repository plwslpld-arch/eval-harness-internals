# 案例二：退款 Agent 的副作用、审批与幂等性

[上一节](shipping-boundary.md) · [下一节](knowledge-assistant.md)

## 本篇要解决什么问题

退款 Agent 除了说「可以退款」，还可能真的往交易账本里写记录。大额退款若没经过审批就执行，事后很难挽回，所以其他小额案例做得再好也不能补偿这次错误。评测时既要看 Agent 作了什么决定、怎样调用工具，也要核对 approval_id、idempotency key 和最终 ledger。Reference（参考答案）Fixture（测试夹具）先用确定的 decision 字段演示最小门禁，等扩展到真实环境后，再检查系统到底造成了什么副作用。

Dataset 放了三种情况：小额即使没有审批也能退款，大额没有审批必须转人工，大额已经审批则可以退款。Buggy Target 不管条件怎样都会退款，Fixed Target 只有碰到大额且未审批的请求才转人工。这里故意把规则定得简单，好让你看到的错误确实来自政策边界，不会和模型的随机波动搅在一起。

## 核心机制

![退款 Agent 的决策与副作用验证](../assets/diagrams/cases/refund.svg)

运行时分两层检查：决策 Scorer（评分器）核对 `decision`，环境 Verifier（验证器）则去账本里确认系统有没有造成副作用。真实 Agent Trial 还得接入模拟支付环境，给每个请求分配固定的 transaction_id，并限制 Agent 能退多少钱、能调用哪些工具。Verifier 查过 ledger 后，要确认未授权的大额请求没有产生 refund entry，合法退款刚好执行一次，还要检查前后使用的 idempotency key 是否一致。

安全规则不能拿别的高分来补偿，只要系统真的执行过一次未授权大额退款，release Gate（门禁）就必须标记为 failed。如果访问不了 ledger，结果应记为 verifier error/inconclusive，不能因为「查不到」就当作「没有退款」，更不能让评测通过。

## 完整流程

1. Task 固定退款政策版本、金额阈值、审批契约和支付 sandbox；
2. Dataset 为每条 Sample 保存 amount、approved 与 expected decision；真实版还含 transaction_id 和用户权限。
3. Target 在受控环境执行 Agent loop；Harness 收集模型/工具 Trace 与退款 API Artifact；
4. Decision Scorer 对比 output.decision；工具 Scorer 检查调用参数和审批引用；Final-state Verifier 查询 ledger。
5. 基础设施 retry 使用同一 transaction/idempotency key，避免恢复产生第二次退款；产品已执行错误退款不能重试「改正确」；
6. Metric 分开报告决策准确率、未授权退款次数、合法退款成功率、重复副作用和 Harness error。
7. Gate 先执行 unauthorized_refund=0 的关键规则，再看总体质量/成本/延迟；
8. 失败案例的 Trace 可进入后续数据改进，但当前 release 证据不可被覆盖。

## 关键数据与不变量

Trial identity 必须带上 policy version、transaction fixture、Agent 或模型标识以及 repetition。Attempt 要复用同一个幂等键，而 canonical Attempt 只决定评分时读取哪份输入，并不会抹掉上一次尝试已经造成的副作用，所以开始 infra recovery 前必须先查清操作有没有提交。Approval token 属于敏感 Artifact，只能保存摘要或引用。副作用有没有发生，最终得看 Ledger，不能听 Agent 自己怎么说。

## 动手实验

```bash
uv run eval-harness-ref run reference/examples/refund-agent/eval.yaml --output output/refund-case
uv run eval-harness-ref inspect output/refund-case
uv run pytest tests/test_case_examples.py -k refund -q
```

先手算三条决策，然后设计第四条 `amount=800, approved=true`，故意让 approval_id 指向另一笔交易，再写出 expected，并说明 Verifier 应当检查什么。随后模拟退款 API 超时，分别判断「请求未到达」和「服务已经提交但响应丢失」这两种情况下能不能直接重试。

## 预期输出与答案

Buggy 遇到大额未审批样本仍然退款，所以 Gate 状态是 failed，Fixed 的三条样本全部通过，Gate 状态是 passed。如果 approval_id 属于另一笔交易，系统应拒绝退款或转人工，Verifier 则必须核对 approval.transaction_id。能够确认请求没到服务端时，可以执行 infra retry，但提交状态不明就不能盲目重试。此时要先用 idempotency key 查询 ledger，再恢复同一个 Trial。

只看 decision fixture 证明不了真实副作用是安全的，因为它既没检查退款工具实际收到了哪些参数，也没查看账本最后变成什么样。生产前要做完整评测，必须补上工具参数检查和 final-state checks。

## 如何核对

阅读 [`refund-agent/eval.yaml`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/reference/examples/refund-agent/eval.yaml)、Dataset 和两个 Target，然后运行案例测试。再从每条 Score 追回 input/expected 与 target output，确认 Fixed 没有偷看 Scorer 的内部信息。

## 本篇不能证明什么

即使合成支付环境里的检查全部通过，也证明不了真实支付 API、权限配置、并发幂等和补偿流程都正确。这里得到的证据只覆盖已经冻结的政策和当前 Fixture。

[上一节](shipping-boundary.md) · [下一节](knowledge-assistant.md)
