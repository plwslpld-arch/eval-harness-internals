# 案例四：合同审查 Agent 的多值 Reference 与 Judge 仲裁

[上一节](knowledge-assistant.md) · [下一节](../labs/01-run-one-deterministic-eval.md)

## 本篇要解决什么问题

合同条款很少只有一个标准答案，因为法域、谈判地位和业务背景一变，同一条责任上限既可能评为 medium，也可能评为 high。评测若只做字符串精确匹配，就会误伤合理答案，但全交给一个 Judge，评分又容易漂移。这个案例先拿无限责任、责任上限和书面通知三条确定规则做 Fixture（测试夹具），跑通 risk_band 的基本流程，再引入多值 Reference（参考答案）、Rubric、双人标注和仲裁。

Buggy Target 只认得书面通知，碰到其他条款一律报 medium，所以无限责任这样的高风险条款会被它漏掉，而 Fixed Target 会按冻结的关键词规则判断，给出 high、medium 或 low。

## 核心机制

![合同审查的规则、Judge 与仲裁链](../assets/diagrams/cases/contract.svg)

评测分两段来做：确定的结构规则和关键条款规则守住能直接验证的底线，开放式解释则交给 Judge，让它对照 Rubric 打分。Reference 既可以列出允许哪些答案，也可以说明每个答案在什么条件下成立。例如 liability cap 没给金额背景时，`{medium, high}` 都能接受，但 reason 得把不确定在哪里说清楚，没必要逼它命中唯一字符串。两位专家先各自标注，即使判断不同也要把两份意见都留下，仲裁人随后参考这些意见写出 adjudicated reference，而且不能覆盖原始意见。

如果系统把无限责任判成低风险，这次关键漏判会直接触发非补偿 Gate（门禁），其他样本答得再好也抵消不了，至于措辞是否漂亮，只能算次要指标。送给 Judge 的 input 还得藏掉候选名称和人类最终标签，免得泄漏的信息左右评分。

## 完整流程

1. Dataset 固定 clause、jurisdiction、contract role、上下文与多值 reference/rubric；按合同家族切分防止相似条款泄漏。
2. Target 输出 structured findings：clause span、risk type、risk band、reason、建议；Fixture 只演示 risk_band。
3. 确定性 Scorer 检查 schema、span 与关键关键词；Judge Scorer 评估 reasoning/risk 的可接受集合。
4. Judge error 与 disagreement 分开保存；低置信或专家分歧进入 uncertain/人工仲裁，不强压成 0/1。
5. Metric 报关键风险 recall、false positive、band agreement、reason quality 和 unscorable rate；按合同聚类。
6. Candidate/Baseline 在同条款配对，查看关键漏判差异和总体效果区间。
7. Gate 先要求 unlimited liability 等 critical recall=100%，再看总体质量、成本和延迟。
8. 新判例/政策变化产生新 reference version，不用新标准重写旧报告。

## 关键数据与不变量

Reference 里要写清来源、专家、时间和法域，还要列出允许哪些答案、必须说到哪些要点以及哪里存在 uncertainty，Judge identity 则记下实际用了哪个模型、rubric、prompt 和 schema。你可以用 clause span 找到证据，而 reason 只要给出能够核对的依据就够了，所以评测不会采集模型隐藏的思维链。同一份合同里的多条 clause 会共享背景和风险因素，统计时得按合同聚成 cluster，不能假定这些条款彼此独立。

## 动手实验

```bash
uv run eval-harness-ref run reference/examples/contract-review/eval.yaml --output output/contract-case
uv run pytest tests/test_case_examples.py -k contract -q
```

先手算三条 risk_band，再把「双方责任上限为过去十二个月费用」的参考答案改成 `{low, medium}`，并写清 low 和 medium 各自在什么条件下成立。改完后，你还要解释 Reference Harness 为什么不能只靠精确匹配 field 来处理这条规则，新的 set/rubric Scorer（评分器）又该检查哪些内容，最后再设计怎样记录两位专家的分歧和仲裁结论。

## 预期输出与答案

Buggy 漏掉无限责任，所以结果是 failed，Fixed 则让三条样本全部 passed。遇到多值 reference，Scorer 不能拿第一个字符串当唯一答案，它既要检查输出是否落在允许集合里，也要确认 reason 符合这个答案对应的条件。专家 A 和专家 B 各自给出的标注、理由与标注时间都得保留，仲裁结果还要引用双方意见并交代为什么这样判，不能抹掉已经出现的分歧。

Judge 若解析不了输出，或者拿到的背景不足，Score 就应记为 uncertain/unscorable。关键条款没有足够证据时，Gate 只能给出 inconclusive，不能顺手把模型判成安全。

## 如何核对

阅读 [`contract-review/eval.yaml`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/reference/examples/contract-review/eval.yaml)、Dataset 和脚本，然后运行确定性测试。等你确认基础规则能够稳定复现，再查看 [Judge 工程篇](../engineering/04-llm-as-judge.md)，看看把它扩展到真实场景前还要校准什么。

## 本篇不能证明什么

即使关键词 Fixture、专家参考和 Judge 评分全都通过，这些结果也构不成法律意见，更不能证明系统换个法域仍然有效。仓库只展示怎样评测，真要使用这套系统，仍须让合格的法律专家参与，并把数据治理补齐。

[上一节](knowledge-assistant.md) · [下一节](../labs/01-run-one-deterministic-eval.md)
