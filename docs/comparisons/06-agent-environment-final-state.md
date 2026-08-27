# 横向比较六：Agent Environment 与 Final State

[上一节](05-metric-statistics-uncertainty.md) · [下一节](07-report-ci-release-gate.md)

## 本篇要解决什么问题

模型 benchmark 主要看生成的文本，Agent Eval 却还得检查运行过程给环境留下了哪些副作用。Inspect Sandbox、Promptfoo trace assertions、DeepEval agentic trace 和 Harbor container Verifier（验证器）都能看到 Agent 的行为，但各自能隔离什么、拿什么证明终态、验证能做到多严并不相同，所以这一篇要说清楚：Agent 能执行工具以后，还缺哪些条件才能让人相信终态。

## 核心机制

![Agent 环境与验证阶段](../assets/diagrams/harnesses/harbor-terminal-bench/environment-lifecycle.svg)

统一的 Environment Harness 先执行 create/reset 来准备环境，再进入 agent setup/run，随后 collect trace/artifacts，并在 independent verify 结束后 cleanup。Target Adapter 只把 Agent 接进来运行，Scorer/Verifier 还得自己核对结果，不能听信 Agent 的自我报告，因为用的是哪个环境、能否联网以及拿到多少资源，本来就是实验条件。

| Harness | 环境能力 | 终态证据 | 主要边界 |
| --- | --- | --- | --- |
| Inspect AI | Sandbox + tools + solver | EvalLog、文件/命令可评分 | 具体 sandbox provider 能力 |
| Promptfoo | Provider/trace 集成 | trace-aware assertion | 不负责通用容器生命周期 |
| DeepEval | trace/span agentic eval | LLMTestCase + span metrics | 环境创建多由外部系统 |
| Harbor/TB | 专门 container environment | logs、trajectory、workspace、reward | 最完整但成本与安全面更大 |
| Reference | Agent Trace import | 验证 JSONL + final output | 不启动真实环境 |

## 完整流程

1. 固定 Task 初始镜像/仓库、权限和 verifier。
2. 核对 provider capabilities，不支持的网络/资源要求直接 blocked。
3. 每 Trial 创建干净环境，Agent 使用最小权限执行。
4. 收集命令、工具、diff、服务状态与成本，不采集隐藏思维链。
5. Verifier 在受控阶段运行隐藏测试并解析 reward，错误单独分类。
6. 清理并检查污染，结果回连环境 digest、Agent 与 verifier identity。

## 关键数据与不变量

Verifier 留在原环境里时更容易看到进程状态，但被测程序也更容易干扰验证。把验证环境分开可以加强隔离，复制状态时却可能漏掉信息。Final state 要落到机器能够检查的事实上，例如文件摘要、测试结果、数据库记录或服务响应。Agent final message 只算一条 TraceEvent，至于网络是否真的 disabled，也得拿出底层 enforcement 的证据。

## 动手实验

请给退款 Agent 和代码修复 Agent 各列三项能够检查的终态断言：

```text
退款：ledger entry、approval id、idempotency key
代码：git diff、隐藏测试、工作树允许范围
```

然后把其中一项改成只让 Agent 在文本里声明，再说明为什么这种自报撑不起终态判断。

## 预期输出与答案

退款任务要查询实际交易或 ledger，不能只相信「已退款」几个字。代码任务也要运行隐藏测试并检查 diff，不能把 Agent 自称「测试通过」当成终态证据。如果 Scorer 访问不了环境，就该记为 unscorable/blocked，不能因为文字看起来合理就判定成功。

## 如何核对

先对照 [Inspect Sandbox](../harnesses/inspect-ai/02-sandbox-sample-run.md)、[Harbor 生命周期](../harnesses/harbor-terminal-bench/02-environment-agent-lifecycle.md) 和 Trace Import 测试，逐项确认哪一层创建环境、哪一层运行 Agent、哪一层独立验证。

```bash
uv run pytest tests/test_runtime_extensions.py -k trace -q
```

## 本篇不能证明什么

终态测试通过，只能说明检查到的最终事实符合预期，证明不了中途没有越权、侧信道或看不见的副作用，所以还得用 Trace、安全策略和生产补偿机制一起兜住这些风险。

[上一节](05-metric-statistics-uncertainty.md) · [下一节](07-report-ci-release-gate.md)
