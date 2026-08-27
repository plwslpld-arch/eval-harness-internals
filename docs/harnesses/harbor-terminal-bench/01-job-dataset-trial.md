# Job、Dataset 与 Trial：运行计划怎样固定统计单位

[上一节](README.md) · [下一节](02-environment-agent-lifecycle.md)

## 本篇要解决什么问题

把 100 个任务各跑 3 次，看起来只是把 300 个工作项扔进并发队列，真正实现时却还要筛任务、组合不同 Agent 与模型、恢复旧结果、避开目录冲突、标记每次随机重复，并在 Job（作业）层汇总统计。Harbor 的 Job 和 Terminal-Bench 1 的 Harness 都在 Trial（试验）上面处理这些工作，所以这一篇要看计划怎样铺开，配置怎样锁住，以及恢复旧结果为什么也会影响统计是否正确。

这三类对象要先分开：Dataset 决定哪些任务可以入选，Job/Harness 规定这次实验怎么跑，Trial 才表示某个 Agent 在某个任务环境里独立运行了一次。任何一层发生变化，历史结果都可能无法再直接并入新结果。

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

DatasetConfig 锁定数据集名称、版本、路径和筛选条件，JobConfig/RunLock 再锁定 Agent、模型、并发、n_attempts、超时、网络与环境政策，TrialConfig 由此标出一组不会混淆的运行坐标，而且这组坐标必须稳定。只有 TrialResult 才能代表一份完整的执行证据，单凭「目录存在」或「config 存在」都不够。JobStats 和 BenchmarkResults 只是从 TrialResult 算出来的缓存，即使删掉后重建，也应该能靠逐行结果重新算出相同数字。

Terminal-Bench 在 TrialResults 里保存 task_name、trial_name、reward 等字段，BenchmarkResults 会先把结果按 task 分组，数出每个任务成功了几次，再据此估计 pass@k。这样才能保住 task 这个聚类单位，不会把 300 条 Trial 误当成 300 个不同任务，夸大实际覆盖范围。

## 实现取舍与失败语义

预先把计划全部展开，方便程序显示进度，也方便中断后恢复，但矩阵很大时会占用不少内存，动态生成的任务还必须先冻结版本。按预计时长排序能提高吞吐，却不该改动 Trial 的内容。可一旦全局超时使排在后面的任务更容易缺结果，排序就已经改变了数据怎样缺失，分析时必须把这项条件记下来。

严格检查 RunLock，可以拦住彼此不兼容的结果，代价是配置哪怕只改一点，也得换一个新的 run_id，这是守住实验身份必须付出的成本。清理不完整产物前，你还要确认目录确实只属于目标 Trial。已经完成的结果若缺少证据摘要，或锁定配置对不上，就应该直接拒绝复用。任务被取消、进程崩溃或用户中断时也要保存状态，不能因为没有 reward 就让它从计划中消失，缺失状态同样要入账。

## 动手实验

假设 Dataset 共有 12 个任务，include 从中选出 8 个，exclude 又删去 2 个，同时配置 2 个 Agent，并给每一项安排 3 个随机 Trial。请算出计划一共有多大，再设计一组稳定坐标。随后假设已有 30 条完成结果，另有 8 条带着完整 config 却没有 result，其余还没启动，写出 resume 应该复用多少条、清理多少条、重新调度多少条，并说明模型版本改变后为什么不能继续使用原 run_id。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

筛选后实际剩下 6 个任务，所以计划共有 `6 × 2 × 3 = 36` 个 Trial。稳定坐标至少要包括 dataset commit/task id、Agent 与模型 identity，以及 repetition index。30 个完整结果可以复用，但「8 个无 result」与计划总数冲突，因为整个计划只有 36 项。这正说明恢复前必须先核对清单，不能看到几个数字就直接相加。若把条件改成 4 条不完整结果，就要清掉并重新调度这 4 条，再加上另外 2 条尚未启动的任务，一共调度 6 条。模型版本一变，Target identity 也跟着变，因此要另建 Job。

这个矛盾是故意留下的，它提醒你先核对计划全集以及各组结果之间的关系，别拿到日志数字就直接相加，而要先校验恢复清单。

## 如何核对

先到 [`src/harbor/job.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/job.py#L237-L276) 看 `_maybe_init_existing_job`、`_init_trial_configs` 和 remaining config，弄清 Job 怎样识别旧结果并算出还要运行哪些 Trial。再用 [`terminal_bench/harness/harness.py`](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/terminal_bench/harness/harness.py#L200-L239) 里的 `_validate_resume_configuration` 与 `_filter_completed_and_cleanup_incomplete_tasks` 对照，核对两套实现各自在什么条件下允许恢复。

## 本篇不能证明什么

计划没有漏项、RunLock 能对上、resume 也成功了，仍然证明不了各个 Trial 真正彼此独立、随机种子确实生效，或任务难度能够代表真实场景，也排除不了有人改过历史结果。你还要用额外机制生成可靠的证据摘要，并把结果放进不可变存储。

[上一节](README.md) · [下一节](02-environment-agent-lifecycle.md)
