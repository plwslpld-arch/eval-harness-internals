# 实验二：新增一个 Target Adapter

[上一节](01-run-one-deterministic-eval.md) · [下一节](03-write-a-scorer.md)

## 本篇要解决什么问题

Target Adapter 负责把各不相同的被测系统接入统一的 `run(Trial) -> TargetResult` 接口——后续运行、评分和门禁都依赖这层翻译。本实验会从安全子进程 Adapter 的现成实现出发，再设计 HTTP 或本地函数 Adapter 的合同，因为真正影响评测可信度的是错误分类、身份记录和秘密边界，SDK 参数反倒只是实现细节。

## 核心机制

![Target Adapter 与执行边界](../assets/diagrams/foundations/01-boundary.svg)

Adapter 的职责很窄，它只执行一次 Trial，既不管理 Harness retry，也不参与评分或决定 Gate。边界要守住。运行结束后，它应返回 completed/product_failure，只有基础设施故障导致这次运行没有留下有效产品观察时，才抛出 InfrastructureError。输入取自 `trial.sample.input`，而输出必须满足 JSON object 合同。

## 完整流程

1. 阅读 TargetAdapter Protocol 与 SubprocessTarget；
2. 列出新系统的 resolved identity、输入转换、输出 schema、timeout 和错误表；
3. 禁止 shell 字符串，使用 argv 或客户端结构化参数；
4. 把 4xx/5xx、timeout、拒答和非法输出按产品合同分类；
5. 为 Adapter 写合同测试：正常、产品失败、超时、启动/网络失败和秘密不落盘；
6. 只有 Adapter 输出有效 observation 后，Runner 才创建 canonical Attempt。

```bash
uv run pytest tests/test_subprocess_target.py tests/test_runner.py -q
```

## 关键数据与不变量

Adapter identity 至少要记录类型、实现版本、实际 endpoint/model/script digest 和非敏感配置，否则之后很难确认结果究竟来自哪个系统。InfrastructureError code 也要保持稳定，因为捕获所有 Exception 再无限 retry，会把产品失败伪装成偶发的基础设施问题。产品拒答如果属于系统合同允许的输出，就应作为 completed observation 交给 Scorer，网络根本没有连通才属于 infra。

## 动手实验

复制纸面模板实现 `LocalFunctionTarget`，让构造函数接收 callable，并由 run 把 input 传入函数后检查返回值是否为 dict。然后设计四个测试，分别覆盖返回 dict、返回 list、抛业务异常和抛 InfrastructureError，并写出每种情况下预期出现的 TargetResult/Attempt。

## 预期输出与答案

返回 dict 时应得到 completed，返回 list 时应得到 product_failure 或明确的 contract error。业务异常如果代表被测代码自身失败，就要保存为 product_failure，只有明确的基础设施异常才触发新 Attempt。Callable 的身份还要包含模块、qualname 与代码 digest，只写 `function` 无法区分两段完全不同的实现。

## 如何核对

阅读 [`targets/base.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/targets/base.py)、[`targets/subprocess.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/targets/subprocess.py) 与测试，确认 Subprocess 使用 `shell=False`、UTF-8 和 timeout。

## 本篇不能证明什么

Adapter 合同通过，只能说明这一层按约定完成了输入转换、执行和结果分类，而远端服务是否幂等、认证是否安全，以及输出是否真的来自声明的模型，仍要放到集成环境中结合实际身份、服务端记录和端到端的完整请求链路核验。

[上一节](01-run-one-deterministic-eval.md) · [下一节](03-write-a-scorer.md)
