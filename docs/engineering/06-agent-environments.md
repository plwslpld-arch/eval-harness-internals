# Agent Environment：把命令、文件和终态变成评测观察

[上一节](05-statistical-comparison.md) · [下一节](07-quality-gates.md)

## 本篇要解决什么问题

评测 Agent 时，你不能只看它最后回了什么文字。代码有没有修好，得看 diff 和测试，退款对不对，得查真实副作用，RAG Agent 要核对检索结果和 ACL，终端任务则要检查文件、进程和服务最后留下了什么状态。管理 Agent Environment（智能体环境）的 Harness 会创建实验环境，在每次运行前重置并限制它，运行中收集可观察行为，运行后再验证结果，而 Agent Harness 专门推进 Agent loop。两边靠 Trace、Artifact 和 environment final state 交接，本篇会结合 Harbor/Terminal-Bench 课程和 Reference Harness 的 Agent Trace Import，看看最小适配需要接上哪些环节。

读完后，你应该能把环境从创建到清理的整个过程设计出来，分清 Agent phase 和 verifier phase 各自做什么，再决定哪些日志和文件要交给 Observation。还有一条不能混：环境出错不等于产品失败。

## 核心机制

![Agent 环境创建、运行与断言](../assets/diagrams/harnesses/harbor-terminal-bench/environment-lifecycle.svg)

你至少要在环境规范里固定镜像或仓库 commit、初始状态、运行用户、工作目录、可写范围、网络和资源，同时说清怎样注入秘密、何时超时以及由哪个 verifier 验收。每个 Trial 都应从干净的 snapshot 建出环境，Agent 在受控权限下运行时，Harness 会收集结构化 Trace、stdout/stderr、diff、最终状态和成本。等 Agent 停下来后，Harness 再在当前环境或单独的 verifier 环境里执行隐藏断言，验证完才销毁环境，或者先隔离现场再保留。所以在验证真正完成以前，别急着清理现场。

Reference Harness 自己不会启动容器，但 `AgentTraceImportTarget` 把 Adapter（适配器）应该管到哪里说得很清楚：它读取外部 JSONL，检查 sequence、event_id 和 parent 能否对上，然后从最后一个事件取出可评分的 output。到这一步，Adapter 的职责就已经到头，不能继续往里猜。它不会倒推 Agent loop，更不会采集隐藏的 chain-of-thought 作为评测证据。

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

要识别一个 Environment，就得记下 provider/version、镜像 digest、Task files digest、资源和网络 policy、OS 以及架构，但 TraceEvent 只能保存真正观察到的行为，不能把模型私有思维链收进来。Artifact（产物）可以收纳 diff、测试日志、终态快照和 trajectory，但每一项都要有内容摘要，而且 Verifier 与 Agent 必须使用分开的 identity。

同一任务每次随机重复时都必须从等价的初始状态起步，只要环境 reset 失败，就要把后续 Trial 标成 invalid/blocked，不能带着污染继续跑。环境权限也要逐项检查，不能只看配置里的声明。安全审计要记录 Agent 可以使用哪些凭据、访问哪些网络域，但不能把秘密值写进 Artifact，Verifier 也不能直接相信 Agent 自报的成功。

## 动手实验

先验证 Agent Trace 导入：

```bash
uv run pytest tests/test_runtime_extensions.py -k trace -q
```

先写两行 JSONL：一行记 `tool_call`，另一行记以它为 parent 的 `agent_completed`，并在后一行的 payload.output 里写入 `{"answer": 42}`。用 `agent_trace` Target 跑过一次后，把 parent 换成一个不存在的 ID，看看流程会在哪里停下来。然后给代码修复任务列一份环境清单，把初始 commit、可写目录、禁网、CPU/内存、Agent timeout、隐藏 tests、diff 和 test log 都列进去。

## 预期输出与答案

导入合法 Trace 后，你应该看到 trace_event_count=2、两个 type 和 final_output，而 parent 只要断掉，Harness 就应该将 Trace 判为无效并停下，不能继续给出正常评分。评测代码修复任务时，Scorer 要先在干净的 verifier 环境里应用 diff 或检查工作树，再运行隐藏 tests，只读 Agent 最后那句「已修复」当然不够。

环境没能启动时，Harness 可以通过 Attempt 受控恢复，但隐藏 tests 正常运行后报失败才算产品失败，如果 tests 自己缺失，则要记为 verifier error。这两件事不能混。即使已经产生结果才发现清理失败，也要补上诊断，并禁止复用这个环境。

## 如何核对

读完 [`targets/trace_import.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/targets/trace_import.py) 和对应测试后，再对照 [Harbor 环境课程](../harnesses/harbor-terminal-bench/02-environment-agent-lifecycle.md) 里锁定的源码逐项检查，看看要达到生产级，Environment 还少哪些能力。

## 本篇不能证明什么

即使 JSONL 里的因果关系都对得上，你也不能据此证明事件确实发生过，更证明不了容器没有逃逸、网络策略真正 enforcement，或者隐藏测试没有漏洞。Trace 只能声明发生了什么，还得靠可信的采集方式和隔离环境才能托住这份证据。

[上一节](05-statistical-comparison.md) · [下一节](07-quality-gates.md)
