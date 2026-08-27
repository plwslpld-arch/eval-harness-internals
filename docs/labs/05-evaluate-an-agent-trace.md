# 实验五：导入并评测 Agent Trace

[上一节](04-repeat-and-compare.md) · [下一节](06-build-a-release-gate.md)

## 本篇要解决什么问题

Eval Harness 可以通过 Target Adapter 消费 Codex、Claude、Gemini CLI、DeepSeek Harness、pi 或 OpenCode 输出的结构化 Trace，因此没有必要重新实现每套系统自己的 Agent Loop——本实验会先创建离线 JSONL，验证事件之间的因果关系，再由 `agent_trace` Adapter 把 final output 交给 Scorer。

## 核心机制

![Agent Trace 导入与证据血缘](../assets/diagrams/foundations/04-lineage.svg)

每个 TraceEvent 都要提供 event_id、连续 sequence、type 和 payload，并可按需提供 parent_event_id。导入器一旦发现重复 ID、断序或未知 parent 就会拒绝导入，结构检查通过后，它从最后一个含 payload.output 的事件构造 final_output，同时保留事件类型和数量，但不会推断模型的隐藏思维链。

## 完整流程

1. 写 Dataset expected.trace_event_count；
2. 写 `tool_call` root event 和 `agent_completed` child event；
3. 配置 Target adapter=agent_trace、trace=相对路径；
4. Pipeline 在配置目录内安全解析文件，Runner 形成 canonical Attempt；
5. Harness 自己写 target_completed Trace，output 含导入摘要；
6. Scorer 对 trace_event_count 或 final_output 评分。

```bash
uv run pytest tests/test_cli.py -k agent_trace -q
uv run pytest tests/test_runtime_extensions.py -k trace -q
```

## 关键数据与不变量

导入 Trace 属于外部系统声明的证据，所以必须保存来源系统、版本和原文件 digest，方便后续核对证据来自哪里。parent 必须先于 child 出现，sequence 要从 1 开始连续，如果 final_output 缺失，就应保留缺失状态，不能伪造答案，而结构有效也不等于事件真的发生过，公开 Trace 更不能写入密钥或隐藏 chain-of-thought。

## 动手实验

把测试中的合法 Trace 复制为本地文件，再分别制造 sequence 从 2 开始、parent=missing 和两个 event_id 相同这三种错误，然后先预测每次导入究竟会在哪一步失败，再给 final event 增加 `payload.output.answer=42`，并为它设计 Dataset 与 field Scorer。

## 预期输出与答案

三种结构错误都应在导入阶段失败，因此不会产生正常 Score，而合法 Trace 会输出 event_count=2、types 列表与 final_output.answer=42。即使 Scorer 最终只验证 answer，也要保留完整导入 Trace 的 digest，因为评分字段少并不意味着证据血缘可以省略。

## 如何核对

阅读 [`targets/trace_import.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/targets/trace_import.py) 和相应测试，检查错误是在 Target Adapter 而不是 Scorer 中暴露。

## 本篇不能证明什么

结构化 Trace 只能证明导入文件满足约定的事件结构，无法单独证明工具权限配置正确、事件从未删改，或 Agent 运行环境已经隔离，即使摘要能够证明文件在导入后没有变化，也无法追溯采集前是否漏掉了关键事件、改写了先后顺序或丢失了来源身份。要获得可信采集结果，还需要 Agent Harness、采集器与环境层共同提供额外保证。

[上一节](04-repeat-and-compare.md) · [下一节](06-build-a-release-gate.md)
