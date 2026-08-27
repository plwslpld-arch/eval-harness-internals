# 02｜CompletionFn 与 Sample：谁负责调用，谁负责判断

[上一节](01-registry-eval-spec.md) · [下一节](03-recorder-metrics-boundaries.md)

## 本篇要解决什么问题

CompletionFn 这个名字听起来像是「完成一次评测」，但它实际只负责根据给定 prompt 产生 CompletionResult，而数据怎样遍历、prompt 怎样构造、Reference 怎样比较以及 metric 怎样聚合，都由 Eval 决定。把两者分清之后，模型重试、Sample 重复和 Scorer 判断就不会被塞进同一个 callback，SolverEval 为何构成另一种执行边界也更容易理解。

## 先建立源码地图

[`CompletionFn` Protocol](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/api.py#L23-L40)、[`CompletionResult`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/api.py#L16-L19) 与匹配 helper 都在锁定 `api.py` 中，整个文件只有一百多行，而 Eval ABC、Sample 迭代 helper、CompletionFn 包装和 SolverEval 则集中在 [`eval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py#L46-L85)，要追 CompletionFn 的解析入口还需继续看到 [`registry.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py#L120-L151)。

`Eval` 接收的是 CompletionFn 列表，`completion_fn` property 只是为了方便访问其中的单项，而 `SolverEval` 要求恰好传入一个 completion_fn，并把它包装成 Solver，因此两者的扩展语义并不相同，不能只看名称作判断。

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

`CompletionFn(prompt, **kwargs) -> CompletionResult` 划出了模型调用边界，CompletionResult 会暴露 completion 或相关响应信息，而 Sample 通常只是 JSONL dict，其结构交给具体 Eval class 解释，因此这种设计比统一 Sample 模型灵活，但跨 Eval 复用和 schema 检查也会更弱。

Recorder Event 会把 sample_id 与 sampling、match 等 data 绑定起来，却没有统一的 Trial ID、Target resolved identity 或 Attempt ordinal。接入本仓库时，需要由 Adapter 补充计划 Trial 和基础设施恢复记录，否则多次 sampling event 很容易被误算成多个 Trial。

## 实现取舍与失败语义

CompletionFn Protocol 很小，因此多种模型和 Solver 都容易接入，Eval class 也能保留较大的自由度。不过，batching、重试、缓存、身份调和和错误分类会因此散落在不同实现中——自由度的代价就在这里，而 Eval 子类直接写事件虽然便于快速开发，却很难静态证明每条 Score 都绑定了相同的证据字段。

模型 API 超时可能会在 CompletionFn 内部重试，但核心接口没有显式 Attempt，而 CompletionFn 正常返回了错误答案时，仍然属于产品结果，应由 Eval 的 match 或 scorer 判错。遇到 Sample schema 错误、Reference 缺失或 Eval class 异常时，则应记录 error 并明确它是否进入最终分母，而 Solver 的自我尝试属于被测算法，外层不能把它当成基础设施恢复。

## 动手实验

用伪代码写一个确定性 CompletionFn，让它接收金额并返回 shipping fee，同时保证相同输入总会得到相同结果。然后再写一个 Eval，依次加载 99、100、101，调用 CompletionFn，记录 expected/picked/match 并返回 accuracy，同时标出哪些代码属于 Target Adapter、Scorer 和 Metric。

把金额 100 的 buggy 返回当作正常 CompletionResult，并说明为什么 CompletionFn 外层不应该反复重试，直到得到 fixed 答案。

## 预期输出与答案

CompletionFn 是 Target Adapter，expected/picked 比较属于 Scorer，三条 match 的 mean 才是 Metric。buggy 结果应产生 match=false，但它仍是一条已经完成的 Sample。一旦外层继续调用直至 match=true，Eval 就会泄露 Reference 并改变被测策略。分数也就失去意义。

正确的报告还应保留三条 Sample 事件，并把分母固定为 3，不能让它随着错误类型变化。如果某条记录因基础设施错误而没有结果，就应显式标为 unscored/blocked，不能直接从 mean 列表中删掉。

## 如何核对

阅读 [`CompletionFn`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/api.py#L23-L40)、[`DummyCompletionFn`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/api.py#L48-L52) 与 [`record_and_check_match`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/api.py#L55-L93)，再对照 [`Eval`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py#L46-L85)、[`SolverEval`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py#L168-L207) 和 [`_index_samples`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py#L30-L38)，核对职责确实分开。

## 本篇不能证明什么

协议分层只能给出扩展接缝，既不能证明具体 Eval 子类正确处理了缺失、并发或网络重试，也不能证明模型响应确实来自声明版本。证据质量最终取决于实现细节和运行记录。

[上一节](01-registry-eval-spec.md) · [下一节](03-recorder-metrics-boundaries.md)
