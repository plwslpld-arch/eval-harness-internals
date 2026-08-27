# Job、Dataset 与 Trial：运行计划怎样固定统计单位

[上一节](README.md) · [下一节](02-environment-agent-lifecycle.md)

## 本篇要解决什么问题

运行 100 个任务并把每个任务重复 3 次，看起来只是得到 300 个并发工作项，但真正实现时还得处理任务过滤、不同 Agent 与模型组合、既有结果恢复、结果目录冲突、随机重复身份和 Job 级统计。Harbor 的 Job 与 Terminal-Bench 1 的 Harness 都把这些责任放在 Trial 之上，所以下文会解释计划怎样展开、配置怎样锁定，以及恢复逻辑为何也是统计正确性的一部分。

首先要分清三类对象，因为 Dataset 决定候选任务，Job/Harness 决定本次实验政策，而 Trial 才表示一个 Agent 在一个任务环境中的独立运行。只要其中任意一层发生变化，历史结果就可能无法与新结果直接合并。

## 先建立源码地图

| 源码位置 | 责任 | 阅读问题 |
| --- | --- | --- |
| [`src/harbor/job.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/job.py) | Job.create、任务解析、TrialQueue、既有结果 | 如何生成与恢复 Trial |
| [`terminal_bench/harness/harness.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/harness/harness.py) | RunLock、task/attempt 展开和 resume | 配置匹配与残留清理 |
| [`terminal_bench/dataset/dataset.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/dataset/dataset.py) | 数据集缓存、include/exclude、限制与排序 | 本次实际任务集合如何确定 |

## 完整调用链

![Job 从数据集生成 Trial 计划](../../assets/diagrams/harnesses/harbor-terminal-bench/job-trial.svg)

1. Dataset 根据 name/version/path 或 YAML 构造，缓存远程内容，再应用 include、exclude、task_ids 和 n_tasks；排序可以按预计时长改善并发利用率。
2. Job.create 解析 Task 配置、Agent skills 与环境资源政策；Terminal-Bench Harness 初始化 Agent class 和 Dataset。
3. 计划层对 task × agent/model × repetition 展开。每个 Trial 获得稳定名称/UUID、独立输出目录和完整 TrialConfig。
4. Job 若发现已有目录，读取 JobConfig、TrialConfig 与 TrialResult，验证身份后把完成项加入 existing results/rewards/stats，并只调度 remaining configs。
5. Terminal-Bench 用 RunLock 比较当前 dataset、agent 与 run config；不一致时拒绝 resume。结果文件完整的 Trial 被跳过，只有部分 artifacts 的任务目录会先清理后重跑。
6. TrialQueue 按并发策略运行剩余 Trial，并在 START/CANCEL/END 等事件更新 Job 级状态；完成结果逐项写盘，不等待整个 Job 才保存。
7. JobResult/BenchmarkResults 由 TrialResults 汇总；统计代码按 task 聚合多次重复，计算 resolved、accuracy 与 pass@k。

## 关键数据结构

DatasetConfig 固定数据集名称、版本、路径与筛选条件，JobConfig/RunLock 则固定 Agent、模型、并发、n_attempts、超时、网络和环境政策，因此 TrialConfig 才是一组不可混淆的运行坐标。坐标必须保持稳定。真正代表完整执行证据的是 TrialResult，单凭「目录存在」或「config 存在」都不能替代它。JobStats 与 BenchmarkResults 只是从 TrialResult 派生出来的缓存，所以即使需要重建，也应该能从行级结果重新计算。

Terminal-Bench 的 TrialResults 包含 task_name、trial_name、reward 等字段，而 BenchmarkResults 会先按任务计算每个 task 的成功次数，再据此估计 pass@k。这样做保留了 task 这个聚类单位，避免把 300 条 Trial 当成 300 个不同任务，从而夸大任务覆盖。

## 实现取舍与失败语义

预先展开计划方便显示进度和恢复运行，不过矩阵规模很大时也可能占用不少内存，而动态任务还必须冻结版本。按照预计时长排序可以提高吞吐，却不应该改变 Trial 内容。可如果全局超时让排在后面的任务更容易缺失，排序就已经影响了缺失机制，分析时必须把它记录下来。

严格的 RunLock 可以阻止不相容结果被错误合并，代价是很小的配置变化也需要新的 run_id，而这是维护实验身份必须承担的成本——在清理不完整产物之前，必须确认目录只属于目标 Trial，如果已完成结果缺少摘要或配置不匹配，就应拒绝复用。取消、进程崩溃和用户中断也要保留状态，不能因为没有 reward 就从计划里消失。缺失状态也要入账。

## 动手实验

设 Dataset 共有 12 个任务，include 选中其中 8 个，exclude 又去掉 2 个，同时配置 2 个 Agent，并为每项安排 3 个随机 Trial。请计算计划规模并设计稳定坐标。随后假设已经完成 30 条，另有 8 条带完整 config 却没有 result，其余尚未启动，写出 resume 应复用、清理和重新调度的数量，再说明模型版本一旦改变，为何不能沿用原 run_id。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

筛选后的实际任务有 6 个，因此计划共包含 `6 × 2 × 3 = 36` 个 Trial，而稳定坐标至少要覆盖 dataset commit/task id、Agent 与模型 identity 以及 repetition index。30 个完整结果可以复用，但「8 个无 result」与总计划互相矛盾，因为整个计划只有 36 项，这说明恢复清单必须先校验，不能拿到数字就盲算。如果把条件改成 4 条不完整，就应清理并重新调度这 4 条，同时调度另外 2 条未启动任务，共计 6 条。模型版本变化会改写 Target identity，所以应建立新的 Job。

这个矛盾是有意留下的，它要求读者先验证计划全集与集合关系，而不是拿到日志数字就直接相加。应先校验恢复清单。

## 如何核对

先在 [`src/harbor/job.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/job.py#L237-L276) 阅读 `_maybe_init_existing_job`、`_init_trial_configs` 与 remaining config，然后到 [`terminal_bench/harness/harness.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/harness/harness.py#L200-L239) 对照 `_validate_resume_configuration` 和 `_filter_completed_and_cleanup_incomplete_tasks`，核对两套恢复边界。

## 本篇不能证明什么

计划完整、RunLock 匹配并且 resume 成功，都不能证明 Trial 彼此真正独立、随机种子有效、任务难度能够代表真实场景，也不能排除历史结果被人工修改的可能。证据摘要与不可变存储仍然需要额外机制。

[上一节](README.md) · [下一节](02-environment-agent-lifecycle.md)
