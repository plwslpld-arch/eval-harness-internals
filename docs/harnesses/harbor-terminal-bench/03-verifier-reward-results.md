# Verifier、Reward 与 Result：成功数字怎样回连执行证据

[上一节](02-environment-agent-lifecycle.md) · [下一节](../../contents.md)

## 本篇要解决什么问题

终端任务最终通常会输出 reward 0/1 或一组具名 rewards，看起来比模型 Judge 更客观，但 reward 文件仍可能缺失、内容为空、格式错误、由错误的测试版本生成，甚至被 Agent 提前写入。数值不能替代产物链。Verifier 的可信度来自受控测试、阶段隔离和完整产物链，而不是数字类型本身——下文会追踪 Harbor Verifier 怎样布置测试、执行验证并解析 reward，也会说明 TrialResult/BenchmarkResults 如何保留异常与汇总结果。

读完后，你应该能区分测试失败并得到合法 reward 0、Verifier 自身崩溃而没有 reward、Reward 解析错误、Agent timeout 与 regrade，还能解释 accuracy 和 pass@k 分别使用什么统计单位，以及这些数字有哪些限制。

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

VerifierResult 的 rewards 是从字符串到数值的映射，因此可以同时容纳主 reward 与组件 reward，但每个值的语义和范围都由 Task/Verifier 契约定义，不能默认它们都落在 0 到 1 之间。取值范围来自契约。ExceptionInfo 保存类型、消息和 traceback，TimingInfo 保存阶段起止时间与时长，而 StepResult 会为多步任务记录每一步的 Agent、Verifier 与 exception。需要计算成本时，TrialResult.compute_token_cost_totals 再从单步或多步 AgentContext 中汇总。

BenchmarkResults 计算 pass@k 时，输入的是每个 task 的成功计数，而不是把所有 Trial 打散之后混在一起。如果各 task 的 n 不同、缺失并非随机，或 Task 数量很少，那么单个平均值就必须同时给出分母、分布和不确定性。reward 组件也不能在没有预注册的情况下事后挑选，只展示最有利的指标。

## 实现取舍与失败语义

文件协议让任意语言编写的 tests 都能与 Python Harness 解耦，同时也形成清晰的 artifact——不过路径、格式和写入原子性必须严格遵守约定。优先读取 JSON 可以支持多个 reward，文本格式则兼容简单任务，而专门异常能够避免基础设施故障被误记成 Agent 失败，从而守住证据边界。

regrade 可以在不重复昂贵 Agent 执行的前提下修复 Verifier 或应用新标准，但它会改变 Scorer identity，所以报告必须并列保留原 verifier result，不能直接覆盖旧结果。覆盖会切断证据链。pass@k 适合回答“允许多次尝试时能否成功”这类产品问题，可如果线上只有一次机会，只展示 pass@10 就会误导读者。发布 Gate 还必须处理环境错误、缺失 Trial、任务权重和关键任务非补偿规则。

## 动手实验

设计一份 reward JSON，其中包含主 reward、功能正确性、安全和资源合规四项，并为每项规定合法范围。接着列出测试失败、reward 文件为空、JSON 中出现字符串、下载失败这四种情况应得到的 Trial 状态。再为两个任务各安排 3 次 Trial，设 A 成功 2 次、B 成功 0 次，计算 accuracy 与 resolved task 数，并描述 pass@1 和 pass@2 的变化方向，最后写出 regrade 证据清单。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

测试合法运行却断言失败时，可以写入 reward 0，而其余三种情况分别属于 verifier、解析或传输错误，不应该伪造成 0。总 Trial accuracy 是 2/6，如果把 resolved task 定义为“至少成功一次”，结果就是 1/2。pass@2 会高于或等于 pass@1，但任务 B 仍然是 0，具体估计则应使用锁定公式计算，并报告每个 task 的 n/c。

Regrade 至少要保存 source trial id 与 artifact digest、新旧 verifier commit/tests digest、环境 identity、regrade 时间、旧新 rewards 和差异原因，因为它只是重新评分，并不会产生新的 Agent Trial。这不是新的 Trial。

## 如何核对

先在 [`src/harbor/verifier/verifier.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/verifier/verifier.py#L96-L135) 依次核对 `_resolve_tests`、verify、reward JSON/text 解析和专门异常，再到 [`src/harbor/models/trial/result.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/models/trial/result.py#L21-L36) 检查异常、阶段时间与多步字段，最后查看 [`terminal_bench/harness/models.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/harness/models.py#L43-L59) 使用的 pass@k 聚合单位。

## 本篇不能证明什么

隐藏 tests、数值 reward 与 pass@k 都不能证明测试没有漏洞、reward 与真实价值一致、Agent 从未利用环境，也不能证明观察到的差异具有统计显著性。发布结论还必须结合任务治理、错误率、不确定性与关键风险 Gate。

[上一节](02-environment-agent-lifecycle.md) · [下一节](../../contents.md)
