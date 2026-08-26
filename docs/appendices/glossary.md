# 术语表

[上一节](../labs/06-build-a-release-gate.md) · [下一节](verification.md)

| 术语 | 本仓库中的精确定义 |
| --- | --- |
| Task / TaskSpec | 描述要解决的问题、允许行为、环境和判定契约；不是一次执行结果。 |
| Dataset | 有版本、来源和切分政策的 Sample 集合。 |
| Sample | Dataset 中的逻辑样本；通常是任务输入与冻结参考。 |
| Target | 被测 AI 系统边界，可以是模型、RAG、Agent 或本地程序。 |
| Target Adapter | 把某种 Target 的输入输出和错误翻译为 Harness 统一合同。 |
| Environment | Target 执行所处的文件、进程、网络、资源和权限状态。 |
| Trial | 预先规划的统计观察单位：某 Sample × Target × repetition。 |
| Attempt | 同一 Trial 的基础设施恢复记录；不增加统计分母。 |
| canonical Attempt | 进入主 Observation 和评分的唯一成功执行尝试。 |
| Trace | 具有时间或因果关系的结构化运行事件。 |
| Artifact | 日志、diff、输出、终态等内容寻址 bytes。 |
| ObservationBundle | Scorer 被允许读取的冻结 Trace/Artifact 视图。 |
| Scorer | 将 Observation 与 Reference 转成 ScoreRecord 的实现。 |
| Judge | Scorer 可调用的开放式测量依赖，通常是另一个模型。 |
| Score | 单个 Trial 的测量结果与状态。 |
| Metric | 按预声明分母聚合多个 Score 的估计。 |
| Comparison | Candidate/Baseline 的配对效果量与不确定性结果。 |
| Gate | 验证证据资格并应用发布政策的机器决定。 |
| blocked | 缺少预声明执行条件，无法完成该层。 |
| inconclusive | 已有证据不足以支持通过或失败。 |
| invalid | 身份、协议或血缘错误使对象不能进入预期推断。 |
| RewardAdapter | 将合格 Score/Preference 转成训练信号的版本化适配器。 |

不同上游术语可能同名异义。因此，源码课程仍会保留上游原名——横向比较时则先把这些名称映射到本表，然后再说明其中无法等价的部分。

[上一节](../labs/06-build-a-release-gate.md) · [下一节](verification.md)
