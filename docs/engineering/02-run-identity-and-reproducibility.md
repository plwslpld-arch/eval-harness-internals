# Run Identity 与可复现性：保存“实际运行了什么”

[上一节](01-minimal-eval-loop.md) · [下一节](03-retries-and-recovery.md)

## 本篇要解决什么问题

“使用 model-x 在 dataset-v2 上运行”不是可复现身份。模型别名可能漂移，Dataset 文件可被覆盖，脚本依赖当前工作目录，环境变量能改变行为，Scorer prompt 与阈值也可能后来修改。Eval Harness 必须在执行前把声明身份解析为实际身份，并用内容摘要把配置、输入、代码与产物连起来。本篇从 `canonical_digest`、安全相对路径、Trial ID 和 Artifact digest 说明最小做法。

读完后，你应能设计 RunManifest，区分 logical name、resolved identity 和 content digest；也能判断两次报告是否具备直接成对比较条件。这里的“可复现”不是保证未来远程 API 返回同样文本，而是保证读者知道当时使用了什么，并能在可控组件上重新构造。

## 核心机制

![运行身份从声明到证据](../assets/diagrams/foundations/04-lineage.svg)

Reference Harness 使用规范 JSON 序列化：字典键排序、固定分隔符、UTF-8，再计算 SHA-256。相同语义映射不因键顺序变化而改变 digest。Planner 将 EvaluationSpec digest 的一部分写进 run_id，再把 target_id、sample_id、repetition 组合为 Trial ID。ArtifactStore 对真实 bytes 求摘要，Bundle digest 再覆盖 Artifact 引用和 Trace 事件。

身份不能只靠摘要：摘要回答“内容是否相同”，字段回答“内容是什么角色”。RunManifest 应同时保存 evaluation_id、源码 commit、Python/依赖版本、Dataset digest、Target Adapter identity、实际模型/镜像、Scorer identity、Gate policy、随机种子和时间。秘密只记录来源名称，不记录值。

## 完整流程

1. 用户配置是 declared identity；加载器验证 schema，拒绝未知字段，避免拼错配置被静默忽略。
2. 配置路径解析必须局限于配置目录。绝对路径或 `..` 越界会让同一配置读取机器上的不同文件，因此 `_safe_input_path` 直接拒绝。
3. Dataset 每行解析为带稳定 sample_id 的 Sample；内容摘要应覆盖规范化输入与期望，而 sample_id 只负责逻辑引用。
4. Target 字符串解析为具体 Adapter 和参数。本地脚本保存相对路径及文件 digest；真实 API 还要记录服务返回的实际模型版本（若可得），不能把别名假装成不可变版本。
5. Planner 依据冻结 Spec 生成全量 Trial ID。恢复时必须对 manifest/digest，而不是只检查相同文件名。
6. 每次 Attempt 继承 Trial identity，并增加 ordinal。canonical 标记是执行恢复结果，不改变 Trial 的统计身份。
7. Artifact 与 Bundle 用内容摘要形成 lineage；inspect 重新读取 bytes 校验摘要，防止引用存在但内容已被替换。
8. Comparison 只在 candidate/baseline 共享 sample_id + repetition 且测量合同相同时配对。

## 关键数据与不变量

逻辑身份例如 `target_id=fixed`，解析身份例如脚本相对路径、digest、解释器版本，运行实例身份例如 `trial_id` 和 `attempt_id`。三者都要保留。Digest 必须带算法前缀 `sha256:`，否则未来算法迁移无法解释。Artifact relative_path 必须是运行目录内规范路径；验证时不能跟随它逃出证据根目录。

直接比较的最小不变量：Dataset 内容/切分相同，Sample 配对键相同，Target 之外的执行政策相同，Scorer/Metric 定义相同，缺失规则预先确定。如果 Judge 模型或 prompt 变化，即使 metric_id 相同，也不是同一测量合同。

## 动手实验

运行身份测试：

```bash
uv run pytest tests/test_identity.py tests/test_models.py tests/test_runtime_extensions.py -q
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/identity-demo
```

把 `evidence.json` 中某个 Artifact relative_path 改为 `../README.md`，再执行 inspect；随后恢复文件，改动 Artifact bytes 再执行。最后复制 shipping 配置，仅把 target_id 改名但脚本不变，回答两次运行是“内容相同”“逻辑身份相同”还是“可直接比较”。

## 预期输出与答案

路径越界在加载 ArtifactRef 时失败；bytes 篡改在摘要核验时失败。仅改 target_id 时，脚本内容可能相同，但逻辑 Target identity 已改变，报告坐标也改变；如果明确记录 rename mapping，可以说明实现内容等价，但不能仅凭 digest 自动断言实验条件完全相同，因为其他配置与运行环境也需核对。

`canonical_digest` 对字典键顺序稳定，但列表顺序有语义，所以改变样本、Target 或事件顺序应改变 digest。SHA-256 证明内容一致性，不证明来源可信或文件无恶意。

## 如何核对

阅读 [`identity.py`](../../src/eval_harness_reference/identity.py)、[`planner.py`](../../src/eval_harness_reference/planner.py)、[`artifacts.py`](../../src/eval_harness_reference/artifacts.py) 与 [`models.py`](../../src/eval_harness_reference/models.py) 的路径验证。再查看 [`test_identity.py`](../../tests/test_identity.py) 和 Artifact 安全测试。

## 本篇不能证明什么

内容摘要、锁文件和稳定 ID 不能保证远程模型确定、容器镜像供应链安全、时间依赖服务可重放或作者身份真实。它们建立可审计基础，不是密码学签名或可重复科学实验的全部条件。

[上一节](01-minimal-eval-loop.md) · [下一节](03-retries-and-recovery.md)
