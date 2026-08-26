# Agent Environment：把命令、文件和终态变成评测观察

[上一节](05-statistical-comparison.md) · [下一节](07-quality-gates.md)

## 本篇要解决什么问题

评测 Agent 时，最终文本往往不是产品结果——修复代码要看 diff 与测试，退款操作要看真实副作用，RAG Agent 要看检索与 ACL，终端任务要看文件、进程和服务终态。Agent Environment Harness 负责创建、重置、限制、观察和验证实验环境，Agent Harness 负责 Agent loop；两者接口是 Trace、Artifact 和 environment final state；本篇结合 Harbor/Terminal-Bench 课程与 Reference Harness 的 Agent Trace Import 说明最小适配。

读完后，你应能设计一个环境生命周期，区分 Agent phase 与 verifier phase，决定哪些日志/文件进入 Observation，并知道环境错误为何不能记为产品失败。

## 核心机制

![Agent 环境创建、运行与断言](../assets/diagrams/harnesses/harbor-terminal-bench/environment-lifecycle.svg)

环境规范至少固定镜像/仓库 commit、初始状态、用户、工作目录、可写范围、网络、资源、秘密注入、超时与 verifier；每个 Trial 从干净 snapshot 创建环境，Agent 在受控权限下运行，Harness 收集结构化 Trace、stdout/stderr、diff、终态和成本。随后在相同或分离 verifier 环境执行隐藏断言。最后销毁或隔离保留现场。

Reference Harness 不启动容器，但 `AgentTraceImportTarget` 展示 Adapter 边界——读取外部 JSONL，验证 sequence、event_id 和 parent 关系，从最终事件暴露可评分 output；它不会推断 Agent loop，也不会采集隐藏 chain-of-thought。

## 完整流程

1. TaskSpec 固定初始仓库/镜像、instruction、允许修改范围和 verifier 版本；Dataset 提供多个任务实例。
2. Environment provider 声明 capabilities。请求网络禁用、CPU 限制或 compose 时，provider 不支持就应阻断，而非静默忽略。
3. 每个 Trial 创建干净环境并健康检查。build/start timeout 属于 Harness infra，允许受控 Attempt 恢复。
4. Agent Adapter 在 agent phase 注入最小凭据和环境变量，执行 setup/run；命令、工具调用、文件变化、模型事件形成 Trace 与 Artifact。
5. Agent 停止后收集日志，即使异常也尽量保存已发生行为；Trace 父子/序号验证确保基本因果闭合。
6. 切换 verifier phase 的网络和权限。隐藏 tests 不在 Agent phase 可见；分离环境时只传递允许的工作区状态。
7. Verifier 输出确定性 reward/组件结果或明确 error；环境构建、复制、reward 缺失不能伪装成 0 分。
8. reset/cleanup 验证残留资源；最终状态与清理错误进入 Trial 诊断，下一 Trial 不复用污染环境。

## 关键数据与不变量

Environment identity 包括 provider/version、镜像 digest、Task files digest、资源/网络 policy、OS/架构；TraceEvent 只保存可观察行为。不保存模型私有思维链。Artifact 包括 diff、测试日志、终态快照与 trajectory，均需内容摘要；Verifier identity 与 Agent identity分离。

同一任务的随机重复必须从等价初始状态开始；环境 reset 失败使后续 Trial invalid/blocked，而不是继续运行。Agent 允许访问的凭据和网络域必须进入安全审计，但秘密值不得写入 Artifact。Verifier 不应信任 Agent 自报成功。

## 动手实验

先验证 Agent Trace 导入：

```bash
uv run pytest tests/test_runtime_extensions.py -k trace -q
```

创建两行 JSONL：`tool_call` 与以它为 parent 的 `agent_completed`，后者 payload.output 写入 `{"answer": 42}`；用 `agent_trace` Target 运行，然后把 parent 改成不存在的 ID。观察阻断。为代码修复任务再写一份环境清单：初始 commit、可写目录、禁网、CPU/内存、Agent timeout、隐藏 tests、diff 和 test log。

## 预期输出与答案

合法 Trace 导入结果包含 trace_event_count=2、两个 type 和 final_output；断裂 parent 应以 Trace 无效失败，不产生正常评分。代码修复的 Scorer 应在干净 verifier 环境应用 diff/检查工作树后运行隐藏 tests，不能只读取 Agent 末尾说“已修复”。

环境启动失败允许 Harness Attempt；隐藏 tests 合法失败是产品失败；tests 本身缺失是 verifier error；清理失败发生在结果之后，也要附加诊断并阻断环境复用。

## 如何核对

阅读 [`targets/trace_import.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/targets/trace_import.py) 与对应测试；再对照 [Harbor 环境课程](../harnesses/harbor-terminal-bench/02-environment-agent-lifecycle.md) 的锁定源码，核对生产级 Environment 还需要哪些能力。

## 本篇不能证明什么

JSONL 因果验证不能证明事件真实发生、容器无逃逸、网络策略真正 enforcement 或隐藏测试无漏洞。Trace 是声明性证据。仍需可信采集和环境隔离。

[上一节](05-statistical-comparison.md) · [下一节](07-quality-gates.md)
