# 01｜入口与 Task 加载：`simple_evaluate` 实际装配了什么

[上一节](README.md) · [下一节](02-request-execution.md)

## 本篇要解决什么问题

很多调用示例只写一行 `simple_evaluate(model=..., tasks=...)`，看起来像是它亲自跑完整个执行循环，其实源码先让它解析模型、加上缓存、加载 Task 和 Group（任务组）、改写 Task 配置并记录实验身份，随后才把真正的执行交给 `evaluate`。你得先分清这两个入口各管哪一段，才能判断某项配置是在运行前就定好了，还是会跟着样本循环继续变化。

## 先建立源码地图

主要证据在锁定的 [`evaluator.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L55-L94) 里，`simple_evaluate` 会接收模型字符串或已经初始化的 `LM`，还会收下 Task 名称、few-shot、batch、device、cache、seed、chat template 和日志选项。它随后调用外部的 `TaskManager.load`，不过这篇先不展开 Manager 怎样扫描资源，只看加载出来的对象如何进入核心循环。

[`api/model.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/model.py#L250-L289) 定义了 Model Adapter（模型适配器）这一层，`LM` 规定模型必须提供哪些请求方法以及怎样处理 rank/world_size 和分布式原语，`CachingLM` 则代理其中几种请求，并按参数哈希缓存响应。Task 从 [`Task` 基类](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/task.py#L64-L103) 展开，请求也由 Task 这一侧来建，入口是 [`build_all_requests()`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/task.py#L268-L307)。

## 完整调用链

![入口、Task 和执行层的关系](../../assets/diagrams/harnesses/lm-eval/end-to-end.svg)

1. `simple_evaluate` 设置 Python、NumPy、Torch 和 few-shot 随机种子，而这些种子用途不同，不能只保存一个 `seed` 字段。
2. 模型参数若是字符串，Registry 找到 Model 类并调用 `create_from_arg_string`；传入对象则必须是 `LM` 子类，否则抛出 TypeError。
3. 开启请求缓存时，以 rank 区分 SQLite 文件，再用 `CachingLM` 包住真实模型。非确定性 generation 参数会影响是否缓存。
4. 若调用者未传 TaskManager，入口创建一个；`load(tasks)` 返回任务、组和层级信息。
5. 对每个 Task，入口覆盖 generation kwargs、predict-only metric、num_fewshot 和 few-shot seed。Task 显式配置 0-shot 时不会被命令参数强行改成别的值。
6. `check_integrity` 为真时执行 Task 测试；EvaluationTracker 存模型来源、参数、system instruction 和 chat template。
7. 调用 `evaluate` 后，只有主 rank 构建最终结果，并补充实际模型信息、batch、device、各类 seed、git hash、日期、环境和 tokenizer 信息。

## 关键数据结构

`TaskManager.load` 返回的并非一个简单的 `dict[str, Task]`，结果里至少有 `tasks` 和 `groups`，每项 Task 还带着 output_type、few-shot、generation_kwargs、metric 与 filter 等配置。高层结果会在 `config` 中同时记下逻辑模型名和运行参数，如果 LM 还提供 `get_model_info`，代码就继续把更具体的模型信息合进来。

如果你想复现运行，只保存字符串 `model="hf"` 还不够，它只说明用了哪类 Adapter，真正的 checkpoint 多半藏在 `model_args` 里，服务端 API 甚至可能把同一个逻辑名字指向不同的实际版本。名字不够用。因此，本仓库只把这类配置算作 Target Identity 的一部分，不会拿它冒充完整的实际身份。

## 实现取舍与失败语义

高层入口集中处理兼容问题和便捷选项，`evaluate` 因而可以假定 LM 已经初始化、Task 也已经加载好。可配置是在对象加载以后才被覆盖的，所以你必须继续追到最终 Task config，不能看完 YAML 就停下。源码还把 predict-only 通过把 metric 改成 bypass 来实现的办法称为较 hacky，这其实是在提醒你，「只生成输出」和「产出可以解释的 Score」属于两种运行模式。若模型类型根本不满足 `LM` 协议，运行会在开始前直接失败。

Task 完整性测试只要失败，运行就会立即停下，最终结果也只由 rank 0 返回并写入文件，避免多个进程重复输出。缓存不代表身份。缓存文件按 rank 拆开后，确实能避免并发写入互相冲突，但这不能证明不同机器、不同 tokenizer 或浮动模型身份之间可以安全共用缓存。

## 动手实验

读一遍 `simple_evaluate` 的参数表，然后为 shipping Reference Harness 画一张映射表：把 `model/model_args` 对到 TargetSpec，把 `tasks` 对到 Task/Dataset 选择，把 `limit` 对到计划抽样，把 `bootstrap_iters` 对到统计配置，再把 `use_cache` 对到执行优化。每一项都要标明是「完全对应」「部分对应」还是「不等价」。

然后执行：

```bash
python scripts/sources.py links
```

检查输出里的 `evaluator.py` 链接，确认它带着锁定 commit，而没有指向会继续变化的 `main`。

## 预期输出与答案

`model/model_args` 只能**部分对应** TargetSpec，因为系统可能要等运行结束后才能核对实际服务身份。`tasks` 也只能部分对应 Task/Dataset，毕竟 Task 对象同时装着 prompt 和 metric。`limit` 不能等跑完以后随手截结果，它应该在运行前就写进 Trial/Sample 计划，`bootstrap_iters` 则用来配置聚合时怎样估计不确定性，`use_cache` 只负责优化执行，不该改变逻辑输出。

链接命令应该逐项列出 `evaluator.py`、`api/task.py`、`api/model.py`、`api/instance.py` 和 `evaluator_utils.py` 的永久 URL，这几份文件合起来，正好圈出本篇要讲的源码范围。

## 如何核对

从 [`simple_evaluate()`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L55-L94) 开始，按执行顺序找到 [`create_from_arg_string`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/model.py#L131-L146)、[`CachingLM`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/model.py#L250-L289)、`task_manager.load` 和覆盖 Task 配置的代码，最后跟到 [`evaluate()`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L429-L468)。然后再进 [`api/model.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/model.py#L250-L289)，核对缓存究竟代理了哪些请求类型，以及 generation 采用采样时为什么可能禁用缓存。

## 本篇不能证明什么

保存入口参数，确实比留一张命令行截图更能说明当时怎样运行，但它依然证明不了模型服务端的实际版本、Dataset 文件内容和网络环境完全相同。你还得用内容摘要、服务返回的实际身份和 Artifact（产物）血缘把证据补齐。

[上一节](README.md) · [下一节](02-request-execution.md)
