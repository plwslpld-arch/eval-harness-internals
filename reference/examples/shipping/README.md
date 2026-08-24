# 运费边界评测

这个确定性案例比较两个本地 Target。`buggy` 在金额恰好为 100 时仍收取运费，`fixed` 使用正确的 `>= 100` 边界。

从仓库根目录运行：

```bash
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/shipping
```

同一份 Dataset 会分别物化为三个 `buggy` Trial 和三个 `fixed` Trial。预期结果是 `buggy-release = failed`、`fixed-release = passed`。Harness 的评分读取子进程输出和冻结期望值，不读取 Target 对自己的成功声明。
