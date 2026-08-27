# Verifier、Reward 与 Result：成功数字怎样回连执行证据

[上一节](02-environment-agent-lifecycle.md) · [下一节](../../contents.md)

## 本篇要解决什么问题

终端任务最后通常会给出 reward 0/1，或一组带名字的 rewards，看上去比 Judge（裁判模型）更客观，可 reward 文件仍可能根本不存在，也可能是空文件、格式写错、由错误版本的测试生成，甚至早就被 Agent 偷偷写好了，因为一个数字代替不了整条产物链。Verifier（验证器）是否可信，要看测试有没有受控、各阶段有没有隔离、产物能不能一路对上。这一篇会追踪 Harbor Verifier 怎样放入测试、运行验证、解析 reward，再看 TrialResult/BenchmarkResults 怎样留下异常并汇总结果。

读完后，你应该能分清五种情况：测试正常运行后给出合法的 reward 0，Verifier 自己崩溃所以没有 reward，Reward 无法解析，Agent timeout，以及 regrade。你还要能说清 accuracy 和 pass@k 各自按什么单位统计，又有哪些数字不能从中推出。

## 先建立源码地图

| 源码位置 | 责任 | 阅读焦点 |
| --- | --- | --- |
| [`src/harbor/verifier/verifier.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/verifier/verifier.py) | 测试目录、Verifier 执行、reward 解析 | 合法失败与基础设施错误 |
| [`src/harbor/models/trial/result.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/models/trial/result.py) | TrialResult、ExceptionInfo、TimingInfo、StepResult | 结果如何保留上下文 |
| [`terminal_bench/harness/models.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/harness/models.py) | BenchmarkResults、accuracy、pass@k | 多次 Trial 怎样聚合 |

## 完整调用链

![Verifier 到发布判断的证据链](../../assets/diagrams/harnesses/harbor-terminal-bench/verifier-result.svg)

1. Verification phase 解析 Task 的 tests 和 verifier 配置，确定测试来源、执行命令与工作目录；测试文件被加入 verifier environment，而不是暴露给 Agent。
2. Verifier 清理/准备 verifier 目录，将 tests 注入环境，运行测试命令并下载 verifier 输出；命令退出状态和日志是诊断证据，但最终 reward 由约定文件提供。
3. 若存在 reward JSON，解析为具名数值映射；否则尝试 reward 文本并包装为 `{"reward": number}`，而 JSON 优先级和路径是外部契约的一部分。
4. 文件不存在、文件为空、数值/JSON 无法解析、测试目录下载失败分别抛出专门异常。它们不会被伪造成 reward 0。
5. 成功解析得到 VerifierResult；TrialResult 同时保存 AgentInfo、AgentContext、verifier_environment_mode、exception、各阶段 TimingInfo，以及单步或多步 StepResult。
6. Regrade 可复用源 Trial 的 Agent 产物并重新运行 Verifier。新结果必须回连 source trial 与 verifier 版本，不能伪装为 Agent 再次执行。
7. Job/Benchmark 聚合每 task 的 Trial reward。accuracy 表示成功 Trial 比例；pass@k 按每 task 的 n 次观察和 c 次成功估计至少一次成功概率，再跨 task 平均。

## 关键数据结构

VerifierResult 用字符串把名字映射到数值，所以既能保存主 reward，也能保存各个组件的 reward，但每个值表示什么、允许落在哪个范围，都要看 Task/Verifier 怎样定合同，不能默认它们全在 0 到 1 之间。ExceptionInfo 记异常类型、消息和 traceback，TimingInfo 记每个阶段何时开始、何时结束、持续多久，StepResult 则为多步任务逐步留下 Agent、Verifier 和 exception。需要统计成本时，TrialResult.compute_token_cost_totals 再从单步或多步 AgentContext 里把数据加总。

BenchmarkResults 计算 pass@k 时，会先按 task 分组，再数每个任务成功了几次，不会把所有 Trial 拆散后混成一池。若各个 task 的 n 不同、结果并非随机缺失，或 Task 本来就很少，只报一个平均值会遮住太多信息，必须同时给出分母、分布和不确定性。各项 reward 也要预先登记，不能事后只挑最有利的指标展示。

## 实现取舍与失败语义

通过文件交换结果，任意语言编写的 tests 都能脱离 Python Harness 独立运行，也会自然留下清楚的 artifact，但路径、格式和原子写入必须严格遵守约定。程序优先读取 JSON，可以一次提供多个 reward，文本格式则用来兼容只有单项结果的简单任务。解析器针对不同故障抛出专门异常，才能避免把基础设施问题误记成 Agent 失败，也不会把证据边界搅乱。

regrade 不用重复昂贵的 Agent 执行，就能修复 Verifier 或套用新标准，可它也改变了 Scorer identity，因此报告必须并列保留原来的 verifier result，不能直接覆盖旧结果，否则就会切断证据链。pass@k 适合回答「允许多次尝试时能否成功」，可线上若只有一次机会，只展示 pass@10 就会误导读者。发布 Gate 还得处理环境错误、缺失 Trial、任务权重，以及关键任务之间不能互相补偿的规则。

## 动手实验

设计一份 reward JSON，里面包含主 reward、功能正确性、安全和资源合规四项，并给每一项规定合法范围。接着列出测试失败、reward 文件为空、JSON 里混入字符串、下载失败时，Trial 分别应该记成什么状态。再为两个任务各安排 3 次 Trial，假设 A 成功 2 次、B 一次也没成功，算出 accuracy 和 resolved task 数，并说明 pass@1 到 pass@2 会怎样变化，最后列一份 regrade 证据清单。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

测试正常运行但断言失败时，Verifier 可以按约定写入合法的 reward 0。其余三种情况分别说明 verifier、解析或传输出了错，不应该伪造成 0。所有 Trial 合在一起时，accuracy 是 2/6，若把 resolved task 定义成「至少成功一次」，结果就是 1/2。pass@2 会大于或等于 pass@1，但任务 B 仍是 0，具体数值要按锁定公式计算，并报告每个 task 的 n/c。

Regrade 至少要保存 source trial id 和 artifact digest、新旧 verifier commit/tests digest、环境 identity、regrade 时间、新旧 rewards 以及结果为何变化，因为它只会重新评分，不会让 Agent 再跑一次，也不会产生新的 Trial。

## 如何核对

先看 [`src/harbor/verifier/verifier.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/verifier/verifier.py#L96-L135)，依次核对 `_resolve_tests`、verify、reward JSON/text 解析以及各类专门异常。再到 [`src/harbor/models/trial/result.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/models/trial/result.py#L21-L36)，检查代码怎样保存异常、阶段时间和多步字段。最后查看 [`terminal_bench/harness/models.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/harness/models.py#L43-L59)，确认 pass@k 究竟按什么单位聚合。

## 本篇不能证明什么

藏起 tests、把 reward 写成数值、再算出 pass@k，也证明不了测试没有漏洞、reward 真能代表实际价值，或 Agent 从未利用环境，更证明不了观察到的差异具有统计显著性。要下发布结论，还必须结合任务治理、错误率、不确定性和关键风险 Gate。

[上一节](02-environment-agent-lifecycle.md) · [下一节](../../contents.md)
