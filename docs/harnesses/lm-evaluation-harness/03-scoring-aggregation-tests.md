# 03｜评分、聚合与测试：从 `process_results` 到 Group 结果

[上一节](02-request-execution.md) · [下一节](../../contents.md)

## 本篇要解决什么问题

模型响应写回 Instance 后，系统还算不出「准确率」。分母也还没定。Task 得先读懂同一文档的几条响应，把它们变成这条样本的 metric，再为每个 metric 选择聚合函数、计算标准误，有些配置还会把多个 Task 继续汇成 Group（任务组）。这里有几个问题不能漏：自定义 metric 没声明 aggregation 时系统会怎样处理，有效样本数到底怎么算，Group 为什么要从最深一层往上归并，以及测试锁住了哪些行为？

## 先建立源码地图

每条样本的结果由 [`Task.process_results()`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/task.py#L403-L442) 来解释，aggregation 也配置在同一个类里，随后 [`evaluate()`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L429-L468) 的核心循环才把这些结果加入 raw_metrics。Task 和 Group 怎样聚合、stderr 怎样计算、最终结果怎样收集，分散在 `evaluator_utils.py` 的四个函数里，后文会按实际执行顺序一一走过。

这个名字很容易误导人。`process_results` 实际只处理一份 doc 的结果，并不负责整次运行报告。它返回的字典会先把 value 一条条积累起来，等到 aggregation 真正执行时，系统才得到 Task 层的 metric。

## 完整调用链

![样本 metric 到 Task 与 Group 聚合](../../assets/diagrams/harnesses/lm-eval/aggregation.svg)

1. filter 完成后，调度器为每个 doc 调 `task.process_results(doc, responses)`，得到 `{metric_name: sample_value}`；
2. 每个值追加到 `raw_metrics[(metric, filter_key)]`，若启用 log_samples，同一记录保存 doc、target、arguments、resps、filtered_resps 与三个 hash；
3. `_process_results` 调 `_collect_results`，后者对每个 Task 调 `_compute_task_aggregations`；
4. 对每个 metric/filter，代码查询 `task.aggregation()[metric]`，找不到时记录 warning 并 fallback 到 mean；
5. 聚合函数作用于 items，结果键写成 `metric,filter`，若 bootstrap_iters > 0，再由 `stderr_for_metric` 选择可用标准误函数；样本不足或不支持时写 `N/A`；
6. `_collect_results` 保存 Task config、version、num_fewshot、higher_is_better、logged samples，以及 original/effective n_samples；
7. `aggregate_groups` 以 post-order 收集 Group，确保子组先于父组，再调用每个 Group 自己的 aggregate。

## 关键数据结构

```text
eval_results_acc[task] = {
  task,
  raw_metrics: {(metric, filter): [sample values]},
  logged_samples: [...]
}

EvalAcc
  metrics / configs / versions / num_fewshot
  higher_is_better / samples / n_samples / groups
```

锁定源码遍历 raw_metrics 时，会不断把 `sample_len` 改成当前 items 的长度，注释也明确提醒你，这个值最后反映的是最后一个 metric 的 count。这个坑要看清。只要不同 metric 因为缺失而积累出不同数量的 items，一个 sample_len 就会遮住它们的分母差异。这项边界可以直接从代码里核对，所以本仓库才要求每个 Metric 都明确记录自己的 denominator。

## 实现取舍与失败语义

Task 自己声明 aggregation 后，metric 怎样归并就能贴着任务语义来写，也可以采用 mean 以外的函数。可一旦代码找不到声明就 fallback 到 mean，扩展时虽然不容易立刻报错，却可能把原本需要配对、加权或非线性处理的 metric 算错。Bootstrap（自助法）stderr 能给出一层基础的不确定性估计，但它以 items 为重采样单位，如果多份 doc 来自同一实体或同一种 prompt 模板，你还得另外检查独立同分布假设是否站得住。

Group 会按后序遍历处理嵌套层级，这样父组开始归并时，所有子组都已经算出结果。higher_is_better 还要沿着子任务往上传，只要方向发生冲突，系统就不能悄悄选一个继续算。结果里能同时保存有效样本数和原始样本数，确实方便核对，但它仍不等于事先声明的 Trial Plan，limit 怎样生效、filter 去掉了什么、哪些值缺失，都要逐项查清。

## 动手实验

请手工计算两项 Task：T1 有 2 条样本，acc 为 `[1, 0]`，T2 有 4 条样本，acc 为 `[1, 1, 1, 0]`。先按 Group 声明的 `weight_by_size=true` 求出结果，再把两个 Task metric 直接做不加权 mean，并解释这两种算法为什么会得到不同答案。

再去看上游 `tests/test_aggregation_pipeline.py` 中单 Task、双 Task 加权、嵌套 Group 和错误路径各有哪些测试，然后列出你会为自定义 aggregation 补上的最小测试集。

## 预期输出与答案

T1=0.5，T2=0.75。若按样本数加权，结果是 `(2×0.5 + 4×0.75)/6 = 2/3`，两个 Task 等权做 mean 则得到 0.625。哪一个答案才符合任务，要看 Group 事先声明了什么 estimand，不能等结果出来后再挑算法。自定义 aggregation 至少要测试正常输入、空样本或单样本、不同 filter、stderr 支持以及与 Group 组合时的行为。

上游测试要求单 Task Group 保留原来的 Task metric，双 Task weighted Group 按 sample_len 加权，嵌套 Group 则必须验证子节点先算出结果。

## 如何核对

按顺序阅读 [`_compute_task_aggregations`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator_utils.py#L173-L212)、[`_collect_results`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator_utils.py#L222-L261)、[`aggregate_groups`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator_utils.py#L275-L299) 和 [`_process_results`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator_utils.py#L349-L387)，沿着返回值看结果怎样逐层汇总。这里要重点核对 fallback mean、bootstrap 上限的特殊处理、sample_len TODO 和 post-order traversal，然后回到 [`api/task.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/task.py#L403-L442)，看 ConfigurableTask 怎样注册 aggregation 和 higher_is_better。

## 本篇不能证明什么

聚合测试通过，只能说明锁定实现会怎样把每条样本的值汇成 Task 或 Group 输出，不能证明 benchmark 采样有效，也不能证明 stderr 覆盖了真实的不确定性，更不能据此把排行榜当成发布 Gate。样本是否独立、结论能否推广，以及哪些风险不允许互相补偿，都要在外层另行设计。

[上一节](02-request-execution.md) · [下一节](../../contents.md)
