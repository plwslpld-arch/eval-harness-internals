# 02｜请求执行：Instance 怎样分桶、批量调用并回填

[上一节](01-entry-task-loading.md) · [下一节](03-scoring-aggregation-tests.md)

## 本篇要解决什么问题

一条 benchmark 文档未必只调用一次模型，例如多项选择题会为每个选项各建一条 loglikelihood 请求，生成题可能只建一条 generate_until，repeats 还会把同一条请求复制出多份。只要把「模型请求数」「文档数」和「统计样本数」混在一起，成本、分母以及重试分别该怎么算都会跟着出错。这一篇就沿着 `evaluate` 的主循环走一遍，看 Instance 从建出来到收到响应、再回到文档结果的全过程。

## 先建立源码地图

调度循环从锁定的 [`evaluate()`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L429) 开始，请求由 Task 这一侧来建，入口是 [`build_all_requests()`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/task.py#L268)。[`api/instance.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/instance.py#L11-L25) 规定每条 Instance 要保存哪些字段，[`api/model.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/model.py#L40-L100) 则列出 Model Adapter（模型适配器）必须实现的三个请求方法。

`OutputType` 包含 loglikelihood、loglikelihood_rolling、generate_until 和 multiple_choice，不过源码注释说得很清楚，multiple_choice 真正进入调度时会拆成若干 loglikelihood 请求，所以 output_type 不一定和最后调用的 LM 方法同名，两者不能混称。

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

`resps` 收下每次重复请求返回的结果，`filtered_resps` 按名字保存 filter pipeline 的输出，等到调用 `process_results` 时，它拿到的是同一 doc 在某个 filter_key 下的过滤响应列表。所以 filter 并非报告格式化步骤，它会在评分前直接改数据，换一个 filter，metric 也可能跟着变化，最后的分数也会直接改变。

## 实现取舍与失败语义

调度器按 request_type 在全局分桶后，不同 Task 产生的同类请求便能放在一起批处理，从而提高模型吞吐，不过原来的文档顺序也会暂时散开，返回后必须依靠 doc_id/idx 重新排好。repeats 复制的是同一个 Instance 引用，虽然省下了反复创建对象的成本，却要求响应严格按请求顺序追加。严格 zip 能查出返回数量对不上，却发现不了 Adapter 把响应顺序排错。

分布式运行需要 padding 来对齐计算，但补出来的伪请求不能进入最终文档的 metric。构造缓存键时还必须纳入 chat template 和 tokenizer identity，否则系统可能在模板已经变化后，误用旧请求的缓存结果。unsafe Task 或多模态不兼容会让构造过程提前停下，具体 LM 遇到网络超时、速率限制后怎样 retry，则交给 Adapter 处理，因为核心 Instance 并没有像本仓库 Attempt 那样明确记录失败状态。

## 动手实验

设想一份四选一文档，Task 为四个选项各建一条 loglikelihood Instance，它们在 metadata 里的 doc_id 都是 7，idx 依次为 0..3，repeats=1。请写出 requests 怎样分桶，以及 LM 返回 `[(-1.2, true), (-0.4, true), (-2.1, true), (-3.0, true)]` 后各条 Instance 的 `resps`，然后把 repeats 改成 2，判断文档层的统计单位会不会也变成两个。

你也可以直接运行本仓库的静态课程合同：

```bash
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

四条 Instance 都会进入 `loglikelihood` 分桶，返回的响应按顺序写进各自的 `resps`，等代码按 doc_id=7 把它们归到一起，再按 idx 排好，`process_results` 就能选出 loglikelihood 最大的选项 B。repeats=2 会得到八次响应，可这些响应最终算不算两个统计观测，仍由 Task 处理重复结果的方式决定，不能看到 cloned request 变多，就直接把文档分母改成 2。

课程测试只检查本节有没有图示、完整章节、锁定链接和上下导航，它并不执行上游模型，因此不会下载 checkpoint，也不会访问模型 API。

## 如何核对

源码里的调度按顺序往前推进，依次打开下面七处代码，就能跟完一条 Instance 怎样创建、调用模型并收回响应。

1. [建立按 request_type 的全局分桶](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L489) — `requests = defaultdict(list)`
2. [请求 Task 构造全部 Instance](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L541) — `task.build_all_requests(...)`
3. [按 repeats 复制、按分布式补齐](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L591-L597) — `cloned_reqs`
4. [调用对应的 Model Adapter 方法](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L600) — `getattr(lm, reqtype)(cloned_reqs)`
5. [响应严格 zip 回填到原 Instance](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L602-L605) — `req.resps.append(x)`
6. [按 doc_id 分组、按 idx 排序](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L621-L626) — `instances_by_doc_id`
7. [把多个响应变成文档级 metric](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L639-L641) — `task.process_results(...)`

这些行号从 489 一直递增到 639，足以说明上面七步不是为了讲解方便而重新排列的顺序，源码本来就这样执行。随后再读 [`Instance.args`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/instance.py#L31-L38)，确认代码怎样把非 tuple 参数包装成 tuple。

## 本篇不能证明什么

源码顺序和哈希日志只能解释 Harness 核心怎样组织请求，不能证明 Model Adapter 没在服务端重试，也不能证明响应确实来自声明的模型，或每份 benchmark 文档在统计上彼此独立。真实身份、样本相关性和基础设施 Attempt 都还需要外层证据，因为日志记录不了这些边界。

[上一节](01-entry-task-loading.md) · [下一节](03-scoring-aggregation-tests.md)
