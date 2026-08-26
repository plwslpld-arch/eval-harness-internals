# 01｜Registry 与 EvalSpec：字符串怎样变成真实对象

[上一节](README.md) · [下一节](02-completion-sample-run.md)

## 本篇要解决什么问题

同一个 `eval-name` 在不同 Registry 路径可能指向不同 class、args 和数据；同一个模型字符串既可能命中 API 模型快捷分支，也可能是 Registry CompletionFn 或 Solver。若不理解加载顺序和解引用，运行命令看似相同，实际执行对象却可能不同。本节专门拆解 Registry 的身份解析。

## 先建立源码地图

核心实现位于锁定 [`registry.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py)。CLI 何时添加 registry paths 和覆盖 args 位于 [`cli/oaieval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/cli/oaieval.py)。Eval 怎样使用 `eval_registry_path` 解析数据位于 [`eval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py)。

Registry 资源类型包括 completion_fns、solvers、eval_sets、evals 和 modelgraded。每次属性访问可从配置路径加载对应目录；加载时保存资源来源路径，并对重复条目执行断言。

## 完整调用链

![OpenAI Evals Registry 解析](../../assets/diagrams/harnesses/openai-evals/registry.svg)

1. Registry 初始化默认路径；CLI `--registry_path` 可追加更多目录。
2. `_load_resources` 扫描某一资源类型的 YAML，`_load_registry` 合并条目。重复 name 立即失败，避免静默覆盖。
3. `get_eval(name)` 通过 `_dereference` 把原始字典解析为 EvalSpec，并把 registry_path 留在 spec 中。
4. CLI 把 extra_eval_params 合入 EvalSpec.args。此时 spec 已不同于仓库静态 YAML，必须记录解析后值。
5. `make_completion_fn` 先识别 dummy 或已知 OpenAI 模型名，再查询 CompletionFn/Solver Registry；最终加载类、合并 kwargs，并验证实例满足 CompletionFn。
6. `get_class(eval_spec)` 取得 Eval class。实例化时传入 eval_registry_path，Eval 的数据路径通过 `_prefix_registry_path` 落到对应 Registry 的 data 目录。

## 关键数据结构

RawRegistry 是 name 到原始 spec 的字典。BaseEvalSpec/EvalSpec/CompletionFnSpec 把 key、class 名、args、metrics 和 registry_path 结构化。逻辑 key 便于引用，class 决定代码，args 决定行为，registry_path 决定数据相对路径；四者缺一都不能构成完整身份。

RunSpec 又保存 run_id、completion_fns 和 eval_spec，供 Recorder 每个 Event 引用。它比单条 EvalSpec 更接近一次运行身份，但数据文件内容、代码 commit 和服务端实际模型仍需外部摘要补足。

## 实现取舍与失败语义

多 Registry 路径支持私有 Eval 覆盖和扩展，但当前重复 key 选择失败而非后者覆盖，这是更安全的显式冲突策略。每次加载资源简单直观，却意味着性能和确定性依赖文件系统状态；要离线复现，应该把解析结果和来源版本一起冻结。

CLI override 提高实验速度，却会让静态 YAML 与实际运行不一致。CompletionFn 模型快捷分支方便常见 API，却让“字符串解析规则”也成为版本化身份的一部分。找不到 key、class 载入失败或实例不满足 Protocol 应在运行前阻断，而不是生成空结果。

## 动手实验

假设两个 registry paths 都定义 `shipping.eval`，一个 class 为规则 Eval，一个 class 为 ModelGraded Eval。回答加载器应静默选择哪个；再假设只有一个条目，但 CLI 把 `max_samples` 从 100 改成 10，报告应保存 YAML 值还是解析后值。

列出生成永久运行指纹所需字段，并与本仓库 `canonical_digest` 的输入思路比较。

## 预期输出与答案

锁定实现会拒绝重复 key，不应静默选前或选后。报告必须保存解析后的 10，同时保留 override 来源，静态 YAML 的 100 只能解释默认值。指纹至少应覆盖 Registry commit/路径、EvalSpec class/args、CompletionFn class/args、数据摘要和代码版本。

若仅哈希逻辑 key，两个不同 Registry 的同名 Eval 会碰撞；若只哈希 YAML 又忽略 CLI override，也无法代表实际运行。

## 如何核对

在 [`registry.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py#L287-L310) 搜索 `_load_registry`、`duplicate entry`、`_dereference`、`make_completion_fn` 与 `_evals`。在 [`cli/oaieval.py`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/cli/oaieval.py) 核对 extra_eval_params 和 completion_args 的合并时点。

## 本篇不能证明什么

确定解析对象不能证明 YAML 内容正确、数据授权充分或 class 无副作用。Registry 解决配置发现与实例化，不替代 Dataset 治理、Sandbox 隔离或 Scorer 有效性。

[上一节](README.md) · [下一节](02-completion-sample-run.md)
