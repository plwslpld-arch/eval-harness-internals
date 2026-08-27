# 案例四：合同审查 Agent 的多值 Reference 与 Judge 仲裁

[上一节](knowledge-assistant.md) · [下一节](../labs/01-run-one-deterministic-eval.md)

## 本篇要解决什么问题

合同条款很少只有一个标准答案，因为责任上限会随法域、谈判地位和业务上下文变化，所以把它评为 medium 或 high 都可能合理。如果评测只做字符串精确匹配，合法表达也会受罚，而完全交给单个 Judge 又容易产生漂移。本案例先用无限责任、责任上限和书面通知三条确定性 risk_band Fixture 搭起可运行骨架，再把评测扩展到多值 Reference、Rubric、双标与仲裁。

Buggy Target 只识别书面通知，其余条款一律报告 medium，因此会漏掉无限责任这类高风险条款。Fixed Target 则按照冻结的关键词规则给出 high、medium 或 low。

## 核心机制

![合同审查的规则、Judge 与仲裁链](../assets/diagrams/cases/contract.svg)

评测分成两段，其中确定性结构与关键条款规则负责守住可验证的底线，而开放式解释交给 Judge 按照 Rubric 打分。Reference 可以同时给出允许集合和适用条件，例如 liability cap 缺少金额上下文时可接受 `{medium, high}`，但 reason 必须说明不确定性，而不必强求一个固定字符串。两位专家独立标注后，即使结论不同也要保留各自意见，随后再由仲裁生成 adjudicated reference。这一步必须留痕——原始意见不能覆盖。

如果系统把无限责任识别为低风险，这类关键漏判就会直接触发非补偿 Gate，其他样本的好成绩无法抵消它，而措辞风格只作为次要指标。Judge input 还要隐藏候选名称和人类最终标签，以免评分受到泄漏信息影响。

## 完整流程

1. Dataset 固定 clause、jurisdiction、contract role、上下文与多值 reference/rubric；按合同家族切分防止相似条款泄漏。
2. Target 输出 structured findings：clause span、risk type、risk band、reason、建议；Fixture 只演示 risk_band。
3. 确定性 Scorer 检查 schema、span 与关键关键词；Judge Scorer评估 reasoning/risk 的可接受集合。
4. Judge error 与 disagreement 分开保存；低置信或专家分歧进入 uncertain/人工仲裁，不强压成 0/1。
5. Metric 报关键风险 recall、false positive、band agreement、reason quality 和 unscorable rate；按合同聚类。
6. Candidate/Baseline 在同条款配对，查看关键漏判差异和总体效果区间。
7. Gate 先要求 unlimited liability 等 critical recall=100%，再看总体质量、成本和延迟。
8. 新判例/政策变化产生新 reference version，不用新标准重写旧报告。

## 关键数据与不变量

Reference 要记录来源、专家、时间、法域、允许答案集合、必须提及点和 uncertainty，而 Judge identity 则保存模型、rubric、prompt 与 schema。Clause span 用来定位证据，reason 只需提供可核对依据，因此评测不采集模型隐藏思维链。同一合同里的多条 clause 共享上下文和风险因素，统计时必须把合同视为 cluster，不能把这些条款当作彼此完全独立的样本。

## 动手实验

```bash
uv run eval-harness-ref run reference/examples/contract-review/eval.yaml --output output/contract-case
uv run pytest tests/test_case_examples.py -k contract -q
```

先手算三条 risk_band，再把「双方责任上限为过去十二个月费用」的参考改成 `{low, medium}`，并写出带条件的多值规则。完成这一步后，还要解释 Reference Harness 的精确 field scorer 为什么不足以处理该规则，以及新的 set/rubric Scorer 需要验证什么，最后再设计两位专家的分歧记录与仲裁记录。

## 预期输出与答案

Buggy 因为漏掉无限责任而 failed，Fixed 则让三条样本全部 passed。面对多值 reference，Scorer 不能简单选择第一个字符串，而要同时验证输出是否属于允许集合，以及 reason 是否满足对应条件。专家 A 与专家 B 的原始标注、理由和独立标注时间都要保留，仲裁结果需要引用双方意见并说明决策依据，分歧本身也不能删除。

一旦 Judge 无法解析输出或掌握的上下文不足，Score 就应记为 uncertain/unscorable。关键条款缺少证据时，Gate 只能给出 inconclusive，不能据此把模型自动判定为安全。

## 如何核对

阅读 [`contract-review/eval.yaml`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/reference/examples/contract-review/eval.yaml)、Dataset 和脚本并运行确定性测试，确认基础规则能够复现后，再查看 [Judge 工程篇](../engineering/04-llm-as-judge.md)，核对真实扩展还需要哪些校准工作。

## 本篇不能证明什么

即使关键词 Fixture、专家参考和 Judge 评分全部通过，这些结果也不能构成法律意见，更不能证明系统在不同法域都有效。仓库展示的范围仅限评测机制，真实使用仍然需要合格的法律专家参与，并配套完整的数据治理。

[上一节](knowledge-assistant.md) · [下一节](../labs/01-run-one-deterministic-eval.md)
