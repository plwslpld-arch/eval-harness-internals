# 02｜Task、Dataset、Target 与 Environment：把问题定义完整

[上一章](01-agent-vs-eval-harness.md) · [下一章](03-sample-trial-attempt.md)

## 本篇要解决什么问题

“评测一下退款 Agent”不是可执行规格。它没有说要测退款资格判断、话术还是副作用；没有样本范围；没有标出被测版本；也没有说明账户、订单和工具状态。很多评测争论看似关于分数，实际是四个对象没有分开：Task 定义行为，Dataset 提供实例，Target 指定被测系统，Environment 提供可变世界。

## 学完你能解释什么

- 为什么同一 Dataset 可以服务多个 Target，但不能自动代表同一 Task；
- 为什么 prompt 或模型名字不足以形成 Target 身份；
- 为什么 Agent 评测必须把 Environment 初态和终态纳入协议；
- 怎样从一句业务问题得到可物化的 EvaluationSpec。

## 贯穿案例

运费案例的 Task 是“根据订单金额返回运费”，判定边界是金额大于等于 100 时费用为 0。Dataset 包含 99、100、101 三个 Sample。Target 有 buggy 与 fixed 两个本地脚本。Environment 在这个最小例子中只是 Python 3.12 子进程和只读输入；若换成退款 Agent，Environment 就必须包含订单余额、退款 API、权限和可复位数据库。

## 核心概念与边界

**Task** 描述要观察的行为、输入输出契约和允许条件，不是某条样本。**Dataset** 是经过选择、版本化和分组的一组 Sample，不等于整个业务分布。**Target** 是被测系统的实际身份，至少包括 Adapter、模型或程序版本、有效配置与依赖。**Environment** 是运行行为能够读取或改变的外部状态，包含文件、容器、服务、账户、时钟和网络策略。

四者组合后才能回答一个具体问题：“在环境 E 的冻结初态下，Target T 对 Dataset D 中代表 Task K 的样本表现怎样？”改变其中任何一个都可能改变结论。尤其不要把 Environment 藏进 Target 名称，也不要把 Reference 答案塞进 Agent 可见环境。

## 机制图

![Task、Dataset、Target 与 Environment 形成 EvaluationSpec](../assets/diagrams/foundations/02-eval-spec-flow.svg)

## 调用链与状态变化

1. 设计者把业务决定改写为 Task：输入是什么、允许什么行为、什么证据支持通过。
2. Dataset Builder 选择 Sample，并固定 Sample ID、Split、Reference 与来源。
3. Target Resolver 把逻辑名称调和为实际 Adapter 和版本，拒绝身份漂移。
4. Environment Factory 创建干净初态，限制网络和凭据，声明重置方式。
5. EvaluationSpec 冻结 Target 列表与重复次数；Planner 执行笛卡尔积，生成不可随结果缩减的 Trial Plan。

Reference Harness 的 [`EvaluationSpec`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/models.py)、[`plan_trials`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/planner.py) 和 shipping 配置展示了最小实现。复杂 Agent 环境会在后续工程篇增加环境工厂，而不会改变这四个对象的语义。

## 关键数据结构

```yaml
evaluation_id: shipping-boundary
dataset: dataset.jsonl
repetitions: 1
targets:
  - target_id: buggy
    adapter: python_script
    script: target_buggy.py
scorer:
  scorer_id: shipping-fee:v1
  field: fee
```

这里 `target_id` 是计划内逻辑身份，`script` 是解析后执行入口。真实模型 Target 还应记录模型版本、系统提示摘要、工具集合和服务端返回的实际身份。Environment 则应有自己的镜像摘要、初态 Fixture 和重置结果，避免全部塞入一个无法审计的 `config` 字符串。

## 设计取舍

Dataset 可以内联在配置，也可以外部版本化。外部 JSONL 更利于稳定 ID、Diff 和分片；代价是要管理文件血缘。Target 可以由构造函数直接创建，也可以 Registry 驱动；Registry 易复用但可能隐藏实际配置，因此运行报告必须保存解析后的身份。Environment 使用容器隔离更强，却不是所有任务都需要；纯函数评测应保持轻量，Agent 副作用任务则必须优先隔离和重置。

lm-evaluation-harness 的 [`Task`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/task.py) 与 [`LM`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/model.py) 分别承载任务与模型适配，是**上游源码事实**。本篇的四对象模型是跨 Harness 的**机制解释**，并不要求上游采用 `Environment` 这个类名。

## 失败语义

- Dataset 为空或 Sample ID 重复：规格无效，不能开始运行。
- Target 声明模型 A，服务实际返回模型 B：身份调和失败，证据应标为 `invalid`。
- Environment 创建失败：Trial `blocked`，可在基础设施预算内恢复；不能当作产品零分。
- Environment 未成功重置：后续 Trial 可能互相污染，应阻断而非继续累计分数。
- Task 只写“效果好”：Scorer 无法知道观察边界，评测设计尚未完成。

## 动手实验

复制 shipping 配置到临时目录，把 `repetitions` 改成 2，并保留 3 个 Sample、2 个 Target。运行 `eval-harness-ref run` 后查看 `evidence.json` 中的 `trials`，不要先看报告分数。

## 预期输出与答案

应得到 12 个 Trial：3 × 2 × 2。每个 Trial 都保存相同 Task 语义下的一个 Sample、一个 Target 和一个重复序号。重复次数改变的是实验设计，不会复制 Sample ID；Environment 若无法为每次 Trial 提供等价初态，则这 12 次不具有可直接比较的含义。

## 常见误解

“Dataset 就是 Task”会让换一个问题却沿用旧分数；“模型名就是 Target”忽略提示、工具和服务版本；“Docker 就等于 Environment 可复现”忽略外部 API、时间和凭据；“更多样本自然更代表业务”忽略采样偏差和重复实体。

## 如何核对

运行 `python -m pytest tests/test_planner.py -q`，确认 Target × Sample × Repetition 的数量和顺序稳定。再比较 [`sources/sources.lock.yml`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/sources/sources.lock.yml) 与正文永久链接，理解“上游源码身份”同样需要 commit，而不是浮动 `main`。上游 Harbor 的 [`environments/base.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/environments/base.py) 可用于核对 Agent 环境为什么值得独立抽象。

## 与其他 Harness 的关系

OpenAI Evals 强调 Registry 与 Eval Spec，Promptfoo 用配置连接 Provider 与 Test Case，DeepEval 借用测试框架式 Test Case，Harbor 把任务包、Agent 和 Environment 组合为 Trial。名字不一一等价：Provider 可能同时包含 Target 解析与调用，Golden 可能同时承载输入和 Reference。比较时应先映射责任，再比较字段。

## 本篇不能证明什么

定义完整四对象并不保证 Dataset 有代表性、环境无泄漏或 Target 可复现。它只让这些风险有明确归属和可检查字段；有效性、可靠性和发布决策仍需后续章节的证据。

[上一章](01-agent-vs-eval-harness.md) · [下一章](03-sample-trial-attempt.md)
