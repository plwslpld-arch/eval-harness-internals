# 03｜评分、聚合与测试：从 `process_results` 到 Group 结果

[上一节](02-request-execution.md) · [下一节](../../contents.md)

## 本篇要解决什么问题

模型响应回填以后，系统里还没有现成的「准确率」，因为 Task 必须先把同一文档的若干响应解释成逐样本 metric，再为每个 metric 选择聚合函数并计算标准误，有时还要把多个 Task 继续聚合为 Group。这里最容易漏掉几个问题：自定义 metric 没写 aggregation 会发生什么，有效样本数怎样计算，Group 为什么必须自底向上处理，测试又锁住了哪些语义？

## 先建立源码地图

逐样本处理由 [`Task.process_results()`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/task.py#L403-L442) 承担，aggregation 配置也放在同一个类里，而核心循环把结果加入 raw_metrics 的代码位于 [`evaluate()`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L429-L468)。Task 与 Group 聚合、stderr 和结果容器分散在 `evaluator_utils.py` 的四个函数中，后文会按执行顺序逐个走过。

源码里的 `process_results` 这个名字很容易让人误会，因为它处理的是单个 doc 的结果，并非整次运行报告。返回字典里的 value 会先逐条积累，之后 aggregation 才会产出 Task metric。

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

在锁定源码中，`sample_len` 会在遍历 raw_metrics 时被设置为当前 items 的长度，而注释明确提示，它目前反映的是最后一个 metric 的 count。如果不同 metric 因为缺失而产生不同长度，只看一个 sample_len 就可能把分母差异藏起来。这是可以直接核对的实现边界——也正因为如此，本仓库才坚持让每个 Metric 显式记录 denominator。

## 实现取舍与失败语义

Task 自带 aggregation，可以让 metric 定义贴近任务语义，也能支持 mean 以外的函数，但 fallback mean 虽然提高了扩展时的容错性，却可能把原本需要成对、加权或非线性处理的 metric 错误聚合。Bootstrap stderr 能提供一层基础不确定性，不过它的重采样单位是 items，所以当多个 doc 来自同一实体或同一 prompt 模板时，独立同分布假设仍需额外审查。

Group 使用后序遍历处理嵌套层级，因为这样可以确保父组开始聚合时，子组结果已经生成。higher_is_better 需要跨子任务传播，一旦方向冲突，就不能悄悄挑选其中一个。有效样本与原始样本能够同时保存是个优点，但这仍不是预声明的 Trial Plan，limit、过滤和缺失还要由读者逐项核对。

## 动手实验

手工计算以下两组 Task，其中 T1 有 2 个样本，acc 为 `[1, 0]`，T2 有 4 个样本，acc 为 `[1, 1, 1, 0]`。如果 Group 设置 `weight_by_size=true`，请先求出结果，然后再对两个 Task metric 做不加权 mean，并解释为什么两种算法得到的结果不同。

再查看上游 `tests/test_aggregation_pipeline.py` 的单 Task、双 Task 加权、嵌套 Group 和错误路径测试名称，列出你会为自定义 aggregation 新增的最小测试。

## 预期输出与答案

T1=0.5，T2=0.75。按样本数加权时，结果是 `(2×0.5 + 4×0.75)/6 = 2/3`，而 Task 等权 mean 得到 0.625。究竟哪一个正确，取决于 Group 事先声明的 estimand，不能等看到结果以后再挑选算法。自定义 aggregation 至少要覆盖正常输入、空样本或单样本、不同 filter、stderr 支持与 Group 组合。

上游测试里的单 Task Group 应保持原有 Task metric，双 Task weighted Group 应按 sample_len 加权，而嵌套 Group 必须验证子节点先产生结果。

## 如何核对

依次阅读 [`_compute_task_aggregations`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator_utils.py#L173-L212)、[`_collect_results`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator_utils.py#L222-L261)、[`aggregate_groups`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator_utils.py#L275-L299) 和 [`_process_results`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator_utils.py#L349-L387)。特别核对 fallback mean、bootstrap 上限特例、sample_len TODO 与 post-order traversal。再回到 [`api/task.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/task.py#L403-L442) 查看 ConfigurableTask 怎样注册 aggregation 和 higher_is_better。

## 本篇不能证明什么

聚合测试通过，只能证明锁定实现会怎样把逐样本值变成 Task 或 Group 输出，不能证明 benchmark 的采样有效，也不能证明 stderr 已经覆盖真实不确定性，更不能因此把任务排行榜当成发布 Gate。独立性、外部有效性和非补偿风险政策，仍需外层设计。

[上一节](02-request-execution.md) · [下一节](../../contents.md)
