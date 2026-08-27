# 02｜CompletionFn 与 Sample：谁负责调用，谁负责判断

[上一节](01-registry-eval-spec.md) · [下一节](03-recorder-metrics-boundaries.md)

## 本篇要解决什么问题

CompletionFn（补全函数）这个名字容易让人以为它要「完成一次评测」，其实它只接收给定的 prompt，再返回 CompletionResult。这条边界很窄。至于怎样遍历数据、组装 prompt、对照 Reference 以及聚合 metric，都是 Eval 在做。你先把这两层分开，就不会把模型重试、Sample 重复和 Scorer 判断全塞进同一个 callback，也更容易看懂 SolverEval 为什么另立了一条执行边界。

## 先建立源码地图

锁定的 `api.py` 只有一百多行，却把 [`CompletionFn` Protocol](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/api.py#L23-L40)、[`CompletionResult`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/api.py#L16-L19) 和匹配 helper 都放在了一起。Eval ABC、遍历 Sample 的 helper、CompletionFn 包装以及 SolverEval 则集中在 [`eval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py#L46-L85)，如果还想看 CompletionFn 从哪里开始解析，就顺着调用走到 [`registry.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py#L120-L151)。

`Eval` 接收一组 CompletionFn，`completion_fn` property 只是让代码取其中的单项时更方便。`SolverEval` 则要求你恰好传入一个 completion_fn，然后将它包成 Solver，因此两者留给扩展代码的含义不同，不能只凭名字判断。

## 完整调用链

![CompletionFn 在端到端链中的位置](../../assets/diagrams/harnesses/openai-evals/end-to-end.svg)

1. Registry 按模型名或 spec 创建 CompletionFn，对象只需满足协议，不需要知道 Eval key 或最终 Metric。
2. Eval class 从 Registry 相对 data 路径加载 JSONL Sample，可通过 `_index_samples` 给每条记录稳定运行内 index，并受 max_samples 限制。
3. Eval.run 为每条 Sample 设置 `recorder.as_default_recorder(sample_id)`，可先记录 raw_sample。
4. Eval 根据 doc 构造 prompt，调用 CompletionFn，取得 CompletionResult，具体实现可能记录 sampling 事件。
5. Eval 解析 sampled response，并调用 `record_match`、`record_metrics` 或自定义事件；`record_and_check_match` 同时记录 expected、picked、sampled 和 options。
6. Eval 累计局部结果，最后返回 dict，而 CLI 不理解每个 metric 的语义，只把 dict 交给 Recorder final report。
7. SolverEval 把单一 CompletionFn 作为 Solver 使用，Eval 代码与 Solver 交互；这允许多步逻辑，却仍需要具体 Eval 定义其状态和评分。

## 关键数据结构

`CompletionFn(prompt, **kwargs) -> CompletionResult` 把模型调用的边界圈了出来：CompletionFn 吃进 prompt，CompletionResult 向外给出 completion 或其他响应信息。Sample 通常只是一个 JSONL dict，具体 Eval class 自己解释其中结构，这比强制所有 Eval 共用一种 Sample 模型更灵活，但也削弱了跨 Eval 复用和 schema 检查。

Recorder 写 Event 时会把 sample_id 与 sampling、match 等 data 连在一起，但它没有统一记录 Trial ID、Target resolved identity 或 Attempt ordinal。所以把这些事件接入本仓库时，Adapter（适配器）要补上事先规划的 Trial 和基础设施恢复记录，否则很容易把多次 sampling event 错算成多个 Trial。

## 实现取舍与失败语义

CompletionFn Protocol 很小，各类模型和 Solver 因此容易接进来，Eval class 也可以自行安排大部分逻辑。代价也很具体：batching、重试、缓存、身份调和和错误分类会散到不同实现中。Eval 子类直接写事件固然开发得快，可你很难只靠静态代码确认每条 Score 都连到了同一组证据字段。

模型 API 超时之后，CompletionFn 内部可能会重试，但核心接口没有把 Attempt 明确记下来。如果 CompletionFn 正常返回了一个错误答案，这仍然是有效的产品结果，应该让 Eval 的 match 或 scorer 来判错。可要是 Sample schema 写错、Reference 缺失，或者 Eval class 抛出异常，系统就应记下 error，并说清它会不会进入最终分母。此外，Solver 自己发起的尝试属于被测算法，外层不能拿它当基础设施恢复。

## 动手实验

用伪代码写一个确定性 CompletionFn，让它接收金额、返回 shipping fee，并保证相同输入总会得到相同结果。然后再写一个 Eval，依次读入 99、100、101，将它们交给 CompletionFn，记下 expected/picked/match 并算出 accuracy，同时标明哪段代码在做 Target Adapter、Scorer 和 Metric 各自的事。

把金额 100 的 buggy 返回当作正常 CompletionResult，并说明为什么 CompletionFn 外层不应该反复重试，直到得到 fixed 答案。

## 预期输出与答案

CompletionFn 在做 Target Adapter 的工作，Scorer 负责比较 expected 和 picked，而把三条 match 取 mean 之后才得到 Metric。buggy 结果应该记为 match=false，但这条 Sample 已经完整跑完了。如果外层一直重新调用，直到 match=true 才停，Eval 就把 Reference 泄露给了被测策略，最后算出的分数也就没有意义了。

报告还要保留三条 Sample 事件，并把分母固定为 3，不能因错误类型不同就改变分母。如果某条记录因基础设施错误而没有产生结果，就把它明确标成 unscored/blocked，别从 mean 列表里直接删掉。

## 如何核对

阅读 [`CompletionFn`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/api.py#L23-L40)、[`DummyCompletionFn`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/api.py#L48-L52) 与 [`record_and_check_match`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/api.py#L55-L93)，再对照 [`Eval`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py#L46-L85)、[`SolverEval`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py#L168-L207) 和 [`_index_samples`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py#L30-L38)，核对职责确实分开。

## 本篇不能证明什么

协议把扩展代码从哪里接进来说清了，却不能证明具体 Eval 子类已经正确处理缺失、并发和网络重试，也不能保证响应真的来自所声明的模型版本。最后能不能信这份证据，还得回到具体代码和实际运行记录上。

[上一节](01-registry-eval-spec.md) · [下一节](03-recorder-metrics-boundaries.md)
