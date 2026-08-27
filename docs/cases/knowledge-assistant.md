# 案例三：企业知识助手的 RAG、ACL 与泄漏门禁

[上一节](refund-agent.md) · [下一节](contract-review-agent.md)

## 本篇要解决什么问题

知识助手即使答对了，只要引用了用户无权查看的财务文档，这次回答就不能算成功。评测 RAG（检索增强生成）时，至少要一起检查检索有没有找对资料、答案是否符合事实、引用能否支撑答案，以及 ACL（访问控制列表）有没有拦住越权访问。只看普通答案的准确率，少量严重泄漏很容易淹没在大量正确回答里。这个案例用 public/finance ACL 的三条确定性 Fixture 演示权限 Gate，同时说明真实 RAG 需要怎样记下 query、retrieved document IDs、ACL 的判断结果和最终答案。

Buggy Target 不看用户是什么角色，拿到文档里的事实就直接返回。Fixed Target 会先检查文档是否属于 public，或者 role 是否与 document_acl 相同，条件都不满足就返回「拒绝访问」。

## 核心机制

![知识助手的检索、ACL 与回答链](../assets/diagrams/cases/knowledge.svg)

这条链路应当按身份认证 → ACL 过滤 → 检索 → 生成 → 引用的顺序运行，因为系统若先把秘密取回来，再叮嘱模型别说，秘密其实已经越过最小权限边界。EvaluationDataset 必须同时放入 authorized 和 unauthorized 两组对照样本，Environment/Target Trace（轨迹）则要记下系统找到了哪些候选文档，又过滤掉了哪些。Scorer（评分器）分别检查 ACL 有没有泄漏、答案对不对、引用能否支撑答案，以及系统该拒答时答得是否合适，其中 ACL 是不能用其他高分补偿的关键指标。

Scorer 自己也可能泄密，所以 unauthorized Sample 的 expected 只需保存「拒绝访问」，秘密 fact 要留在受保护的 Fixture/Verifier 里。报告若要公开，得先把检索内容脱敏，最终只留下 document ID、digest 和系统是否允许访问的判断。

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

Sample identity 要把 query、role、tenant 和 corpus version 都带上，Target identity 则要说明实际用了哪个 embedding、retriever、reranker、generator 和 ACL service。系统真正取回了什么，记在 retrieval_context 里，作为答案参照的上下文则放进 expected context。这两份内容证明的是不同事情，不能混着写。用户和租户既决定统计时怎样聚类，也划出了安全边界，所以秘密正文不能送进公开报告或 Judge provider，除非合同明确允许。

## 动手实验

```bash
uv run eval-harness-ref run reference/examples/knowledge-assistant/eval.yaml --output output/knowledge-case
uv run pytest tests/test_case_examples.py -k knowledge -q
```

先手算 public employee、finance employee、finance finance 三条样本，再补一条「用户直接在 query 中猜测秘密」的样本，并说明 Scorer 怎样判断模型只是在复述用户输入，还是确实泄漏了检索结果。随后给真实 Trace 设计 `acl_checked`、`documents_retrieved`、`answer_generated` 三个事件，并把三个事件之间的 parent 关系标出来。

## 预期输出与答案

普通员工查询 finance 文档时，Buggy 会泄漏受保护内容，因此评测失败，Fixed 则会正确拒绝，让三条样本全部通过。即使敏感文本是用户自己写进 query 的，系统也不该替他确认真假。判断是否泄漏时，你得看回答有没有带出受保护的新信息，或者给出用户无权访问的引用，不能只比较两段文字有没有重合。

这三个事件要连成一条清楚的因果链，让人能够确认系统先检查 ACL，然后才检索和选择文档。如果 Trace 显示系统先取回秘密再过滤，那么最终即使拒绝回答，也说明内部已经违反最小权限原则，这个问题要单独评分。

## 如何核对

阅读 [`knowledge-assistant/eval.yaml`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/reference/examples/knowledge-assistant/eval.yaml) 和 Target 脚本，然后运行测试，再打开 Artifact 看看里面是否只有规定的输出，有没有混入额外 secret。想确认 context 和 retrieval_context 各自该放什么，可以对照 DeepEval 相关课程。

## 本篇不能证明什么

三条 Fixture 只能验证这个冻结案例里的规则，证明不了真实向量库里的 ACL、缓存隔离、多租户索引、prompt injection 和日志脱敏全都安全。你还得在实际环境里验证真实系统，并针对访问边界做渗透测试。

[上一节](refund-agent.md) · [下一节](contract-review-agent.md)
