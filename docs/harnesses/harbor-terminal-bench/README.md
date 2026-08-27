# Harbor 与 Terminal-Bench 1：Agent 终端任务怎样成为可核对的 Trial

[上一节](../deepeval/03-async-cache-errors.md) · [下一节](01-job-dataset-trial.md)

## 本篇要解决什么问题

语言模型基准常把「输入发给模型、再比较答案」当作主循环，终端 Agent 的评测却要先启动隔离环境，安装或连接 Agent，让它执行多轮命令并留下日志与文件，之后才能在同一个或另一个环境中运行 Verifier（验证器）。Harbor 从 Terminal-Bench 演进而来，后来成为通用的 Agent Harness/Eval Harness，Terminal-Bench 1 则保留了更紧凑的早期结构。把两边源码对着看，你就能弄清 Job/Dataset 怎样铺开 Trial（试验），环境和 Agent 怎样交替工作，Verifier 怎样从容器产物算出 reward，也能明白恢复旧结果时为什么不能只看一个 `resolved` 布尔值。

本课程锁定 Harbor `74f0176384cff88b99306770473b4875760c5a21` 和 Terminal-Bench 1 `d28711d0da2675d0bb1d56de45ae5df6082438a3`，前几篇先借 Terminal-Bench 1 讲清紧凑的基线流程，再看 Harbor 怎样加入网络策略、资源能力、事件 hook、regrade 和多步结果。这份课程不罗列两个项目的全部版本差异，也不暗示 Harbor 的每项能力都来自 Terminal-Bench 1。

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

Task 写明 instruction、环境怎么构建以及 verifier 怎么运行，Dataset 收住锁定后的任务集合，TrialConfig 再把一个 Task、一个 Agent/模型、一次 attempt 和一套环境政策固定成一次运行。终端 Agent 跑过以后，AgentContext/AgentResult 留下轨迹、token 和成本，VerifierResult 留下具名 rewards，TrialResult 还会记异常以及各阶段花了多久，所以汇总不能代替逐行证据。JobResult/BenchmarkResults 都是从逐行结果算出来的，也代替不了 Trial 目录里的配置、日志和 verifier 产物。

映射到统一模型以后，Terminal-Bench 的 n_attempts 更接近同一个 Sample 上重复进行的多个随机 Trial，并非网络重试所产生的 Attempt。Reference Harness 会明确分开这两层，因为随机重复要增加 Trial 的统计分母，基础设施恢复却仍挂在原来的 Trial 下。跨工具比较时，你得先把双方术语对应到同一套模型，不能看见字段同名就认定它们是同一种对象。

## 实现取舍与失败语义

容器会隔开任务依赖和运行副作用，让 Verifier 有机会检查文件与命令产生的结果，但镜像、运行时、网络和资源限制也因此成了实验条件。把 Verifier 和 Agent 放进不同环境，可以降低测试被篡改的风险，可你必须复制工作区或明确哪些产物共享，两个环境之间的差异也可能凭空制造失败。resume 能省下重复运行的成本，但只有锁定配置完全一致、旧结果也完整时才能复用，残留目录不能冒充完成状态。

Agent 正常跑完却没解决任务，属于产品失败。Agent 进程崩溃，则可能是产品自身的问题，也可能是适配写错了。环境构建失败、健康检查失败和 Verifier reward 缺失要记成 Harness 错误，遇到超时还得注明发生在 setup、agent 还是 verifier 阶段，这些阶段不能混写。只有分层留下这些情况，Gate 才分得清「不通过」与「无法判断」。

## 动手实验

为「在容器中修复一个损坏的配置文件」设计 Task，写明 instruction、初始文件、网络策略、资源限制、Agent 可以写哪些路径、隐藏 verifier 怎样运行，以及 reward 怎样产生。给同一个 Task 安排 3 个随机 Trial，再让第二个 Trial 因容器启动失败而做一次基础设施重试，并算出正确的 Trial/Attempt 数量。最后解释为什么只保存 `reward=1`，既不能复现，也无法审计这次运行。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

三个随机重复会产生 3 个 Trial，第二个 Trial 恢复容器时只是在它下面再添一个 Attempt，所以统计分母仍然是 3，并没有增加。只看 reward=1，你不知道任务与测试用了哪个版本，也不知道 Agent、模型、环境镜像、网络、资源、轨迹、Verifier 命令和产物分别是什么，自然无法判断这个奖励是不是由合法 verifier 算出来的。

课程测试只检查锁定链接和教材合同，不会真的拉起 Docker 或运行外部 Agent，因此还得为具体平台单独编写集成测试，验证容器安全与资源隔离。

## 如何核对

先看 [`src/harbor/job.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/job.py)，沿着 Job.create 往下追，弄清程序怎样初始化 TrialConfig，又怎样触发 queue hooks。再到 [`src/harbor/trial/trial.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/trial/trial.py) 找出环境、Agent 和 verifier phase 分别何时运行，最后拿 [`terminal_bench/harness/harness.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/harness/harness.py) 里的 resume 与并发逻辑来对照。

## 本篇不能证明什么

用了容器、隐藏测试、reward 文件和 pass@k，也证明不了任务没有漏洞、Agent 从未利用侧信道，或测试已经覆盖完整，更不能保证这些结果可以外推到真实的软件工程工作。课程也不会因为框架自己的测试通过，就宣称某个 Agent 已经具备相应能力。

[上一节](../deepeval/03-async-cache-errors.md) · [下一节](01-job-dataset-trial.md)
