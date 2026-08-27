# 案例三：企业知识助手的 RAG、ACL 与泄漏门禁

[上一节](refund-agent.md) · [下一节](contract-review-agent.md)

## 本篇要解决什么问题

即使知识助手给出的答案完全正确，只要它引用了用户无权访问的财务文档，这次回答就不能算成功。RAG 评测至少要同时检查检索召回、答案事实性、引用和访问控制，因为只看普通答案准确率，少量严重泄漏很容易被大量正确回答平均掉。本案例用 public/finance ACL 的三条确定性 Fixture 展示权限 Gate，同时说明真实 RAG 应当怎样记录 query、retrieved document IDs、ACL 决策和生成答案。

Buggy Target 忽略用户角色，拿到文档事实后便直接返回。Fixed Target 只有在文档属于 public，或者 role 与 document_acl 相同时才返回内容，否则就会「拒绝访问」。

## 核心机制

![知识助手的检索、ACL 与回答链](../assets/diagrams/cases/knowledge.svg)

正确的处理顺序是身份认证 → ACL 过滤 → 检索 → 生成 → 引用，因为如果系统先取回秘密，再要求模型不要说，秘密实际上已经越过了最小权限边界。EvaluationDataset 必须同时包含 authorized 与 unauthorized 对照样本，Environment/Target Trace 则要保存检索候选和过滤结果。Scorer 分别检查 ACL 泄漏、回答正确性、引用支持度与拒答质量，其中 ACL 属于非补偿关键指标。

为了避免 Scorer 自己成为泄漏源，unauthorized Sample 的 expected 可以只保存「拒绝访问」，秘密 fact 则放进受保护的 Fixture/Verifier。报告需要公开时，检索内容必须先做脱敏，并且只保留 document ID、digest 和访问决定。

## 完整流程

1. 冻结 corpus version、document ACL、用户角色与查询；按用户/文档家族切分，避免同文档段落跨 train/release。
2. Target Adapter 注入用户身份，记录实际检索 query、候选、ACL filter 和 selected chunks。
3. Agent/RAG 系统生成答案与 citations；Trace 不保存无授权正文到公共 artifact。
4. ACL Scorer 检查 unauthorized 文档是否在候选/selected/answer 任一阶段泄漏；答案 Scorer 只在授权样本上测事实性。
5. Citation Scorer 验证引用属于授权且支持回答；Judge 可辅助语义判断，但不得看到候选系统名称。
6. Metric 分开统计 authorized answer quality、unauthorized leak rate、correct refusal 和 retrieval coverage。
7. Gate 要求 critical leak count=0；若 ACL 日志缺失则 blocked/inconclusive，不假设过滤成功。
8. 生产 incident 回流为新的 adversarial query，但先做脱敏、授权与版本治理。

## 关键数据与不变量

Sample identity 要包含 query、role、tenant 和 corpus version，而 Target identity 要标明 embedding、retriever、reranker、generator 与 ACL service。retrieval_context 记录系统实际取回的内容，expected context 保存参考上下文，两者承担的证据角色不同，不能混写。用户和租户既是统计 cluster，也是安全边界，因此秘密正文不得进入公开报告或 Judge provider，除非合同明确允许这样处理。

## 动手实验

```bash
uv run eval-harness-ref run reference/examples/knowledge-assistant/eval.yaml --output output/knowledge-case
uv run pytest tests/test_case_examples.py -k knowledge -q
```

先手算 public employee、finance employee、finance finance 三条样本，再增加一条「用户直接在 query 中猜测秘密」的样本，并说明 Scorer 如何区分模型复述用户输入与检索泄漏。随后为真实 Trace 设计 `acl_checked`、`documents_retrieved`、`answer_generated` 三个事件，同时给出它们之间的 parent 关系。

## 预期输出与答案

当普通员工查询 finance 文档时，Buggy 会泄漏受保护内容并失败，而 Fixed 能够正确拒绝，因此三条样本都会通过。即使敏感文本由用户自己提供，系统仍然不应确认它是否真实。判定泄漏时要检查回答有没有引入受保护的新信息或无授权引用——不能只比较字符串是否重合。

这三个事件应当形成一条清晰的因果链，证明 ACL 检查发生在检索和选择之前。如果 Trace 显示系统先取回秘密再过滤，那么即使最终回答选择了拒绝，也已经暴露出内部最小权限问题，需要单独评分。

## 如何核对

阅读 [`knowledge-assistant/eval.yaml`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/reference/examples/knowledge-assistant/eval.yaml) 与 Target 脚本，然后运行测试，并检查 Artifact 是否只包含规定的输出而没有额外 secret。核对 context 与 retrieval_context 的区别时，可以对照 DeepEval 相关课程。

## 本篇不能证明什么

三条 Fixture 只能验证冻结案例中的规则，无法证明真实向量库 ACL、缓存隔离、多租户索引、prompt injection 和日志脱敏都安全。真实系统还需要在实际环境中完成验证，并接受针对访问边界的渗透测试。

[上一节](refund-agent.md) · [下一节](contract-review-agent.md)
