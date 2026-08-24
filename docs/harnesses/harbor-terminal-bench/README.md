# Harbor 与 Terminal-Bench 1：Agent 终端任务怎样成为可核对的 Trial

[上一节](../deepeval/03-async-cache-errors.md) · [下一节](01-job-dataset-trial.md)

## 本篇要解决什么问题

语言模型基准常把“输入发给模型、比较答案”作为主循环；终端 Agent 评测则必须启动隔离环境、安装或连接 Agent、执行多轮命令、保留日志和文件，再在相同或独立环境中运行 verifier。Harbor 是 Terminal-Bench 后续演进出的通用 Agent Harness/Eval Harness 框架；Terminal-Bench 1 保留了更紧凑的早期 Harness 结构。把两者一起阅读，可以看见 Job/Dataset 如何展开 Trial、环境与 Agent 如何交替、Verifier 如何从容器产物生成 reward，以及结果恢复为什么不能只看一个 `resolved` 布尔值。

本课程锁定 Harbor `74f0176384cff88b99306770473b4875760c5a21` 与 Terminal-Bench 1 `d28711d0da2675d0bb1d56de45ae5df6082438a3`。课程用 Terminal-Bench 1 解释紧凑基线，再用 Harbor 展示网络策略、资源能力、事件 hook、regrade、多步结果等扩展。它不是两个项目版本差异大全，也不声称 Harbor 的每项能力都来自 Terminal-Bench 1。

## 先建立源码地图

| 系统 | 锁定文件 | 责任 |
| --- | --- | --- |
| Harbor Job | [`src/harbor/job.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/job.py) | 解析任务/Agent，生成与调度 Trial，恢复 Job |
| Harbor Trial | [`src/harbor/trial/trial.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/trial/trial.py) | 环境、Agent、Verifier 生命周期与事件 |
| Harbor Environment | [`src/harbor/environments/base.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/environments/base.py) | 容器抽象、网络/资源/执行/文件操作 |
| Harbor Verifier/Result | [`src/harbor/verifier/verifier.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/verifier/verifier.py) · [`result.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/models/trial/result.py) | 奖励解析、异常、耗时与多步结果 |
| Terminal-Bench Harness | [`terminal_bench/harness/harness.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/harness/harness.py) | Dataset、Agent、并发 Trial 与 resume |
| Terminal-Bench 数据/结果 | [`dataset.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/dataset/dataset.py) · [`models.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/harness/models.py) | 任务选择、TrialResults、accuracy/pass@k |

## 完整调用链

![Harbor 与 Terminal-Bench 终端 Agent 评测主链](../../assets/diagrams/harnesses/harbor-terminal-bench/end-to-end.svg)

1. Dataset/TaskClient 解析任务版本与选择条件；Job/Harness 再与 Agent、模型、attempt 数组合，生成 TrialConfig 或 trial handler。
2. 运行锁与输出目录固定 dataset、agent、模型、超时、并发和网络等配置；resume 只接受匹配配置，并区分完整结果与残留中间产物。
3. Trial 创建 Agent environment，准备任务文件和目录，执行 Agent setup/run，并把 stdout/stderr、trajectory、文件与 token/cost 记录到 Trial 路径。
4. Agent 结束后切换网络/环境阶段，启动 verifier。Harbor 可让 verifier 与 Agent 同环境或分离环境，避免 Agent 篡改测试或利用验证期网络。
5. Verifier 注入测试、运行测试命令并下载 verifier 目录，从 reward JSON 或文本解析数值；文件缺失、空文件、非法 JSON 分别是验证基础设施错误。
6. TrialResult 保存 AgentInfo、AgentContext、VerifierResult、异常、setup/execution timing 和多步 StepResult；Job 汇总各 Trial reward 与统计。
7. Terminal-Bench BenchmarkResults 根据每 task 的多次 Trial 计算 accuracy 和 pass@k。Attempt 数是每任务重复观察，不是基础设施 retry；结果解释必须保留 task 聚类。

## 关键数据结构

Task 描述 instruction、环境构建和 verifier；Dataset 是锁定任务集合。TrialConfig 把一个 Task、一个 Agent/模型、一个 attempt 与环境政策固定为运行单位。AgentContext/AgentResult 保存终端 Agent 轨迹、token 与成本。VerifierResult 保存具名 rewards。TrialResult 还保存异常和各阶段时间。JobResult/BenchmarkResults 是派生汇总，不能替代 Trial 目录中的配置、日志与 verifier 产物。

在统一模型中，Terminal-Bench 的 n_attempts 更接近同一 Sample 的多个随机 Trial，而非网络重试 Attempt。Reference Harness 使用 Trial/Attempt 术语时会明确区分：随机重复增加 Trial 分母，基础设施恢复留在同一 Trial 下。跨工具比较必须先翻译术语，不能只看字段名。

## 实现取舍与失败语义

容器把任务依赖和副作用隔离，使文件与命令可验证；代价是镜像、运行时、网络和资源限制都进入实验身份。Verifier 与 Agent 分离提高防篡改能力，但需要复制工作区或明确共享产物，环境差异也可能制造假失败。resume 节省成本，但必须在锁配置相同且结果完整时复用，残留目录不能冒充完成。

Agent 未解决任务是产品失败；Agent 进程崩溃可能是产品或适配错误；环境构建失败、健康检查失败、Verifier reward 缺失是 Harness 错误；超时还要注明发生在 setup、agent 还是 verifier。只有分层记录，Gate 才能区分“不通过”和“无法判断”。

## 动手实验

为“在容器中修复一个损坏的配置文件”设计 Task：列出 instruction、初始文件、网络策略、资源限制、Agent 可写路径、隐藏 verifier 和 reward。给同一 Task 安排 3 个随机 Trial，再为第二个 Trial 的容器启动失败安排一次基础设施重试；写出正确的 Trial/Attempt 数量。最后解释为何只保存 `reward=1` 无法复现或审计。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

三个随机重复是 3 个 Trial；第二个 Trial 的容器恢复是该 Trial 下的另一个 Attempt，统计分母仍是 3。reward=1 没有说明任务/测试版本、Agent/模型、环境镜像、网络、资源、轨迹、Verifier 命令与产物，也不能判断奖励是否由合法 verifier 生成。

课程测试只验证锁定链接和教材合同，不会拉起 Docker 或运行外部 Agent；具体平台的容器安全与资源隔离需要单独集成测试。

## 如何核对

从 [`src/harbor/job.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/job.py) 追 Job.create、TrialConfig 初始化与 queue hooks；在 [`src/harbor/trial/trial.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/trial/trial.py) 找环境/Agent/verifier phase；再与 [`terminal_bench/harness/harness.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/harness/harness.py) 的 resume 和并发逻辑对照。

## 本篇不能证明什么

容器、隐藏测试、reward 文件和 pass@k 不能证明任务无漏洞、Agent 未利用侧信道、测试覆盖完整或结果可外推到真实软件工程。课程也不把框架自身测试通过扩大为某个 Agent 能力证明。

[上一节](../deepeval/03-async-cache-errors.md) · [下一节](01-job-dataset-trial.md)
