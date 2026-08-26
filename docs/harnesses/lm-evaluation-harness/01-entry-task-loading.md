# 01｜入口与 Task 加载：`simple_evaluate` 实际装配了什么

[上一节](README.md) · [下一节](02-request-execution.md)

## 本篇要解决什么问题

很多调用示例只展示 `simple_evaluate(model=..., tasks=...)`，容易让人以为它就是执行循环。源码中它更像装配层：解析模型、加缓存、加载 Task/Group、覆盖 Task 配置、记录实验身份，然后把真正执行交给 `evaluate`。分清两层入口，才能知道一个配置是在运行前固定，还是在样本循环中动态变化。

## 先建立源码地图

主要证据位于锁定 [`evaluator.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py#L55-L94)。`simple_evaluate` 接收模型字符串或已初始化 `LM`、Task 名称、few-shot、batch、device、cache、seed、chat template 和日志选项。它调用外部 `TaskManager.load`，但本课程把 Manager 的内部扫描留到扩展节，先专注加载结果怎样进入核心循环。

Model Adapter 抽象在 [`api/model.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/model.py#L250-L289)：`LM` 规定请求方法、rank/world_size 和分布式原语，`CachingLM` 代理特定请求方法并按参数哈希缓存结果。Task 抽象在 [`api/task.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/task.py)。

## 完整调用链

![入口、Task 和执行层的关系](../../assets/diagrams/harnesses/lm-eval/end-to-end.svg)

1. `simple_evaluate` 设置 Python、NumPy、Torch 和 few-shot 随机种子。这些种子用途不同，不能只保存一个 `seed` 字段。
2. 模型参数若是字符串，Registry 找到 Model 类并调用 `create_from_arg_string`；传入对象则必须是 `LM` 子类，否则抛出 TypeError。
3. 开启请求缓存时，以 rank 区分 SQLite 文件，再用 `CachingLM` 包住真实模型。非确定性 generation 参数会影响是否缓存。
4. 若调用者未传 TaskManager，入口创建一个；`load(tasks)` 返回任务、组和层级信息。
5. 对每个 Task，入口覆盖 generation kwargs、predict-only metric、num_fewshot 和 few-shot seed。Task 显式配置 0-shot 时不会被命令参数强行改成别的值。
6. `check_integrity` 为真时执行 Task 测试；EvaluationTracker 存模型来源、参数、system instruction 和 chat template。
7. 调用 `evaluate` 后，只有主 rank 构建最终结果，并补充实际模型信息、batch、device、各类 seed、git hash、日期、环境和 tokenizer 信息。

## 关键数据结构

加载结果不是简单 `dict[str, Task]`，而是至少含 `tasks` 与 `groups` 的结构。Task 配置包含 output_type、few-shot、generation_kwargs、metric 与 filter 等。高层结果的 `config` 同时保存逻辑模型名和运行参数；若 LM 暴露 `get_model_info`，还会合并更具体的模型信息。

从可复现角度看，字符串 `model="hf"` 只是 Adapter 类型，`model_args` 才可能包含 checkpoint；服务端 API 仍可能把逻辑名字解析到不同实际版本。因此本仓库会把这种配置视为 Target Identity 的一部分，而不把它等同于完整实际身份。

## 实现取舍与失败语义

高层入口集中处理兼容性和用户便利，使 `evaluate` 能假定收到已初始化 LM 与已加载 Task。代价是配置覆盖发生在对象加载后，读者必须追踪最终 Task config，不能只看 YAML。predict-only 通过覆盖 metric 为 bypass 是源码自己标注为较 hacky 的做法；这提醒我们“只生成输出”和“有可解释 Score”是两种运行模式。

模型类型不满足 `LM` 协议会在运行前失败；Task 完整性测试失败也应阻断。只有 rank 0 返回结果并写文件，避免多进程重复输出。缓存文件按 rank 分开解决并发写入，却不自动证明不同机器、tokenizer 或浮动模型身份的缓存可互换。

## 动手实验

阅读 `simple_evaluate` 的参数表，为 shipping Reference Harness 写一张映射表：`model/model_args` 对应 TargetSpec，`tasks` 对应 Task/Dataset 选择，`limit` 对应计划抽样，`bootstrap_iters` 对应统计配置，`use_cache` 对应执行优化。对每一项标注“完全对应、部分对应、不等价”。

然后执行：

```bash
python scripts/sources.py links
```

确认输出中的 `evaluator.py` 链接包含锁定 commit，而不是 `main`。

## 预期输出与答案

`model/model_args` 只能**部分对应** TargetSpec，因为实际服务身份可能需要运行后调和；`tasks` 也只部分对应 Task/Dataset，因为 Task 对象同时含 prompt 和 metric；`limit` 不是随意截断结果，而应在运行前进入 Trial/Sample 计划；`bootstrap_iters` 是聚合不确定性参数；`use_cache` 是执行优化，不应改变逻辑输出。

链接命令应列出 `evaluator.py`、`api/task.py`、`api/model.py`、`api/instance.py` 与 `evaluator_utils.py` 的永久 URL。

## 如何核对

在 [`evaluator.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/evaluator.py) 中按顺序定位 `get_model(...).create_from_arg_string`、`CachingLM`、`task_manager.load`、Task 配置覆盖、`evaluate(` 和结果 config。再到 [`api/model.py`](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/lm_eval/api/model.py#L250-L289) 核对缓存仅代理哪些请求类型以及 generation 采样为何可能禁用缓存。

## 本篇不能证明什么

保存入口参数不能证明模型服务端实际版本、Dataset 文件内容或网络环境完全相同。它提供了强于命令行截图的运行身份，却仍需要内容摘要、实际身份返回和 Artifact 血缘补足。

[上一节](README.md) · [下一节](02-request-execution.md)
