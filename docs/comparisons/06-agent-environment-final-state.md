# 横向比较六：Agent Environment 与 Final State

[上一节](05-metric-statistics-uncertainty.md) · [下一节](07-report-ci-release-gate.md)

## 本篇要解决什么问题

模型 benchmark 主要观察生成文本，Agent Eval 还要观察环境副作用；Inspect Sandbox、Promptfoo trace assertions、DeepEval agentic trace 与 Harbor container verifier 都能触达 Agent 行为，但隔离、终态和验证强度不同。本篇比较“能执行工具”与“能可信验证终态”之间的距离。

## 核心机制

![Agent 环境与验证阶段](../assets/diagrams/harnesses/harbor-terminal-bench/environment-lifecycle.svg)

统一 Environment Harness 有五个阶段：create/reset → agent setup/run → collect trace/artifacts → independent verify → cleanup；Target Adapter 只负责连接 Agent 运行；Scorer/Verifier 不信任 Agent 自报。环境身份、网络和资源属于实验条件。

| Harness | 环境能力 | 终态证据 | 主要边界 |
| --- | --- | --- | --- |
| Inspect AI | Sandbox + tools + solver | EvalLog、文件/命令可评分 | 具体 sandbox provider 能力 |
| Promptfoo | Provider/trace 集成 | trace-aware assertion | 不负责通用容器生命周期 |
| DeepEval | trace/span agentic eval | LLMTestCase + span metrics | 环境创建多由外部系统 |
| Harbor/TB | 专门 container environment | logs、trajectory、workspace、reward | 最完整但成本与安全面更大 |
| Reference | Agent Trace import | 验证 JSONL + final output | 不启动真实环境 |

## 完整流程

1. 固定 Task 初始镜像/仓库、权限和 verifier；
2. 核对 provider capabilities，不支持的网络/资源要求直接 blocked；
3. 每 Trial 创建干净环境，Agent 使用最小权限执行；
4. 收集命令、工具、diff、服务状态与成本，不采集隐藏思维链；
5. Verifier 在受控阶段运行隐藏测试并解析 reward；错误单独分类；
6. 清理并检查污染；结果回连环境 digest、Agent 与 verifier identity。

## 关键数据与不变量

同一环境验证便于看到进程状态但易受篡改；分离环境隔离更强但复制可能丢状态。Final state 应是机器可检查事实：文件摘要、测试结果、数据库记录、服务响应；Agent final message 只是一条 TraceEvent。网络 disabled 声明需底层 enforcement 证据。

## 动手实验

为退款 Agent 与代码修复 Agent 各列三项终态断言：

```text
退款：ledger entry、approval id、idempotency key
代码：git diff、隐藏测试、工作树允许范围
```

将其中一项只由 Agent 文本声明，说明为什么证据不足。

## 预期输出与答案

退款必须查交易/ledger，而非“已退款”；代码必须运行隐藏测试并检查 diff，而非“测试通过”——缺少环境访问时 Scorer unscorable/blocked，不能把文本看起来合理记为成功。

## 如何核对

对照 [Inspect Sandbox](../harnesses/inspect-ai/02-sandbox-sample-run.md)、[Harbor 生命周期](../harnesses/harbor-terminal-bench/02-environment-agent-lifecycle.md) 和 Trace Import 测试。

```bash
uv run pytest tests/test_runtime_extensions.py -k trace -q
```

## 本篇不能证明什么

终态测试通过不能证明中途没有越权、侧信道或不可见副作用，但需要 Trace、安全策略与生产补偿机制共同覆盖。

[上一节](05-metric-statistics-uncertainty.md) · [下一节](07-report-ci-release-gate.md)
