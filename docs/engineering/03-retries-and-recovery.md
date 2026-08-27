# Retry 与 Recovery：恢复基础设施，不能重抽产品答案

[上一节](02-run-identity-and-reproducibility.md) · [下一节](04-llm-as-judge.md)

## 本篇要解决什么问题

模型第一次答错、第二次答对时，Harness 能不能自动重试，再把这个样本记成通过？不能。边界要卡在这里。只有产品的服务契约原本就允许重试，而且这段重试属于被测 Target 自己的行为，第二次回答才能算进有效的产品观察。Eval Harness 的 retry 只负责从「没有拿到有效产品观察」的基础设施故障中恢复，否则系统就会反复抽取失败样本，直到碰巧成功，连分母和失败概率也跟着变。本篇会借助 Trial（试验）、Attempt（尝试）、各自独立的行为预算和 canonical Attempt，把两类看起来相似的重试分清楚。

熟悉 Sample、Trial 和 Attempt 以后，你应该能判断 timeout、429、进程启动失败、模型拒答、工具错误、断言失败和日志写入失败各自属于哪一类。把错误分层，是为了让状态机恢复运行时不会顺手改掉产品结果，因为错误落在哪一层，直接决定了系统能不能重试。

## 核心机制

![产品失败与基础设施重试](../assets/diagrams/foundations/03-trial-attempt.svg)

Trial 是统计计划预先定下的观察单位，Attempt 则记录同一个 Trial 每次怎样调用基础设施，因此重试可以多留一个 Attempt，却不能凭空多出一个 Trial。Reference Harness 的 `run_trial` 捕获 `InfrastructureError`（基础设施错误）后，先写下一条 `infra_failed` Attempt，再根据 `max_infra_attempts` 决定是否继续。Target 一旦返回 `TargetResult`，无论 kind 是 completed 还是 product_failure，当前 Attempt 都会成为唯一的 canonical。重试必须就此停止。如果基础设施 Attempt 全部耗尽，Trial 就会变成 blocked，此时没有 Bundle 和 Score，但 Metric denominator 仍然要把它算进去。

产品服务内部怎样退避和重发，属于 Target 行为，比如应用遇到 429 后按照线上政策再次请求，Harness 只能在 Trace 里记录这段过程。Harness retry 处理的是运行器启动不了进程、沙箱暂时失联等实验基础设施问题。两套预算不能混。事件类型也要分开记录，否则运行器无法说明自己恢复的是实验环境，还是重新抽取了产品结果。

## 完整流程

1. Planner 固定 Trial 计划与 `max_infra_attempts`，开始后不能根据结果追加 Trial。
2. Runner 创建 Attempt ordinal=1 并调用 Target Adapter。
3. Adapter 在进程无法启动、Harness 级 timeout 等情况下抛带 code 的 InfrastructureError。Runner 记录失败但不生成产品 output。
4. 若预算剩余，创建下一个 Attempt。每次 Attempt 都应保存开始/结束、错误、资源与 Trace，不能覆盖前一次。
5. Target 有有效返回时建立 canonical Attempt。非零退出、拒答、无效 JSON 若定义为产品 contract 失败，也停止重试。
6. ObservationBundle 只绑定 canonical Attempt，但审计报告仍保留所有 Attempt，解释为何选中它。
7. 若无 canonical Attempt，Trial blocked。Scorer 不应伪造 0 分。Metric 保留计划 denominator，Gate 可因关键 blocked evidence 给 inconclusive/blocked。
8. 分布式实现还需要 lease、fencing token 和原子 canonical commit。最小本地实现不假装已解决这些问题。

## 关键数据与不变量

`AttemptStatus={succeeded, infra_failed, cancelled}` 记录一次基础设施调用的结果，`TrialStatus={completed, blocked, invalid}` 则说明整个计划观察最后落在什么状态。系统用 Trial ID 加 ordinal 算出 Attempt ID，一个 Trial 最多只能选出一个 canonical，而且这个 canonical 必须是 succeeded。即使产品失败，Attempt 仍然可能是 succeeded，因为「成功执行」只说明系统拿到了有效观察，不等于「产品通过」。

预算至少要分开记录 Harness infra attempts、Target 内部调用和工具预算、Judge 预算，以及全局墙钟预算，因为每一种预算耗尽，都代表不同的失败。系统必须把允许恢复的错误逐项列入白名单。要是所有 Exception 都能触发重试，系统就会不断重复确定性的程序错误，反而把问题藏住。取消后也不能自动继续，因为用户操作、全局预算耗尽或上游撤销任务，都可能触发取消。

## 动手实验

运行 Runner 测试：

```bash
uv run pytest tests/test_runner.py -q
```

阅读三个测试 Target，它们分别是第一次 InfrastructureError 后成功、直接 product_failure，以及所有尝试都返回 InfrastructureError。为每种情况画出 Attempt 列表，并标出 canonical、TrialStatus、是否产生 Bundle 以及 Metric denominator。然后假设产品模型第一次输出了错误答案，解释为什么这个结果不应触发 Harness retry。

## 预期输出与答案

基础设施先失败、随后成功时，系统会留下两个 Attempt，并把第二个选作 canonical，Trial 的状态则是 completed。Target 直接返回 product_failure 时，只会产生一个 succeeded canonical Attempt，Trial 仍然是 completed，不过 Scorer 后面可能把它判成 failed。如果每次尝试都遇到 infra failure，系统会保留预算范围内的全部 infra_failed Attempt，Trial 因为找不到 canonical 而变成 blocked，也不会生成 Score，但计划 denominator 仍然包含它。

错误答案本身已经是一条有效的产品观察，所以 Scorer 应当把它判成 Score failed，Harness retry 不能拿它再试一次。如果业务 Target 自己规定「最多请求模型三次再投票」，那么三次请求都属于同一个 Trial 里的 Target Trace，既不能记成 Harness 的三个 Attempt，也不能冒充三个独立样本。

## 如何核对

查看 [`runner.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/runner.py) 的循环与返回分支、[`targets/base.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/targets/base.py) 的错误合同、[`test_runner.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_runner.py) 的三种状态；再结合 [`metrics.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/metrics.py) 核对 blocked Trial 是否仍占分母。

## 本篇不能证明什么

本地线程和单进程 canonical 规则只能管住这份参考实现，证明不了分布式 worker 恰好执行一次，也无法保证远端请求幂等，或崩溃恢复没有造成重复副作用。因此，生产队列还得增加 lease、fencing、幂等键和事务性提交，才能在分布式环境里守住同样的边界。

[上一节](02-run-identity-and-reproducibility.md) · [下一节](04-llm-as-judge.md)
