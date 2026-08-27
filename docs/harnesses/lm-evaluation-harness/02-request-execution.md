# 02｜请求执行：Instance 怎样分桶、批量调用并回填

[上一节](01-entry-task-loading.md) · [下一节](03-scoring-aggregation-tests.md)

## 本篇要解决什么问题

一条 benchmark 文档并不一定只对应一次模型调用，例如多项选择题可能为每个选项各构造一条 loglikelihood 请求，生成题却可能只有一条 generate_until，而且请求还会因为 repeats 被复制。一旦把「模型请求数」「文档数」和「统计样本数」混在一起，成本、分母和重试语义就都会算错，因此本节会沿着 `evaluate` 的核心循环追踪 Instance 的完整生命周期。

## 先建立源码地图

调度循环位于锁定 [`evaluate()`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L429)，Task 侧的请求构造入口是 [`build_all_requests()`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/task.py#L268)，Instance 的字段定义在 [`api/instance.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/instance.py#L11-L25)，Model 必须实现的三个请求方法列在 [`api/model.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/model.py#L40-L100)。

`OutputType` 包含 loglikelihood、loglikelihood_rolling、generate_until 和 multiple_choice，不过源码注释说明，multiple_choice 在调度时会分派成若干 loglikelihood 请求，因此 output_type 与最终 LM 方法名并不总是一字不差。两者不能混称。

## 完整调用链

![Instance 请求执行与回填](../../assets/diagrams/harnesses/lm-eval/request-execution.svg)

1. `evaluate` 为每个 Task 计算 limit 或指定 sample indices，再调用 `task.build_all_requests`，传入 rank、world_size、cache、system instruction 和 chat template 等上下文。
2. Task 遍历评测文档、构造上下文并创建 Instance。metadata 在 `__post_init__` 中拆为 task_name、doc_id 和 repeats；idx 表示同一文档内请求顺序。
3. 调度器遍历 `task.instances`，按 request_type 放入全局 requests 分桶。分布式模式先收集各 rank 数量，为较短 rank 计算 padding_requests。
4. 每个分桶内按照 `req.repeats` 复制对象；分布式补齐再增加伪请求，使各 rank 前向批次数一致。
5. `getattr(lm, reqtype)(cloned_reqs)` 调用对应 Model Adapter 方法。返回列表与 cloned_reqs 用严格 zip 对齐，每个响应追加到原 Instance 的 `resps`。
6. Task 执行 filter，生成 `filtered_resps`。调度器按 doc_id 分组、按 idx 排序，恢复「同一文档的多条请求」顺序。
7. `task.process_results(doc, filtered responses)` 把多个响应变为文档级 metric。可选 sample log 同时记录 arguments、原始响应、过滤响应和 doc/prompt/target hash。

## 关键数据结构

下面三种基数必须分别记录：

| 基数 | 由什么决定 | 用途 |
| --- | --- | --- |
| eval docs | Task Dataset 与 limit/samples | 文档级结果的候选分母 |
| Instance | 每个文档的请求构造 | 模型调用与 batching |
| cloned requests | Instance.repeats 与分布式 padding | 实际 Adapter 调用数量 |

`resps` 保存所有重复返回，`filtered_resps` 保存 filter pipeline 的命名输出，而 `process_results` 接收到的则是某个 filter_key 下同一 doc 的过滤响应列表。因此，filter 不是报告格式化步骤，而是进入评分前的数据变换，一旦改变 filter，metric 也可能跟着变化。这会直接改分数。

## 实现取舍与失败语义

按 request_type 全局分桶，可以让不同 Task 的同类请求一起批处理，从而充分利用模型吞吐，但文档顺序也会被暂时打散，随后必须依靠 doc_id/idx 正确重组。repeats 通过复制同一个 Instance 引用来实现，这虽然节省了对象构造，却要求响应追加顺序绝对稳定——严格 zip 能检测响应数量不一致，却查不出 Adapter 返回顺序错误。

分布式 padding 是计算同步所需的手段，伪请求不应进入最终文档 metric，而 chat template 与 tokenizer identity 必须参与请求构造缓存键，否则旧请求可能在新模板下被错误复用。unsafe Task 与多模态不兼容会在构造前阻断，至于具体 LM 的网络超时、速率限制和内部 retry，则由 Adapter 承担，因为核心 Instance 没有本仓库 Attempt 那种显式失败状态。

## 动手实验

设想一个四选一文档，Task 为四个选项各构造 loglikelihood Instance，metadata 的 doc_id 都是 7，idx 为 0..3，repeats=1。写出 requests 分桶和 LM 返回 `[(-1.2, true), (-0.4, true), (-2.1, true), (-3.0, true)]` 后的 `resps`，再假设 repeats=2，并回答文档级统计单位是否会随之变成两个。

你也可以直接运行本仓库的静态课程合同：

```bash
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

四条 Instance 都会进入 `loglikelihood` 分桶，响应则依次写入各自的 `resps`，等它们按 doc_id=7 分组并按 idx 排序后，`process_results` 就能选出 loglikelihood 最大的选项 B。repeats=2 时会产生八次响应，但这些响应是否形成两个统计观测，仍取决于 Task 怎样处理重复，不能只因 cloned request 增加就把文档分母改成 2。

课程测试只需确认本节包含图示、完整章节、锁定链接和上下导航，因为它不会执行上游模型，所以既不会下载 checkpoint，也不会访问模型 API。

## 如何核对

调度在源码里是顺序递进的，七个位置依次打开就能跟完一条 Instance 的一生。

1. [建立按 request_type 的全局分桶](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L489) — `requests = defaultdict(list)`
2. [请求 Task 构造全部 Instance](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L541) — `task.build_all_requests(...)`
3. [按 repeats 复制、按分布式补齐](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L591-L597) — `cloned_reqs`
4. [调用对应的 Model Adapter 方法](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L600) — `getattr(lm, reqtype)(cloned_reqs)`
5. [响应严格 zip 回填到原 Instance](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L602-L605) — `req.resps.append(x)`
6. [按 doc_id 分组、按 idx 排序](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L621-L626) — `instances_by_doc_id`
7. [把多个响应变成文档级 metric](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L639-L641) — `task.process_results(...)`

行号本身就是证据，因为从 489 到 639 一路递增，正文那七步并非重排出来的叙述顺序，而是源码的实际执行顺序。接着再读 [`Instance.args`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/instance.py#L31-L38)，确认它怎样把非 tuple 参数包装成 tuple。

## 本篇不能证明什么

源码顺序与哈希日志只能解释 Harness 核心怎样组织请求，不能证明 Model Adapter 没有服务端重试、响应确实来自声明模型，也不能证明每个 benchmark 文档在统计上彼此独立，而真实身份、相关性和基础设施 Attempt 仍需外层证据。日志也有边界。

[上一节](01-entry-task-loading.md) · [下一节](03-scoring-aggregation-tests.md)
