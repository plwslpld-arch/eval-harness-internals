# Environment 与 Agent 生命周期：副作用怎样被隔离和观察

[上一节](01-job-dataset-trial.md) · [下一节](03-verifier-reward-results.md)

## 本篇要解决什么问题

终端 Agent 不只返回文本，它会安装软件、编辑文件、启动服务、访问网络并消耗资源。Eval Harness 若只截取最后一句输出，就无法知道任务是否真的完成、是否越权或是否污染后续 Trial。Harbor 的 BaseEnvironment 和 Trial 把环境能力、目录、网络阶段、Agent setup/run、日志回调和 verifier phase 组织为生命周期。本篇解释这些边界怎样支撑可核对评测。

我们尤其关注并发隔离：环境对象的 env overlay 和 output callback 若用普通全局变量，会在多个 Trial 间串线；网络若只在容器启动时设置，Agent 与 verifier 的不同权限无法表达；Agent 结束后若立即销毁环境，Verifier 又失去检查文件状态的机会。

## 先建立源码地图

| 源码位置 | 责任 | 核对问题 |
| --- | --- | --- |
| [`src/harbor/environments/base.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/environments/base.py) | 环境能力、资源、网络、exec、文件与 scoped context | 副作用和并发如何隔离 |
| [`src/harbor/trial/trial.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/trial/trial.py) | 创建环境、阶段切换、Agent/Verifier 与 hooks | 生命周期怎样排序和收尾 |
| [`terminal_bench/agents/base_agent.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/agents/base_agent.py) | Agent identity、prompt template 与 perform_task | Harness 与 Agent 的最小契约 |

## 完整调用链

![Harbor 环境、Agent 与 Verifier 生命周期](../../assets/diagrams/harnesses/harbor-terminal-bench/environment-lifecycle.svg)

1. Trial 根据 Task 环境配置和 Agent 配置创建 BaseEnvironment；环境实现声明 capabilities/resource capabilities，并验证 CPU、内存、存储、GPU 与 compose 支持。
2. 环境启动时准备工作目录、挂载、默认用户和启动变量，执行 healthcheck。启动超时与构建失败在 Agent 运行前结束 Trial。
3. Trial 进入 Agent phase，应用该阶段网络策略和 Agent scoped env。ContextVar 风格的 overlay 与 output callback 只作用于当前 asyncio task，嵌套 scope 按近者优先。
4. Agent setup 安装工具或准备依赖；run/perform_task 接收 instruction 与环境/日志路径，通过环境 exec 与文件 API 执行任务，并返回 AgentContext/AgentResult。
5. Trial 下载 Agent 日志与轨迹，记录 token/cost 和 setup/execution timing；无论成功失败都要尝试回收输出，避免异常抹掉已发生副作用。
6. 进入 Verification phase 前切换网络政策。若使用 separate verifier environment，则按策略复制或挂载待验工作区；若 same environment，则明确 Agent 残留进程和权限影响。
7. Verifier 完成后停止环境、清理资源并发出 hook。清理错误应附加到 Trial 诊断，不能覆盖最初的 Agent/Verifier 异常。

## 关键数据结构

EnvironmentConfig 描述 provider、镜像/构建、网络、资源和环境变量；EnvironmentCapabilities 声明实现支持什么，而不是假设所有容器后端等价。ExecResult 保存 stdout、stderr 与退出码。Agent identity 至少包括 name、version、model/provider 和 prompt template。AgentContext 保存运行轨迹与用量。TrialPaths/EnvironmentPaths 规定 agent、verifier、logs、reward 等跨系统约定路径。

网络计划应区分 baseline、agent phase 和 verifier phase。allowlist/public/disabled 不只是安全设置，也会改变任务可解性，因此属于实验条件。密钥只以受控环境变量注入，不得进入日志、TrialConfig 公共副本或课程材料。

## 实现取舍与失败语义

抽象 BaseEnvironment 让 Docker、Kubernetes 或云沙箱共享 Trial 逻辑，但 capabilities 必须显式核对；把不支持的资源限制静默忽略会破坏公平性。Context-local overlay 支持并发，仍要求底层 provider 不把可变状态放在进程全局。

Agent setup 失败、Agent timeout、命令非零、环境失联和网络政策切换失败是不同阶段错误。某些任务允许命令非零作为探索过程，因此不能把每个 exec 非零直接判产品失败；最终由 Agent contract 和 Verifier 判断。Verifier 期间禁止 Agent 网络不能反推 Agent 阶段没有泄漏，网络 enforcement 需平台级测试。

## 动手实验

设计一个需要启动本地 HTTP 服务的任务，写出环境镜像、端口、CPU/内存、Agent 网络与 Verifier 网络、可写目录和默认用户。列出 Agent setup、run、日志下载、verification、cleanup 各阶段可能失败的两种情况及应保存证据。再分析同一环境验证和分离环境验证的攻击面与复制成本。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

Agent 阶段若需要安装依赖，可采用 allowlist；Verifier 通常可禁网，避免外部答案影响测试。可写路径应最小化，隐藏 tests 不应在 Agent 阶段挂载。同环境验证能看到完整进程/文件状态但可能被 Agent 篡改；分离环境隔离更强，却必须可靠传递待验工作区并保持 OS/依赖一致。

每阶段证据至少包括开始结束时间、状态、命令/实现 identity、stdout/stderr 摘要、相关 artifact digest 和异常类型。cleanup 失败不能把已得到 reward 改为成功，也不能把原异常丢失。

## 如何核对

在 [`src/harbor/environments/base.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/environments/base.py) 核对 capabilities、resource mode、scoped_exec_env、scoped_output_callback、reset/ensure dirs 与 exec 抽象；在 [`src/harbor/trial/trial.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/trial/trial.py) 追 network plan、hooks 和环境收尾。

## 本篇不能证明什么

声明网络禁用、资源限制和容器隔离不能证明底层平台真正 enforcement、无内核逃逸、无侧信道或并发绝对隔离。需要对具体 Environment provider 做独立安全与故障注入测试。

[上一节](01-job-dataset-trial.md) · [下一节](03-verifier-reward-results.md)
