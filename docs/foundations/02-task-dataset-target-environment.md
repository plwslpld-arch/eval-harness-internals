# 02｜Task、Dataset、Target 与 Environment：把问题定义完整

[上一章](01-agent-vs-eval-harness.md) · [下一章](03-sample-trial-attempt.md)

## 本篇要解决什么问题

「评测一下退款 Agent」还不能直接拿来执行，因为你不知道要测的是退款资格判断、对客话术，还是实际产生的副作用，也不知道样本取自哪里、测哪个版本，账户、订单和工具又处在什么状态。很多评测争论表面上围着分数打转，继续追问才会发现，真正混在一起的是四件事：Task 规定要做什么，Dataset 提供具体样本，Target 指定测谁，Environment（环境）则准备运行时会被读取或改变的外部状态。这四件事不能混。

## 学完你能解释什么

- 为什么同一 Dataset 可以服务多个 Target，但不能自动代表同一 Task；
- 为什么 prompt 或模型名字不足以形成 Target 身份；
- 为什么 Agent 评测必须把 Environment 初态和终态纳入协议；
- 怎样从一句业务问题得到可物化的 EvaluationSpec。

## 贯穿案例

运费案例要求系统「根据订单金额返回运费」，金额达到 100 时费用为 0，Task 要守住的就是这条判定边界。Dataset 收进金额为 99、100、101 的三个 Sample，buggy 和 fixed 两个本地脚本则是 Target，所以在这个最小例子里，Environment 只要准备 Python 3.12 子进程和只读输入即可。换成退款 Agent，外部状态就复杂多了，Environment 必须包含订单余额、退款 API、权限，以及能够复位的数据库。

## 核心概念与边界

**Task** 说明要观察什么行为、输入输出要遵守什么契约，以及系统可以做哪些事，通常会覆盖多条样本。**Dataset** 把选出的 Sample 按版本和分组组织起来，但它只能代表实际业务分布的一个切面。**Target** 要说清楚究竟测哪个系统，至少包括 Adapter（适配器）、模型或程序版本、实际生效的配置和依赖。**Environment** 则装下系统运行时能够读取或改变的外部状态，比如文件、容器、服务、账户、时钟和网络策略。

把这四件事合在一起，你才能提出一个能实际评测的问题：「先把环境 E 冻结在指定初态，再让 Target T 处理 Dataset D 中用于检验 Task K 的样本，它会表现得怎样？」其中任何一项变了，结论都可能跟着变。如果你把 Environment 藏进 Target 名称，或者把 Reference 答案放进 Agent 能看到的环境，评测还没开始，身份就已经混乱，答案也可能提前泄露。这会直接污染结果。

## 机制图

![Task、Dataset、Target 与 Environment 形成 EvaluationSpec](../assets/diagrams/foundations/02-eval-spec-flow.svg)

## 调用链与状态变化

1. 设计者把业务决定改写为 Task：输入是什么、允许什么行为、什么证据支持通过。
2. Dataset Builder 选择 Sample，并固定 Sample ID、Split、Reference 与来源。
3. Target Resolver 把逻辑名称调和为实际 Adapter 和版本，拒绝身份漂移。
4. Environment Factory 创建干净初态，限制网络和凭据，声明重置方式。
5. EvaluationSpec 冻结 Target 列表与重复次数；Planner 执行笛卡尔积，生成不可随结果缩减的 Trial Plan。

Reference Harness 用 [`EvaluationSpec`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/models.py)、[`plan_trials`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/planner.py) 和 shipping 配置展示了最小实现。后面的工程篇会给复杂 Agent 环境加上环境工厂，但这四个对象各自表达的意思不会因此改变。

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

这里的 `target_id` 表示计划里认定的逻辑身份，解析器则根据 `script` 找到真正的执行入口。当 Target 换成真实模型，运行记录还要写下模型版本、系统提示摘要、工具集合，以及服务端实际返回的身份。Environment 也要分别保存镜像摘要、初态 Fixture（测试夹具）和重置结果。如果把这些信息全塞进一个 `config` 字符串，以后就很难查清每项配置来自哪里。

## 设计取舍

Dataset 可以直接写进配置，也可以放在外部文件里单独管理版本。使用外部 JSONL 后，你更容易维护稳定 ID、查看 Diff 和切分数据，但也得额外管好文件从哪里来、经历过哪些变化。Target 可以由构造函数直接创建，也可以交给 Registry（注册表）按名称加载。Registry 用起来方便，却可能遮住真正生效的配置，所以运行报告必须保存解析后的身份。容器能把 Environment 隔离得更严，不过纯函数评测通常不需要这么重。只要 Agent 会产生副作用，就得先解决隔离和重置问题。

lm-evaluation-harness 分别用 [`Task`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/task.py#L64-L103) 承载任务，用 [`LM`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/model.py#L25-L64) 适配模型，这是**上游源码事实**。本篇为了比较不同 Harness，才把它们归到四个对象中，这属于**机制解释**，并不要求上游也定义一个名为 `Environment` 的类。

## 失败语义

- Dataset 为空或 Sample ID 重复：规格无效，不能开始运行。
- Target 声明模型 A，服务实际返回模型 B：身份调和失败，证据应标为 `invalid`。
- Environment 创建失败：Trial `blocked`，可在基础设施预算内恢复；不能当作产品零分。
- Environment 未成功重置：后续 Trial 可能互相污染，应阻断而非继续累计分数。
- Task 只写「效果好」：Scorer 无法知道观察边界，评测设计尚未完成。

## 动手实验

把 shipping 配置复制到临时目录，将 `repetitions` 改成 2，同时保留 3 个 Sample 与 2 个 Target。运行 `eval-harness-ref run` 后，先查看 `evidence.json` 里的 `trials`，暂时别看报告分数。

## 预期输出与答案

你应该得到 12 个 Trial，因为 3 个 Sample 分别交给 2 个 Target，再各跑 2 次，正好组成 12 种计划内的组合。每个 Trial 都在同一 Task 下绑定一个 Sample、一个 Target 和一个重复序号。增加重复次数会改变实验怎样安排，却不会复制 Sample ID。如果 Environment 不能让每次 Trial 都从等价初态开始，这 12 次运行就不能直接放在一起比较。

## 常见误解

如果认定「Dataset 就是 Task」，问题换了以后，你可能还在沿用旧分数。如果只把模型名当作 Target，提示、工具和服务版本就会从身份记录里消失。把 Docker 当作 Environment 可复现的充分条件也站不住，因为外部 API、时间和凭据仍可能变化。样本变多同样不保证更接近业务，因为增加数量不会自动消除采样偏差和重复实体。

## 如何核对

运行 `python -m pytest tests/test_planner.py -q`，确认 Target × Sample × Repetition 展开后的数量和顺序保持稳定。然后对照 [`sources/sources.lock.yml`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/sources/sources.lock.yml) 与正文里的永久链接，你会看到「上游源码身份」同样要由 commit 固定，不能跟着浮动的 `main` 变化。上游 Harbor 的 [`environments/base.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/environments/base.py#L84-L123) 则能帮你核对，为什么 Agent 环境需要单独抽出来。

## 与其他 Harness 的关系

OpenAI Evals 主要通过 Registry 与 Eval Spec 组织评测，Promptfoo 用配置把 Provider 和 Test Case 接起来，DeepEval 沿用测试框架里的 Test Case 思路，Harbor 则把任务包、Agent 和 Environment 组合成 Trial。这些名字不能逐字对齐：Provider 可能同时负责解析并调用 Target，Golden 也可能同时装着输入和 Reference。比较不同实现时，你得先看每个对象实际负责什么，再对照字段。

## 本篇不能证明什么

即使四个对象都定义完整，Dataset 仍可能没有代表性，Environment 仍可能泄漏，Target 也可能无法复现。定义完整还不够。这套定义的作用，是给每类风险找到明确的负责人和能够检查的字段，让你知道出了问题该往哪里追。至于评测是否有效、结果是否可靠，以及能不能据此发布，还要看后续章节提供的证据。

[上一章](01-agent-vs-eval-harness.md) · [下一章](03-sample-trial-attempt.md)
