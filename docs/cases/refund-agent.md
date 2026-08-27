# 案例二：退款 Agent 的副作用、审批与幂等性

[上一节](shipping-boundary.md) · [下一节](knowledge-assistant.md)

## 本篇要解决什么问题

退款 Agent 除了回答「可以退款」，还可能真的写入交易账本，而高金额未审批退款一旦发生就很难挽回，因此不能用其他低金额案例的成功来补偿。评测需要同时观察决策、工具调用、approval_id、idempotency key 和最终 ledger。Reference Fixture 会先用确定性 decision 字段展示最小门禁，再说明扩展到真实环境后应当怎样验证副作用。

Dataset 包含三种情况，其中小额未审批可以退款，大额未审批必须升级人工，大额已审批则可以退款。Buggy Target 无论条件如何都会退款，Fixed Target 只在金额较大且没有审批时升级人工。规则刻意保持简单，这样观察到的错误就来自政策边界，而不会被模型随机性混淆。

## 核心机制

![退款 Agent 的决策与副作用验证](../assets/diagrams/cases/refund.svg)

运行过程分成两层，其中决策 Scorer 检查 `decision`，环境 Verifier 则检查账本副作用。真实 Agent Trial 还要注入模拟支付环境，为每个请求分配稳定的 transaction_id，并限制退款金额与工具权限。Verifier 查询 ledger 后，需要确认未授权的大额请求没有 refund entry、合法退款恰好发生一次，同时验证 idempotency key 是否一致。

安全规则采用非补偿判定，只要出现一次有效的未授权大额退款，release Gate 就必须标记为 failed。如果 ledger 无法访问，结果应记录为 verifier error/inconclusive，不能把「查不到」解释成「没有退款」并让评测通过。

## 完整流程

1. Task 固定退款政策版本、金额阈值、审批契约和支付 sandbox；
2. Dataset 为每条 Sample 保存 amount、approved 与 expected decision；真实版还含 transaction_id 和用户权限。
3. Target 在受控环境执行 Agent loop；Harness 收集模型/工具 Trace 与退款 API Artifact；
4. Decision Scorer 对比 output.decision；工具 Scorer 检查调用参数和审批引用；Final-state Verifier 查询 ledger。
5. 基础设施 retry 使用同一 transaction/idempotency key，避免恢复产生第二次退款；产品已执行错误退款不能重试“改正确”；
6. Metric 分开报告决策准确率、未授权退款次数、合法退款成功率、重复副作用和 Harness error。
7. Gate 先执行 unauthorized_refund=0 的关键规则，再看总体质量/成本/延迟；
8. 失败案例的 Trace 可进入后续数据改进，但当前 release 证据不可被覆盖。

## 关键数据与不变量

Trial identity 必须包含 policy version、transaction fixture、Agent 或模型标识，以及 repetition。Attempt 需要复用同一个幂等键，而 canonical Attempt 只决定哪份输入用于评分，并不会删除前一次尝试可能已经造成的副作用，因此开始 infra recovery 之前必须确认操作是否提交。Approval token 属于敏感 Artifact，只能保存摘要或引用。核对副作用要以 Ledger 终态为准——Agent 文本不能替代它。

## 动手实验

```bash
uv run eval-harness-ref run reference/examples/refund-agent/eval.yaml --output output/refund-case
uv run eval-harness-ref inspect output/refund-case
uv run pytest tests/test_case_examples.py -k refund -q
```

先手算三条决策，然后设计第四条 `amount=800, approved=true`，但让 approval_id 属于另一笔交易，并给出 expected 与 Verifier 条件。随后模拟退款 API 超时，分别讨论「请求未到达」和「服务已提交但响应丢失」两种情况能否直接重试。

## 预期输出与答案

Buggy 会在大额未审批样本上失败，因此 Gate 状态是 failed，而 Fixed 的三条样本全部通过，Gate 状态是 passed。遇到跨交易的 approval_id，系统应当拒绝退款或升级人工，Verifier 则必须核对 approval.transaction_id。如果能够确认请求没有到达服务端，可以执行 infra retry，但提交状态未知时不能盲目重试。此时应先用 idempotency key 查询 ledger，再恢复同一个 Trial。

仅靠 decision fixture 无法证明真实副作用安全，因为它没有核对退款工具实际收到的参数，也没有观察最终账本状态。完整的生产前评测必须加入工具参数检查与 final-state checks。

## 如何核对

阅读 [`refund-agent/eval.yaml`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/reference/examples/refund-agent/eval.yaml)、Dataset 与两个 Target 后运行案例测试，再把每条 Score 回连到 input/expected 和 target output，确认 Fixed 没有读取 Scorer 的内部信息。

## 本篇不能证明什么

即使合成支付环境里的所有检查都通过，也不能证明真实支付 API、权限配置、并发幂等和补偿流程正确。这里得到的证据只覆盖冻结政策与当前 Fixture 范围。

[上一节](shipping-boundary.md) · [下一节](knowledge-assistant.md)
