# Environment 与 Agent 生命周期：副作用怎样被隔离和观察

[上一节](01-job-dataset-trial.md) · [下一节](03-verifier-reward-results.md)

## 本篇要解决什么问题

终端 Agent 不只返回一段文本，它还会安装软件、编辑文件、启动服务、访问网络并消耗资源。Eval Harness（评测框架）若只截取最后一句输出，就判断不了任务是否真的完成，Agent 有没有越权，这次运行又是否污染了后续 Trial（试验），因为副作用也要留下证据。Harbor 用 BaseEnvironment 和 Trial 串起环境能力、工作目录、各阶段网络、Agent setup/run、日志回调与 verifier phase，这一篇就顺着这条生命周期往下看，弄清每道边界怎样让评测可以核对。

并发隔离尤其要仔细查，因为环境对象若用普通全局变量保存 env overlay 和 output callback，多个 Trial 的状态就会串到一起。网络策略若只在容器启动时设置，也表达不了 Agent 与 verifier 各自需要的权限。Agent 刚结束就销毁环境，Verifier 又没有机会检查最后留下的文件状态。

## 先建立源码地图

| 源码位置 | 责任 | 核对问题 |
| --- | --- | --- |
| [`src/harbor/environments/base.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/environments/base.py) | 环境能力、资源、网络、exec、文件与 scoped context | 副作用和并发如何隔离 |
| [`src/harbor/trial/trial.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/trial/trial.py) | 创建环境、阶段切换、Agent/Verifier 与 hooks | 生命周期怎样排序和收尾 |
| [`terminal_bench/agents/base_agent.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/agents/base_agent.py) | Agent identity、prompt template 与 perform_task | Harness 与 Agent 的最小契约 |

## 完整调用链

![Harbor 环境、Agent 与 Verifier 生命周期](../../assets/diagrams/harnesses/harbor-terminal-bench/environment-lifecycle.svg)

1. Trial 根据 Task 环境配置和 Agent 配置创建 BaseEnvironment；环境实现声明 capabilities/resource capabilities，并验证 CPU、内存、存储、GPU 与 compose 支持。
2. 环境启动时准备工作目录、挂载、默认用户和启动变量，执行 healthcheck，而启动超时与构建失败在 Agent 运行前结束 Trial。
3. Trial 进入 Agent phase，应用该阶段网络策略和 Agent scoped env，ContextVar 风格的 overlay 与 output callback 只作用于当前 asyncio task，嵌套 scope 按近者优先。
4. Agent setup 安装工具或准备依赖；run/perform_task 接收 instruction 与环境/日志路径，通过环境 exec 与文件 API 执行任务，并返回 AgentContext/AgentResult。
5. Trial 下载 Agent 日志与轨迹，记录 token/cost 和 setup/execution timing；无论成功失败都要尝试回收输出，避免异常抹掉已发生副作用。
6. 进入 Verification phase 前切换网络政策。若使用 separate verifier environment，则按策略复制或挂载待验工作区；若 same environment，则明确 Agent 残留进程和权限影响。
7. Verifier 完成后停止环境、清理资源并发出 hook。清理错误应附加到 Trial 诊断，不能覆盖最初的 Agent/Verifier 异常。

## 关键数据结构

EnvironmentConfig 写明用哪个 provider、怎样准备镜像和构建、网络与资源怎么限制，以及要注入哪些环境变量。EnvironmentCapabilities 则由每种实现明确报出自己支持什么，免得调用方把所有容器后端都当成等价实现，因此能力声明必须核对。ExecResult 留下 stdout、stderr 和退出码，Agent identity 至少要包括 name、version、model/provider 与 prompt template，AgentContext 用来保存运行轨迹和用量。agent、verifier、logs、reward 等跨系统路径，则统一交给 TrialPaths/EnvironmentPaths 规定。

网络计划要明确分开 baseline、agent phase 和 verifier phase，因为 allowlist、public、disabled 不只控制安全边界，也会直接改变任务能不能完成，所以这些设置都属于实验条件。密钥只能通过受控环境变量注入，绝不能写进日志、TrialConfig 公共副本或课程材料。

## 实现取舍与失败语义

BaseEnvironment 抽出统一接口后，Docker、Kubernetes 和云沙箱可以共用一套 Trial 逻辑，但调用方仍要逐项核对每种实现报出的 capabilities。若后端悄悄忽略自己不支持的资源限制，任务之间就不再公平。Context-local overlay 可以隔开并发任务，可底层 provider 依然不能把会变化的状态放进进程全局。

Agent setup 失败、Agent timeout、命令返回非零、环境失联以及网络政策切换失败，都发生在不同阶段，不能压成同一种错误。错误该归给谁，要看当时跑到哪一步。有些任务允许命令返回非零，因为它可能只是 Agent 探索过程中的一次尝试，不能看到一次 exec 非零就判定产品失败，最后仍要按 Agent contract 和 Verifier 的结果下结论。Verifier 期间禁掉 Agent 网络，也推不出 Agent 阶段从未泄漏，平台层还得专门测试网络限制是否真正生效。

## 动手实验

设计一个需要启动本地 HTTP 服务的任务，写明环境镜像、端口、CPU 与内存、Agent 网络、Verifier 网络、哪些目录可以写，以及默认使用哪个用户。随后为 Agent setup、run、日志下载、verification、cleanup 各列出两种可能失败，并说明应该留下什么证据。再比较同一环境与分离环境怎样做验证，分析两者各自暴露多大的攻击面，又要付出多少复制成本。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

Agent 若要在运行时安装依赖，可以给它配置 allowlist，Verifier 通常则可以禁网，免得外部答案干扰测试。允许写入的路径要尽量少，隐藏 tests 也不能在 Agent 阶段挂载。同一环境里的 Verifier 能看到完整的进程和文件状态，却可能读到 Agent 篡改过的测试，分离环境隔离得更彻底，但必须可靠地传递待验工作区，并让两边的 OS 与依赖保持一致。

每个阶段至少要留下起止时间、状态、命令或实现 identity、stdout/stderr 摘要、相关 artifact digest 和异常类型。cleanup 失败不能把已经得到的 reward 改写成成功，而且原始异常仍要保留。

## 如何核对

先看 [`src/harbor/environments/base.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/environments/base.py#L84-L123)，核对 capabilities、resource mode、scoped_exec_env、scoped_output_callback、reset/ensure dirs 和 exec 分别怎样实现。再到 [`src/harbor/trial/trial.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/trial/trial.py#L86-L125)，沿着 network plan 和 hooks 往下追，确认程序按什么顺序切换阶段并收尾环境。

## 本篇不能证明什么

配置里即使声明了禁网、资源受限和容器隔离，也证明不了底层平台真的执行了这些限制，更排除不了内核逃逸、侧信道或并发串扰。每一种具体的 Environment provider 都要单独接受安全测试和故障注入测试。

[上一节](01-job-dataset-trial.md) · [下一节](03-verifier-reward-results.md)
