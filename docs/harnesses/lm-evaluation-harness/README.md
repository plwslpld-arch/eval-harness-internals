# lm-evaluation-harness 源码课程：Task 怎样变成批量模型请求

[上一节](../../foundations/07-eval-to-rl-and-release-eval.md) · [下一节](01-entry-task-loading.md)

## 本篇要解决什么问题

lm-evaluation-harness 常被当成「跑 benchmark 的命令行工具」，可源码更有意思的地方在于，它能把不同 Dataset、prompt 写法和 metric 转成少数几类模型请求。只看 CLI 参数，你就看不到 Task 何时把一份文档拆成多条请求，也不会明白 Model Adapter（模型适配器）为什么无需理解具体 benchmark，更难跟清每条样本的值怎样重新组合并汇成任务结果。

课程以锁定提交 `ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66` 为准，不跟着浮动的 `main` 变化。阅读时会依次经过装配、构造请求、执行并回填、处理样本和聚合结果五个环节，同时把它与本仓库 Trial/Attempt/Observation 对不上的地方明确标出来。

## 先建立源码地图

| 站点 | 锁定文件 | 主要责任 |
| --- | --- | --- |
| 高层入口 | [`evaluator.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py) | `simple_evaluate` 装配模型、Task、缓存与运行配置 |
| Task 抽象 | [`api/task.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/task.py) | 文档、上下文、Instance、过滤、逐样本 metric 与聚合函数 |
| Model Adapter | [`api/model.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/model.py) | `loglikelihood`、rolling likelihood、generation 与缓存代理 |
| 请求对象 | [`api/instance.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/instance.py) | 连接文档、请求参数、重复响应和过滤响应 |
| 聚合 | [`evaluator_utils.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator_utils.py) | Task/Group metric、stderr、配置和样本数整理 |

表中内容都能从上游源码直接核对，所以属于**上游源码事实**。课程若进一步把它们映射成「Planner、Target Adapter、Scorer、Metric」，给出的就是**机制解释**，因为上游并没有采用 Reference Harness 的全套对象和状态枚举。

## 完整调用链

![lm-evaluation-harness 端到端调用链](../../assets/diagrams/harnesses/lm-eval/end-to-end.svg)

1. CLI 最终调用 `simple_evaluate`；若 `model` 是字符串，Registry 创建 `LM` 子类，若启用缓存，再用 `CachingLM` 包装。
2. `TaskManager.load(tasks)` 返回 `tasks`、`groups` 等结构，入口覆盖 generation kwargs、few-shot 数和随机种子，并可运行 Task 完整性测试。
3. `simple_evaluate` 调用较低层 `evaluate(lm, task_dict, ...)`。后者为每个 Task 调用 `build_all_requests`，把评测文档变成 `Instance`。
4. `evaluate` 按 `Instance.request_type` 分桶，复制 `repeats`，必要时为分布式 rank 补齐，然后通过 `getattr(lm, reqtype)` 批量调用 Model Adapter。
5. 响应按顺序追加到 `Instance.resps`；Task 运行 filter 后，源码按 `doc_id` 重新分组、按 `idx` 排序，把过滤响应交回 `task.process_results`。
6. 每个文档得到的 metric 值进入 `raw_metrics[(metric, filter)]`；`_process_results` 先做 Task 聚合和 stderr，再自底向上做 Group 聚合。
7. 高层入口补充模型、batch、device、seed、git hash、日期、环境与 tokenizer 信息，返回结果字典。

## 关键数据结构

要跟懂整条链路，先得认清 `Instance`：它既不代表 Dataset 里的一条 Sample，也不代表单独运行一次进程，只是交给 Model Adapter 的一条请求。

```text
Instance
  request_type     loglikelihood / loglikelihood_rolling /
                   generate_until / multiple_choice
  doc              原 Task 文档
  arguments        交给 LM 方法的参数
  task_name, doc_id, idx
  repeats          同一请求需要几次响应
  resps            原始响应
  filtered_resps   filter 后交给 process_results 的响应
```

一份多项选择文档可以生成多条 loglikelihood Instance，它们共享 doc_id，再用不同 idx 表示各自在文档里的顺序，所以「请求数」完全可能比「样本数」大得多。基数必须分清。上游结果还会保存 doc/prompt/target hash，方便你核对 sample log，但这些血缘字段不能与本仓库的 Observation Bundle（观测包）逐项对应。

## 实现取舍与失败语义

所有模型只要实现少数几种请求方法，Task 就能和具体后端分开，系统也更容易批处理或缓存响应，但复杂的 Agent 轨迹、工具副作用和环境终态很难自然塞进这些接口。Task 既要构造请求，又要运行 filter、算出每条样本的 metric，再声明 aggregation，扩展点虽然集中，承担的责任也更重。如果自定义 metric 没写 aggregation，源码会先警告再 fallback 到 mean，这只是为了让运行别立刻停下，不能证明 mean 真符合这个 metric 的统计含义。

Task 如果标着 unsafe code，却没有得到明确确认，`evaluate` 会拒绝运行。多模态 Task 遇上不支持多模态的 LM，系统同样会提前失败，而各个分布式 rank 的请求数不相等时，代码则会补齐调用。Model 请求出错后怎样恢复，主要由具体 Adapter 决定，因为核心 `evaluate` 里的 `repeats` 只用来采样或取得多次响应，不能直接算成基础设施 Attempt。这不是同一种重试。

## 动手实验

不下载模型也能验证这条链路怎样变换对象：打开锁定源码里的 `tests/test_aggregation_pipeline.py`，找到一项包含 4 个 raw `acc` 值的测试，手工算出 Task 和单 Task Group（任务组）的结果，然后在本仓库运行下面两条命令。

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

第二条命令不会运行上游模型，它只会确认课程里的源码链接都落在锁定范围内，并检查正文和图示是否满足学习合同。

## 预期输出与答案

`[1, 0, 1, 0]` 做 mean 后得到 0.5，单 Task Group 的结果仍是 0.5，此时 sample_len 为 4。一份文档若有四个候选选项，通常会产生四条 loglikelihood Instance，最后却只得到一组文档层 metric，所以请求数绝不能直接充当准确率的分母。

`sources.py verify` 应该报告 8 个来源锁文件都有效，课程测试也应该通过。只要上游链接用了 `main` 而没有写 40 位 commit，或链接路径超出锁定 scope，测试就该失败。

## 如何核对

先在 [`evaluator.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py) 搜索 `build_all_requests`，沿着调用继续追到 `getattr(lm, reqtype)`、`req.resps.append`、`process_results` 和 `_process_results`，然后再读 [`api/instance.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/instance.py)，逐项验证 doc_id、idx、repeats 与 resps 各自起什么作用。不要只引用 README 里的概念描述。

## 本篇不能证明什么

锁定调用链只能解释这个提交怎样组织 benchmark 型评测，不能证明某个 benchmark 能代表真实业务，也不能证明模型排名可靠，或上游同样适合评测 Agent 环境。数据是否有效、Adapter 怎样从网络错误中恢复、发布 Gate 又该采用什么政策，都要另行审查。

[上一节](../../foundations/07-eval-to-rl-and-release-eval.md) · [下一节](01-entry-task-loading.md)
