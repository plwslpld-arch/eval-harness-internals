# LLM-as-a-Judge：先定义测量合同，再接入模型

[上一节](03-retries-and-recovery.md) · [下一节](05-statistical-comparison.md)

## 本篇要解决什么问题

开放式回答、合同风险和多轮 Agent 轨迹很难靠精确匹配来评分，所以不少评测会直接接入 LLM-as-a-Judge。可是，只说「让更强的模型打 0 到 1 分」还算不上完整方案，因为 rubric（评分标准）、输入能看见什么、输出 schema、失败与弃权、位置偏差、校准数据和成本，全都没有交代。Judge（裁判模型）会带来自己的不确定性，不能把它当成事实裁判。本篇从 Reference Harness 的离线 Judge Protocol 入手，看适配层怎样既允许替换具体实现，又让你能够核对证据。

核心路线默认不访问网络。只要对象实现了 `judge_id + judge(ObservationBundle)`，`JudgeScorer` 就可以接收它，离线 Stub 和真实 API 也共用同一份结果合同。这样测试既能锁住 lineage，也不会把模型凭据和模型漂移带进基础门禁。

## 核心机制

![Judge 校准与人工对照](../assets/diagrams/foundations/05-scoring.svg)

Judge 只能读取已经冻结的 ObservationBundle（观测包），而且你要明确规定它能看 output、reference、trace、tools 和 artifacts 里的哪些内容，否则隐藏标签或候选名称可能直接泄漏给评分器。JudgeResult 保存 value、passed 和 reason，JudgeScorer 再补上 scorer_id、judge_id、Bundle digest、canonical Attempt 与 ScoreStatus。调用评分模型时如果需要 retry，也只能恢复 Judge 这一侧的基础设施，不能顺手把 Target 重新跑一遍。

要可靠地接入 Judge，先得用 Rubric 写清要测什么、哪些证据可以观察，再让 Judge Adapter 固定模型、prompt、schema、参数和重试政策。到了 Calibration 阶段，再拿人工双标和仲裁数据去测一致率、偏差、稳定性与阈值。三层都齐了，才构成一份可以检验的测量合同。Release Eval 要使用冻结的 Judge 版本，训练 reward 所用的 Judge 也必须与独立发布 Judge 隔离，否则训练过程会针对发布标准直接优化，最后污染这把尺子。

## 完整流程

1. 从业务风险定义 rubric 条目和不可补偿规则，给出 passed/failed/uncertain/unscorable/invalid 的可操作条件。
2. 构造 Judge input view，只含授权 Observation。对 Candidate/Baseline 比较时随机化顺序并隐藏系统名称。
3. 固定 Judge identity：provider、model/version、系统提示、rubric、few-shot、温度、seed（若支持）、输出 JSON schema、解析器 commit。
4. 调用 Judge，验证结构化输出和值域。解析失败、超时和拒绝属于 Judge error，不是产品 0 分。
5. JudgeResult 经 JudgeScorer 转为 ScoreRecord，lineage 回到 Bundle。reason 作为诊断，不当作模型思维链或事实证明。
6. 在独立校准集上与至少两位人类标注和仲裁结果比较，报告分层一致率、混淆矩阵、阈值敏感性和重复测量方差。
7. 未达到预注册质量要求时，Judge 结果为 uncertain/unscorable 或进入人工复核，而不是调 prompt 直到发布通过。
8. 运行中记录 token、成本、延迟、缓存与错误。报告同时展示 Judge error rate。

## 关键数据与不变量

Judge identity 和 Scorer identity 都必须带版本，因为 Rubric 哪怕只改一个词，模型别名发生漂移，或输出解析器换了实现，都可能改变测量合同。`reason` 不该保存隐藏的 chain-of-thought，只要给出能够审计的判定依据、所引证据和 rubric 条目就够了。如果 Judge 允许 abstain，ScoreStatus 就应该保留 uncertain 或 unscorable，不能一律压成 failed。

做成对 Judge 时，系统要保存 pair key 和展示顺序，再交换 A/B 评一次，这样你才有机会查出位置偏差。即使多个 Judge 一起投票，统计单位仍然是原来的 Trial，不能把 Judge 的数量冒充样本量。人工仲裁结果要单独保存。原始分歧也得留下。

## 动手实验

运行离线接口测试：

```bash
uv run pytest tests/test_runtime_extensions.py -k judge -q
```

先为合同风险案例写一个包含 high/medium/low 三档的 rubric，并增加 `uncertain` 条件。然后定义 StubJudge，让它返回 value=0.8、passed=true 和 reason，再沿输出检查 ScoreRecord 的 trial_id、canonical_attempt_id、bundle digest 和 scorer_id。最后列出真实 Judge 接入时必须新增的配置与校准报告字段，观察离线 Stub 隐去了哪些生产责任。

## 预期输出与答案

离线测试不会访问网络，但 Score 仍然要保存 value=0.8、reason「满足离线规则」和完整 lineage。换成真实配置以后，你至少还得补上 judge_id、provider/model version、prompt/rubric digest、schema、参数、重试与超时、cache policy、成本，以及校准数据版本。

如果 Judge 超时，系统应该记录 Judge error 或不可评分，不能把产品直接记成 0 分。如果两位人工标注者意见不同，仲裁又没有完成，结果就应该是 uncertain，因为测量结论还没定下来。要是 Judge 在关键的高风险条目上持续漏判，那么整体一致率再高，也不能把它接到 release gate 上。

## 如何核对

阅读 [`scorers/judge.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/scorers/judge.py) 的 Protocol、JudgeResult 与 lineage 适配，核对 [`test_runtime_extensions.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_runtime_extensions.py) 的离线 Stub。再对比 [`scorers/rules.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/scorers/rules.py)，理解确定性规则与 Judge 的失败面不同。

## 本篇不能证明什么

结构化输出、reason、多人投票和很高的总体一致率，都证明不了 Judge 没有偏差，也不能说明它真正理解业务，足以判断高风险发布。校准结论只适用于当时的数据分布、rubric 和模型版本，其中任何一项发生变化，都要重新验证。

[上一节](03-retries-and-recovery.md) · [下一节](05-statistical-comparison.md)
