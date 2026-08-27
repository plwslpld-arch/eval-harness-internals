# 02｜Task、Dataset、Target 与 Environment：把问题定义完整

[上一章](01-agent-vs-eval-harness.md) · [下一章](03-sample-trial-attempt.md)

## 本篇要解决什么问题

「评测一下退款 Agent」还算不上可执行规格，因为这句话没说要测退款资格判断、对客话术还是实际副作用，也没限定样本范围、被测版本以及账户、订单和工具状态。评测争论有时表面上在谈分数，向下追问才会发现是四个对象混在了一起：Task 定义行为，Dataset 提供实例，Target 指定被测系统，Environment 则提供那个可以变化的外部世界。

## 学完你能解释什么

- 为什么同一 Dataset 可以服务多个 Target，但不能自动代表同一 Task；
- 为什么 prompt 或模型名字不足以形成 Target 身份；
- 为什么 Agent 评测必须把 Environment 初态和终态纳入协议；
- 怎样从一句业务问题得到可物化的 EvaluationSpec。

## 贯穿案例

运费案例的 Task 是「根据订单金额返回运费」，金额大于等于 100 时费用为 0，这就是需要守住的判定边界。Dataset 包含 99、100、101 三个 Sample，而 Target 是 buggy 和 fixed 两个本地脚本，因此在这个最小例子里，Environment 只需提供 Python 3.12 子进程与只读输入。换成退款 Agent 就不一样了，那时 Environment 必须包含订单余额、退款 API、权限和可复位数据库。

## 核心概念与边界

**Task** 描述要观察的行为、输入输出契约和允许条件，其范围通常会覆盖多条样本。**Dataset** 是经过选择、版本化和分组的一组 Sample，它只能代表实际业务分布的某个切面。**Target** 给出被测系统的实际身份，至少要包括 Adapter、模型或程序版本、有效配置与依赖。**Environment** 则收纳运行行为能够读取或改变的外部状态，其中可以有文件、容器、服务、账户、时钟和网络策略。

只有将四者组合起来，才能问出一个可评测的问题：「在环境 E 的冻结初态下，Target T 对 Dataset D 中代表 Task K 的样本表现怎样？」其中任何一项发生变化，结论都可能跟着变，而如果把 Environment 藏进 Target 名称，或者把 Reference 答案放进 Agent 可见环境，评测开始前就已经混淆了身份或泄露了答案。

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

这里的 `target_id` 是计划中的逻辑身份，`script` 则是解析后的执行入口。当 Target 变成真实模型时，运行记录还应包含模型版本、系统提示摘要、工具集合和服务端返回的实际身份。Environment 需要保存自己的镜像摘要、初态 Fixture 和重置结果，如果全部挤进一个 `config` 字符串，就很难再追溯它们的来源。

## 设计取舍

Dataset 可以内联在配置中，也可以作为外部文件独立版本化。外部 JSONL 更便于维护稳定 ID、Diff 和分片，相应的代价是要管理文件血缘。Target 既可以由构造函数直接创建，也可以交给 Registry 驱动，而 Registry 的方便也带来代价——它会隐藏实际配置，所以运行报告必须保存解析后的身份。容器能够给 Environment 更强的隔离，但并非每项任务都需要它。纯函数评测应保持轻量，而 Agent 副作用任务必须优先解决隔离和重置。

lm-evaluation-harness 的 [`Task`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/task.py#L64-L103) 与 [`LM`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/model.py#L25-L64) 分别承载任务与模型适配，是**上游源码事实**。本篇的四对象模型是跨 Harness 的**机制解释**，并不要求上游采用 `Environment` 这个类名。

## 失败语义

- Dataset 为空或 Sample ID 重复：规格无效，不能开始运行。
- Target 声明模型 A，服务实际返回模型 B：身份调和失败，证据应标为 `invalid`。
- Environment 创建失败：Trial `blocked`，可在基础设施预算内恢复；不能当作产品零分。
- Environment 未成功重置：后续 Trial 可能互相污染，应阻断而非继续累计分数。
- Task 只写“效果好”：Scorer 无法知道观察边界，评测设计尚未完成。

## 动手实验

复制 shipping 配置到临时目录，把 `repetitions` 改成 2，并保留 3 个 Sample与 2 个 Target。然后运行 `eval-harness-ref run`，先查看 `evidence.json` 中的 `trials`，暂时不要看报告分数。

## 预期输出与答案

应得到 12 个 Trial，对应 3 个 Sample、2 个 Target 和 2 次重复的组合。每个 Trial 都保存相同 Task 语义下的一个 Sample、一个 Target 和一个重复序号。重复次数改变的是实验设计，并不会复制 Sample ID，而如果 Environment 无法为每次 Trial 提供等价初态，这 12 次运行就没有可以直接比较的含义。

## 常见误解

把「Dataset 就是 Task」当真，换了问题后就可能继续沿用旧分数。只记「模型名就是 Target」，提示、工具和服务版本就会从身份中消失。「Docker 就等于 Environment 可复现」也经不起外部 API、时间和凭据的检查。样本变多同样不保证更接近业务，因为采样偏差和重复实体不会随数量增长自动消失。

## 如何核对

运行 `python -m pytest tests/test_planner.py -q`，确认 Target × Sample × Repetition 的数量和顺序稳定。再比较 [`sources/sources.lock.yml`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/sources/sources.lock.yml) 与正文永久链接，理解「上游源码身份」同样需要 commit，而不是浮动 `main`。上游 Harbor 的 [`environments/base.py`](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/src/harbor/environments/base.py#L84-L123) 可用于核对 Agent 环境为什么值得独立抽象。

## 与其他 Harness 的关系

OpenAI Evals 强调 Registry 与 Eval Spec，Promptfoo 用配置连接 Provider 与 Test Case，DeepEval 借用测试框架式 Test Case，Harbor 把任务包、Agent 和 Environment 组合为 Trial。名字不一一等价：Provider 可能同时包含 Target 解析与调用，Golden 可能同时承载输入和 Reference。比较时应先映射责任，再比较字段。

## 本篇不能证明什么

四个对象定义完整后，Dataset 仍可能没有代表性，Environment 仍可能泄漏，Target 也仍可能无法复现。这套定义的价值是让每类风险都有明确归属和可检查字段——问题终于有了可追问的位置。至于有效性、可靠性和发布决策，还要继续查看后续章节的证据。

[上一章](01-agent-vs-eval-harness.md) · [下一章](03-sample-trial-attempt.md)
