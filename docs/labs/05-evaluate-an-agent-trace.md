# 实验五：导入并评测 Agent Trace

[上一节](04-repeat-and-compare.md) · [下一节](06-build-a-release-gate.md)

## 本篇要解决什么问题

Eval Harness 可以用 Target Adapter（被测对象适配器）读取 Codex、Claude、Gemini CLI、DeepSeek Harness、pi 或 OpenCode 产生的结构化 Trace（轨迹），你不用再把每套系统里的 Agent Loop 实现一遍。这个实验先创建一份离线 JSONL，核对各个事件之间的因果关系，再让 `agent_trace` Adapter 把 final output 交给 Scorer。

## 核心机制

![Agent Trace 导入与证据血缘](../assets/diagrams/foundations/04-lineage.svg)

每个 TraceEvent 都要带上 event_id、连续的 sequence、type 和 payload，有父事件时再补上 parent_event_id。导入器如果看到重复 ID、断掉的 sequence 或者找不到的 parent，会直接拒绝这份文件。结构检查通过后，它会去找最后一个含 payload.output 的事件，用它生成 final_output，同时留下事件类型和数量。它不会猜模型的隐藏思维链。

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

导入的 Trace 是外部系统自己声明的证据，所以你必须记下来源系统、版本和原文件 digest，以后才能查清证据究竟从哪里来。parent 必须出现在 child 前面，sequence 也必须从 1 开始连续编号。如果 final_output 缺失，就照实保留缺失状态，不能伪造答案。另外，结构合法不代表这些事件真的发生过，对外公开的 Trace 里也绝对不能放密钥或隐藏 chain-of-thought。

## 动手实验

把测试里的合法 Trace 复制成本地文件，再分别把 sequence 改成从 2 开始、把 parent 改成 missing，以及让两个 event_id 相同，从而造出三种错误。动手导入前，先预测每种错误会在哪一步被拦下来，然后给 final event 加上 `payload.output.answer=42`，再为它设计 Dataset 和 field Scorer。

## 预期输出与答案

导入器应该在导入阶段拦住这三种结构错误，所以它们都不会产生正常 Score；合法的 Trace 则会输出 event_count=2、types 列表和 final_output.answer=42。即使 Scorer 最后只核对 answer，你也要保留整份导入 Trace 的 digest，因为用来评分的字段少，不代表证据血缘可以省掉。

## 如何核对

阅读 [`targets/trace_import.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/targets/trace_import.py) 和相应测试，检查错误是在 Target Adapter 而不是 Scorer 中暴露。

## 本篇不能证明什么

结构化 Trace 只能证明导入文件符合约定的事件结构，它自己证明不了工具权限已正确配置、事件从未删改，或者 Agent 的运行环境已经隔离。就算 digest 能证明文件导入后没有变化，它也查不出采集前是否漏了关键事件、改了先后顺序或丢了来源身份。想让采集结果可信，Agent Harness、采集器和环境层还要一起提供额外保证。

[上一节](04-repeat-and-compare.md) · [下一节](06-build-a-release-gate.md)
