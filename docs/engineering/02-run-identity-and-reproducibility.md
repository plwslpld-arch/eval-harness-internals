# Run Identity 与可复现性：保存「实际运行了什么」

[上一节](01-minimal-eval-loop.md) · [下一节](03-retries-and-recovery.md)

## 本篇要解决什么问题

「使用 model-x 在 dataset-v2 上运行」还算不上可复现身份，因为模型别名会漂移，Dataset 可能被覆盖，脚本也可能依赖当前目录。环境变量、Scorer prompt 与阈值同样会变，所以两个名称无法还原运行条件。Eval Harness 必须先把声明身份解析为实际身份，再用摘要连接配置、输入、代码与产物——本篇围绕 `canonical_digest`、安全相对路径、Trial ID 和 Artifact digest，说明身份链最少需要什么。

读完后，你应能设计 RunManifest，区分 logical name、resolved identity 和 content digest，并判断两份报告能否直接配对比较。这里的「可复现」不保证远程 API 将来返回相同文本，只保证读者能确认当时使用了什么，并在可控组件上重构条件。

## 核心机制

![运行身份从声明到证据](../assets/diagrams/foundations/04-lineage.svg)

Reference Harness 先按键排序并固定分隔符与 UTF-8，再对规范 JSON 计算 SHA-256，因此键顺序不会改变语义相同映射的 digest。Planner 把 EvaluationSpec digest 的一部分写进 run_id，再用 target_id、sample_id 与 repetition 组成 Trial ID。ArtifactStore 对真实 bytes 求摘要，而 Bundle digest 继续覆盖 Artifact 引用和 Trace 事件，让产物回到同一条身份链。

身份不能只靠摘要，因为摘要回答「内容是否相同」，字段才说明「内容扮演什么角色」。因此 RunManifest 应保存 evaluation_id、源码 commit、Python/依赖版本、Dataset digest、Target Adapter identity、实际模型或镜像、Scorer identity、Gate policy、随机种子和时间。秘密只记来源，不记值。

## 完整流程

1. 用户配置是 declared identity，加载器验证 schema，拒绝未知字段，避免拼错配置被静默忽略。
2. 配置路径解析必须局限于配置目录。绝对路径或 `..` 越界会让同一配置读取机器上的不同文件，因此 `_safe_input_path` 直接拒绝。
3. Dataset 每行解析为带稳定 sample_id 的 Sample，内容摘要应覆盖规范化输入与期望，而 sample_id 只负责逻辑引用。
4. Target 字符串解析为具体 Adapter 和参数。本地脚本保存相对路径及文件 digest，真实 API 还要记录服务返回的实际模型版本（若可得），不能把别名假装成不可变版本。
5. Planner 依据冻结 Spec 生成全量 Trial ID。恢复时必须对 manifest/digest，而不是只检查相同文件名。
6. 每次 Attempt 继承 Trial identity，并增加 ordinal。canonical 标记是执行恢复结果，不改变 Trial 的统计身份。
7. Artifact 与 Bundle 用内容摘要形成 lineage，inspect 重新读取 bytes 校验摘要，防止引用存在但内容已被替换。
8. Comparison 只在 candidate/baseline 共享 sample_id + repetition 且测量合同相同时配对。

## 关键数据与不变量

逻辑身份可以是 `target_id=fixed`，解析身份由脚本相对路径、digest 和解释器版本组成，实例身份则包括 `trial_id` 与 `attempt_id`，三类缺一不可。Digest 必须带 `sha256:` 算法前缀，否则迁移算法后无法解释旧摘要。Artifact relative_path 也必须留在运行目录内，否则同一引用可能在不同机器上指向不同内容。

两次运行要直接比较，至少要让 Dataset 内容与切分、Sample 配对键、Target 之外的政策以及 Scorer/Metric 定义保持一致。缺失规则也必须预先确定，否则结果出来后再补规则，就会反向修改实验设计。Judge 模型或 prompt 一旦变化，即使 metric_id 相同，测量合同也已经不同。

## 动手实验

运行身份测试：

```bash
uv run pytest tests/test_identity.py tests/test_models.py tests/test_runtime_extensions.py -q
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/identity-demo
```

先把 `evidence.json` 中某个 Artifact relative_path 改为 `../README.md` 并执行 inspect，观察路径越界如何被拦截。恢复后再改动 Artifact bytes，这次检查内容摘要校验。最后复制 shipping 配置，只改 target_id 而不改脚本，再判断两次运行是「内容相同」「逻辑身份相同」，还是「可直接比较」。

## 预期输出与答案

路径越界会在加载 ArtifactRef 时失败，而 bytes 篡改会在摘要核验时失败，因为两道检查保护不同边界。只改 target_id 时，脚本虽未变化，逻辑 Target identity 和报告坐标却变了。rename mapping 可以说明实现内容等价，但不能只凭 digest 断言实验条件相同，因为配置与运行环境仍需核对。

`canonical_digest` 对字典键顺序保持稳定，但列表顺序本身带有语义，所以一旦改变样本、Target 或事件顺序，digest 也应该跟着改变。SHA-256 只能证明内容一致。它既不能证明来源可信，也不能证明文件没有恶意。

## 如何核对

阅读 [`identity.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/identity.py)、[`planner.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/planner.py)、[`artifacts.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/artifacts.py) 与 [`models.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/models.py) 的路径验证。再查看 [`test_identity.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_identity.py) 和 Artifact 安全测试。

## 本篇不能证明什么

内容摘要、锁文件和稳定 ID 能建立审计基础，却不能保证远程模型确定，也无法证明容器镜像供应链安全。时间依赖服务未必可重放，作者身份也需要额外证据。它们既不是密码学签名，也不是可重复实验的全部条件。

[上一节](01-minimal-eval-loop.md) · [下一节](03-retries-and-recovery.md)
