# Eval Harness 源码内核

![Eval Harness 源码内核](assets/brand/lockup-light.svg)

> 从一个样本到一次发布决定，读懂评测系统如何运行。

这套面向开发者的中文 Eval Harness 源码教材，配有一个可离线运行的 Python Reference Harness，你会从 Task、Dataset、Trial、Attempt 和 Trace 开始，再沿六套真实开源实现读懂执行、评分、统计比较与发布 Gate。先跑通，再拆开看。

[开始学习](00-start-here.md){ .md-button .md-button--primary }
[选择学习路线](learning-paths.md){ .md-button }
[下载完整中文 PDF](downloads/eval-harness-internals-cn.pdf){ .md-button }

## 三条主线

| 主线 | 你会得到什么 |
| --- | --- |
| 共同语言 | 分清 Agent Harness 与 Eval Harness，建立 Sample、Trial、Attempt、Artifact、Score、Metric 和 Gate 的严格边界 |
| 源码知识库 | 沿锁定 commit 阅读 lm-evaluation-harness、Inspect AI、OpenAI Evals、Promptfoo、DeepEval、Harbor 与 Terminal-Bench 1 |
| 可运行参考 | 在无模型凭据、无容器的条件下执行 Target、保留证据、重评分、比较 Candidate/Baseline 并生成 Gate |

## 第一次运行

```bash
uv sync --frozen
uv run eval-harness-ref run reference/examples/shipping/eval.yaml --output output/shipping
uv run eval-harness-ref inspect output/shipping
uv run eval-harness-ref compare output/shipping --candidate-target fixed --baseline-target buggy
```

完整目录把案例、实验和验证方法放在同一条学习路径上，具体入口见[文档总目录](contents.md)。
