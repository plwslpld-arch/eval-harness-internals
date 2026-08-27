# Agent Environment：把命令、文件和终态变成评测观察

[上一节](05-statistical-comparison.md) · [下一节](07-quality-gates.md)

## 本篇要解决什么问题

评测 Agent 时，最终文本往往不能代表产品结果——代码是否修好要看 diff 与测试，退款是否正确要看真实副作用，RAG Agent 要核对检索与 ACL，终端任务则要检查文件、进程和服务终态。Agent Environment Harness 负责创建、重置、限制、观察并验证实验环境，而 Agent Harness 负责 Agent loop，两者通过 Trace、Artifact 和 environment final state 交接，因此本篇会结合 Harbor/Terminal-Bench 课程与 Reference Harness 的 Agent Trace Import，说明怎样完成最小适配。

读完后，你应该能够设计完整的环境生命周期，分清 Agent phase 与 verifier phase，判断哪些日志和文件需要进入 Observation，并解释环境错误为什么不能记成产品失败。

## 核心机制

![Agent 环境创建、运行与断言](../assets/diagrams/harnesses/harbor-terminal-bench/environment-lifecycle.svg)

环境规范至少要固定镜像或仓库 commit、初始状态、用户、工作目录、可写范围、网络、资源、秘密注入、超时与 verifier。每个 Trial 都要从干净 snapshot 创建环境，当 Agent 在受控权限下运行时，Harness 会收集结构化 Trace、stdout/stderr、diff、终态和成本，随后再到同一个或分离的 verifier 环境中执行隐藏断言，最后才销毁环境或者隔离保留现场。

Reference Harness 本身不启动容器，但 `AgentTraceImportTarget` 清楚展示了 Adapter 边界，因为它会读取外部 JSONL，验证 sequence、event_id 和 parent 关系，再从最终事件中暴露可评分 output，而不会反推 Agent loop，也不会采集隐藏的 chain-of-thought。

## 完整流程

1. TaskSpec 固定初始仓库/镜像、instruction、允许修改范围和 verifier 版本。Dataset 提供多个任务实例。
2. Environment provider 声明 capabilities。请求网络禁用、CPU 限制或 compose 时，provider 不支持就应阻断，而非静默忽略。
3. 每个 Trial 创建干净环境并健康检查。build/start timeout 属于 Harness infra，允许受控 Attempt 恢复。
4. Agent Adapter 在 agent phase 注入最小凭据和环境变量，执行 setup/run。命令、工具调用、文件变化、模型事件形成 Trace 与 Artifact。
5. Agent 停止后收集日志，即使异常也尽量保存已发生行为。Trace 父子/序号验证确保基本因果闭合。
6. 切换 verifier phase 的网络和权限。隐藏 tests 不在 Agent phase 可见；分离环境时只传递允许的工作区状态。
7. Verifier 输出确定性 reward/组件结果或明确 error；环境构建、复制、reward 缺失不能伪装成 0 分。
8. reset/cleanup 验证残留资源；最终状态与清理错误进入 Trial 诊断，下一 Trial 不复用污染环境。

## 关键数据与不变量

Environment identity 包括 provider/version、镜像 digest、Task files digest、资源与网络 policy、OS 和架构，而 TraceEvent 只保存能够观察到的行为，不会把模型私有思维链收进来。Artifact 包括 diff、测试日志、终态快照与 trajectory，并且每项都需要内容摘要，同时 Verifier identity 必须与 Agent identity 分离。

同一任务的随机重复必须从等价初始状态开始，一旦环境 reset 失败，后续 Trial 就应标记为 invalid/blocked，而不是带着污染继续运行。Agent 能访问哪些凭据和网络域必须进入安全审计，但秘密值不能写入 Artifact，而 Verifier 也不能相信 Agent 自报成功。

## 动手实验

先验证 Agent Trace 导入：

```bash
uv run pytest tests/test_runtime_extensions.py -k trace -q
```

创建两行 JSONL，其中一行是 `tool_call`，另一行是以它为 parent 的 `agent_completed`，并在后者的 payload.output 中写入 `{"answer": 42}`。先用 `agent_trace` Target 运行，再把 parent 改成不存在的 ID，观察流程怎样被阻断，然后为代码修复任务写一份环境清单，其中应包含初始 commit、可写目录、禁网、CPU/内存、Agent timeout、隐藏 tests、diff 和 test log。

## 预期输出与答案

合法 Trace 的导入结果应包含 trace_event_count=2、两个 type 和 final_output，而 parent 一旦断裂，就应按 Trace 无效处理并停止，不能继续产生正常评分。代码修复任务的 Scorer 需要先在干净 verifier 环境中应用 diff 或检查工作树，再运行隐藏 tests，不能只读取 Agent 末尾那句「已修复」。

如果环境启动失败，可以由 Harness Attempt 受控恢复，而隐藏 tests 的合法失败属于产品失败，tests 本身缺失则属于 verifier error。即使清理失败发生在结果产生之后，也要附加诊断并阻断环境复用。

## 如何核对

阅读 [`targets/trace_import.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/targets/trace_import.py) 与对应测试后，再对照 [Harbor 环境课程](../harnesses/harbor-terminal-bench/02-environment-agent-lifecycle.md) 的锁定源码，逐项核对生产级 Environment 还需要补上哪些能力。

## 本篇不能证明什么

JSONL 因果验证无法证明事件确实发生过，也无法证明容器没有逃逸、网络策略真正 enforcement，或者隐藏测试不存在漏洞，因为 Trace 只是声明性证据，仍然需要可信采集和环境隔离来托底。

[上一节](05-statistical-comparison.md) · [下一节](07-quality-gates.md)
