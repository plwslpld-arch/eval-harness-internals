# 实验五：导入并评测 Agent Trace

[上一节](04-repeat-and-compare.md) · [下一节](06-build-a-release-gate.md)

## 本篇要解决什么问题

Eval Harness 不必重新实现 Codex、Claude、Gemini CLI、DeepSeek Harness、pi 或 OpenCode 的 Agent Loop；它可以通过 Target Adapter 消费这些系统输出的结构化 Trace。本实验创建离线 JSONL，验证事件因果，再用 `agent_trace` Adapter 将 final output 交给 Scorer。

## 核心机制

![Agent Trace 导入与证据血缘](../assets/diagrams/foundations/04-lineage.svg)

TraceEvent 需要 event_id、连续 sequence、type、可选 parent_event_id 和 payload。导入器拒绝重复 ID、断序和未知 parent，从最后一个含 payload.output 的事件构造 final_output，同时保留事件类型和数量。它不推断模型隐藏思维链。

## 完整流程

1. 写 Dataset expected.trace_event_count。
2. 写 `tool_call` root event 和 `agent_completed` child event。
3. 配置 Target adapter=agent_trace、trace=相对路径。
4. Pipeline 在配置目录内安全解析文件，Runner 形成 canonical Attempt。
5. Harness 自己写 target_completed Trace，output 含导入摘要。
6. Scorer 对 trace_event_count 或 final_output 评分。

```bash
uv run pytest tests/test_cli.py -k agent_trace -q
uv run pytest tests/test_runtime_extensions.py -k trace -q
```

## 关键数据与不变量

导入 Trace 是外部声明证据，必须保存来源系统、版本和原文件 digest。事件结构有效不证明实际发生。parent 必须先出现，sequence 从 1 连续；final_output 缺失不应伪造答案。公共 Trace 禁止写密钥和隐藏 chain-of-thought。

## 动手实验

把测试中的合法 Trace 复制为本地文件，依次制造三种错误：sequence 从 2 开始、parent=missing、两个 event_id 相同。预测导入结果；再给 final event 增加 `payload.output.answer=42`，设计 Dataset 与 field Scorer。

## 预期输出与答案

三种结构错误都应在导入阶段失败，不产生正常 Score。合法 Trace 输出 event_count=2、types 列表与 final_output.answer=42。若只验证 answer，仍应把完整导入 Trace digest 保留作血缘。

## 如何核对

阅读 [`targets/trace_import.py`](../../src/eval_harness_reference/targets/trace_import.py) 和相应测试；检查错误是在 Target Adapter 而不是 Scorer 中暴露。

## 本篇不能证明什么

结构化 Trace 不能证明工具权限正确、事件未删改或 Agent 运行环境隔离；可信采集需要 Agent Harness 与环境层额外保证。

[上一节](04-repeat-and-compare.md) · [下一节](06-build-a-release-gate.md)
