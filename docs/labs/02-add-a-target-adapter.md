# 实验二：新增一个 Target Adapter

[上一节](01-run-one-deterministic-eval.md) · [下一节](03-write-a-scorer.md)

## 本篇要解决什么问题

Target Adapter 把任意被测系统翻译为统一 `run(Trial) -> TargetResult`。本实验先理解安全子进程 Adapter，再设计 HTTP/本地函数 Adapter 的合同，重点是错误分类、身份和秘密边界，而不是堆 SDK 参数。

## 核心机制

![Target Adapter 与执行边界](../assets/diagrams/foundations/01-boundary.svg)

Adapter 只执行一次 Trial，不管理 Harness retry、不评分、不决定 Gate。它返回 completed/product_failure，或仅在没有有效产品观察的基础设施故障时抛 InfrastructureError。输入来自 `trial.sample.input`，输出必须是 JSON object。

## 完整流程

1. 阅读 TargetAdapter Protocol 与 SubprocessTarget。
2. 列出新系统的 resolved identity、输入转换、输出 schema、timeout 和错误表。
3. 禁止 shell 字符串，使用 argv 或客户端结构化参数。
4. 把 4xx/5xx、timeout、拒答和非法输出按产品合同分类。
5. 为 Adapter 写合同测试：正常、产品失败、超时、启动/网络失败和秘密不落盘。
6. 只有 Adapter 输出有效 observation 后，Runner 才创建 canonical Attempt。

```bash
uv run pytest tests/test_subprocess_target.py tests/test_runner.py -q
```

## 关键数据与不变量

Adapter identity 至少包括类型、实现版本、实际 endpoint/model/script digest 和非敏感配置。InfrastructureError code 要稳定；不能捕获所有 Exception 后无限 retry。产品拒答若是系统合法输出，应作为 completed observation 交给 Scorer；网络未连接才是 infra。

## 动手实验

复制纸面模板实现 `LocalFunctionTarget`，构造函数接收 callable，run 将 input 传给函数并要求返回 dict。设计四个测试：返回 dict、返回 list、抛业务异常、抛 InfrastructureError。写出每种期望 TargetResult/Attempt。

## 预期输出与答案

dict → completed；list → product_failure 或明确 contract error；业务异常若代表被测代码失败，应保存 product_failure；明确基础设施异常才触发新 Attempt。Callable 身份还需模块、qualname 与代码 digest，不能只写 `function`。

## 如何核对

阅读 [`targets/base.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/targets/base.py)、[`targets/subprocess.py`](https://github.com/plwslpld-arch/eval-harness-internals/blob/main/src/eval_harness_reference/targets/subprocess.py) 与测试。确认 Subprocess 使用 `shell=False`、UTF-8 和 timeout。

## 本篇不能证明什么

Adapter 合同通过不能证明远端服务幂等、认证安全或输出真实来自声明模型；这些需要集成环境和实际身份调和。

[上一节](01-run-one-deterministic-eval.md) · [下一节](03-write-a-scorer.md)
