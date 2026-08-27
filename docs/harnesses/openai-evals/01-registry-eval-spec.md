# 01｜Registry 与 EvalSpec：字符串怎样变成真实对象

[上一节](README.md) · [下一节](02-completion-sample-run.md)

## 本篇要解决什么问题

同一个 `eval-name` 放进不同的 Registry（注册表）路径，可能会找到不同的 class、args 和数据。模型字符串也有两条去向：要么命中 API 模型的快捷分支，要么由 Registry 解成 CompletionFn（补全函数）或 Solver。你若跳过加载顺序和解引用过程，两条看似相同的运行命令就可能造出不同对象。因此这一篇先看 Registry 究竟怎样认出每个对象。

## 先建立源码地图

核心代码在锁定的 [`Registry` 类](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py#L103-L142) 里，读时可以按 [`get_eval`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py#L210-L211)、[`_dereference`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py#L156-L191) 和 [`_load_registry`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py#L287-L310) 三段往下追。要看 CLI 何时加入 registry paths、又怎样覆盖 args，得转到 [`run()`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/cli/oaieval.py#L118-L157)，因为入口会合并参数，Registry 并不接手这个动作。至于 Eval 如何根据 `eval_registry_path` 找到数据，答案写在 [`Eval` 基类](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/eval.py#L46-L85) 中。

Registry 会管住 completion_fns、solvers、eval_sets、evals 和 modelgraded 等多类资源。代码访问相应属性时，它才从配置路径加载目录，记下每项资源来自哪里，并在发现重复条目时立即断言失败。

## 完整调用链

![OpenAI Evals Registry 解析](../../assets/diagrams/harnesses/openai-evals/registry.svg)

1. Registry 初始化默认路径；CLI `--registry_path` 可追加更多目录。
2. `_load_resources` 扫描某一资源类型的 YAML，`_load_registry` 合并条目；重复 name 立即失败，避免静默覆盖。
3. `get_eval(name)` 通过 `_dereference` 把原始字典解析为 EvalSpec，并把 registry_path 留在 spec 中。
4. CLI 把 extra_eval_params 合入 EvalSpec.args，此时 spec 已不同于仓库静态 YAML，必须记录解析后值。
5. `make_completion_fn` 先识别 dummy 或已知 OpenAI 模型名，再查询 CompletionFn/Solver Registry；最终加载类、合并 kwargs，并验证实例满足 CompletionFn。
6. `get_class(eval_spec)` 取得 Eval class；实例化时传入 eval_registry_path，Eval 的数据路径通过 `_prefix_registry_path` 落到对应 Registry 的 data 目录。

## 关键数据结构

RawRegistry 先用 name 指向原始 spec，BaseEvalSpec/EvalSpec/CompletionFnSpec 再把其中的 key、class 名、args、metrics 和 registry_path 拆成结构化字段。这些字段各管一件事：key 负责引用，class 选中代码，args 改变行为，registry_path 则告诉程序去哪个相对路径找数据。少一项，运行身份都会走样。

RunSpec（运行规格）还会记下 run_id、completion_fns 和 eval_spec，Recorder 写每个 Event 时都可以引用它，因此 RunSpec 比一条 EvalSpec 更能表示某次具体运行。不过，它没有收进数据文件的内容、代码 commit 和服务端真正使用的模型，你还得在外部摘要里补齐这些信息。

## 实现取舍与失败语义

允许多条 Registry 路径，私有 Eval 就有了扩展位置，但当前代码一旦碰到重复 key 就会失败，不让后加载的条目覆盖前者。冲突因此会当场暴露。另一方面，等到访问属性时才加载资源固然直观，却会让性能和结果是否稳定受文件系统当时的状态影响，所以做离线复现时要把解析结果和来源版本一起冻结。

CLI override 能让你更快调实验参数，但它也会让静态 YAML 与真正跑起来的配置不再一样。CompletionFn 的模型快捷分支便于调用常见 API，同时也把字符串怎样解析变成了运行身份的一部分，因此这套规则也要记录版本。如果 key 不存在、class 没能载入，或者实例不满足 Protocol，系统应该在运行前就停下来，不能留下一份看似已经完成的空结果。

## 动手实验

假设两个 registry paths 都定义了 `shipping.eval`，但一个 class 是规则 Eval，另一个却是 ModelGraded Eval，请判断加载器能不能静默挑一个。然后只保留一个条目，让 CLI 把 `max_samples` 从 100 改成 10，再看报告究竟该记 YAML 中的默认值，还是程序解析后真正使用的值。

列出生成永久运行指纹所需字段，并与本仓库 `canonical_digest` 的输入思路比较。

## 预期输出与答案

锁定的实现一看到重复 key 就会拒绝加载，不会悄悄挑前者或后者。报告要记下解析后的 10，也要留住 override 来自哪里，因为静态 YAML 里的 100 只表示默认值。要算出能区分实际运行的指纹，你至少还得把 Registry commit/路径、EvalSpec class/args、CompletionFn class/args、数据摘要和代码版本收进去。

如果只哈希逻辑 key，两个 Registry 里的同名 Eval 就会撞在一起，但只哈希 YAML 又会漏掉 CLI override。两种做法都不足以代表真正跑过的那次运行。

## 如何核对

依次打开 [`_load_registry`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py#L287-L310)（重复条目在这里被发现）、[`_dereference`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py#L156-L191) 和 [`make_completion_fn`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/registry.py#L120-L151)，再在 [`run()`](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/evals/cli/oaieval.py#L118-L157) 核对 extra_eval_params 和 completion_args 的合并时点。

## 本篇不能证明什么

即使你已经确定 Registry 最后解出了哪个对象，也不能由此证明 YAML 写对了、数据得到了充分授权，或者 class 不会带来副作用。Registry 只找配置并实例化对象，它代替不了 Dataset 治理、Sandbox 隔离和 Scorer 有效性验证。

[上一节](README.md) · [下一节](02-completion-sample-run.md)
