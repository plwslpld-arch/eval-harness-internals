# Run Identity 与可复现性：保存「实际运行了什么」

[上一节](01-minimal-eval-loop.md) · [下一节](03-retries-and-recovery.md)

## 本篇要解决什么问题

只写下「使用 model-x 在 dataset-v2 上运行」，还不足以让别人复现这次运行，因为模型别名会漂移，Dataset 可能被覆盖，脚本也可能依赖当时的工作目录。环境变量、Scorer prompt 和阈值同样会变，只留两个名称，根本还原不了运行条件。Eval Harness 必须先把声明的身份解析成实际使用的身份，再用摘要把配置、输入、代码和产物连起来。本篇会围绕 `canonical_digest`、安全相对路径、Trial ID 和 Artifact digest，讲清这条身份链至少要留下什么。

读完以后，你应该能设计一份 RunManifest，分清 logical name、resolved identity 和 content digest，也能判断两份报告是否具备直接配对的条件。这里说的「可复现」，不保证远程 API 将来还会返回相同文本，只保证你能查明当时实际用了什么，并在可控的组件上重新搭出相同条件。

## 核心机制

![运行身份从声明到证据](../assets/diagrams/foundations/04-lineage.svg)

Reference Harness 先给键排序，固定分隔符和 UTF-8 编码，再对规范化后的 JSON 计算 SHA-256，因此两个映射只要语义相同，就不会因为键的顺序不同而得到不同 digest。Planner 取 EvaluationSpec digest 的一部分写入 run_id，再把 target_id、sample_id 和 repetition 拼成 Trial ID。ArtifactStore 直接对真实 bytes 求摘要，Bundle digest 则继续覆盖 Artifact 引用和 Trace 事件，于是你可以沿同一条身份链查回每份产物。

身份不能只看摘要，因为摘要只能回答「内容是否相同」，各个字段才会说明这些内容分别拿来做什么。因此，RunManifest 应当保存 evaluation_id、源码 commit、Python 和依赖版本、Dataset digest、Target Adapter（被测对象适配器）identity、实际模型或镜像、Scorer identity、Gate policy、随机种子和时间。秘密只记录它来自哪里，千万别把秘密值直接写进 RunManifest。

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

逻辑身份可以写成 `target_id=fixed`，解析身份要记录脚本的相对路径、digest 和解释器版本，到了具体实例，还要带上 `trial_id` 与 `attempt_id`。三类身份缺了哪一类都不行。Digest 必须带 `sha256:` 算法前缀，否则以后换了算法，你就无法解释旧摘要是怎么算出来的。Artifact relative_path 也必须限制在运行目录里，否则同一个引用换台机器，可能就指向了另一份内容。

想直接比较两次运行，至少要保证 Dataset 的内容和切分方式、Sample 配对键、Target 以外的政策，以及 Scorer 和 Metric 定义都一致。怎样处理缺失数据，也必须提前定好。要是看到结果以后再补规则，就等于倒过来修改实验设计。Judge 模型或 prompt 只要变过，即便 metric_id 没变，两次运行用的也已经不是同一份测量合同。

## 动手实验

运行身份测试：

```bash
uv run pytest tests/test_identity.py tests/test_models.py tests/test_runtime_extensions.py -q
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/identity-demo
```

先把 `evidence.json` 中某个 Artifact relative_path 改为 `../README.md` 并执行 inspect，观察路径越界如何被拦截。恢复后再改动 Artifact bytes，这次检查内容摘要校验。最后复制 shipping 配置，只改 target_id 而不改脚本，再判断两次运行是「内容相同」「逻辑身份相同」，还是「可直接比较」。

## 预期输出与答案

路径一旦越界，系统会在加载 ArtifactRef 时拦下它。有人篡改 bytes，则会在核对摘要时失败，因为这两道检查守的是不同边界。只改 target_id 时，脚本虽然没变，逻辑 Target identity 和报告坐标却已经变了。rename mapping 可以说明两边的实现内容等价，但你不能只凭 digest 就断言实验条件相同，配置和运行环境仍然要逐项核对。

`canonical_digest` 不会受字典键顺序影响，但列表的顺序本身有含义，所以只要样本、Target 或事件换了顺序，digest 就应该跟着变。SHA-256 只能证明内容一致。它证明不了来源可信，也看不出文件是否带有恶意。

## 如何核对

阅读 [`identity.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/identity.py)、[`planner.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/planner.py)、[`artifacts.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/artifacts.py) 与 [`models.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/models.py) 的路径验证。再查看 [`test_identity.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/tests/test_identity.py) 和 Artifact 安全测试。

## 本篇不能证明什么

内容摘要、锁文件和稳定 ID 可以打下审计基础，却保证不了远程模型每次都给出相同结果，也证明不了容器镜像的供应链安全。依赖时间的服务未必能够重放，作者身份也得靠额外证据确认。这些记录不是密码学签名，也没有覆盖可重复实验所需的全部条件。

[上一节](01-minimal-eval-loop.md) · [下一节](03-retries-and-recovery.md)
