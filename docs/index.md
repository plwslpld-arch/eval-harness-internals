# Eval Harness 源码内核

![Eval Harness 源码内核](assets/brand/lockup-light.svg)

> 从一个样本到一次发布决定，读懂评测系统如何运行。

这套面向开发者的中文 Eval Harness 源码教材，配有一个可离线运行的 Python Reference Harness，你会从 Task、Dataset、Trial、Attempt 和 Trace 开始，再沿六套真实开源实现读懂执行、评分、统计比较与发布 Gate。先跑通，再拆开看。

[开始学习](00-start-here.md){ .md-button .md-button--primary }
[选择学习路线](learning-paths.md){ .md-button }
[下载完整中文 PDF](downloads/eval-harness-internals-cn.pdf){ .md-button }

## 姊妹项目

这套教材从「一次运行留下了什么证据」开始，回答的是判定问题。那些证据本身是怎样被产生的，
也就是模型给出下一步意图之后由谁把它变成可控制、可恢复的真实动作，写在
[Agent Harness 源码内核](https://plwslpld-arch.github.io/agent-harness-internals/) 里，
那边会沿六套编程智能体的锁定源码追配置怎样成形、工具循环怎样推进、权限在哪几层拦截、
以及会话状态怎样恢复。两套教材共用同一种读法，都从锁定源码的行号锚点出发。

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
