# Eval Harness 源码内核

![Eval Harness 源码内核](assets/brand/lockup-light.svg)

> 从一个样本到一次发布决定，读懂评测系统如何运行。

这是一套写给开发者的中文 Eval Harness 源码教材，仓库里还配了一个可以离线运行的 Python Reference Harness。你会先分清 Task、Dataset、Trial、Attempt 和 Trace，然后对照六套真实的开源实现，看懂系统怎样执行、评分和做统计比较，最后又如何作出发布 Gate 决定。先跑通，再拆开看。

[开始学习](00-start-here.md){ .md-button .md-button--primary }
[选择学习路线](learning-paths.md){ .md-button }
[下载完整中文 PDF](downloads/eval-harness-internals-cn.pdf){ .md-button }

## 姊妹项目

这套教材从「一次运行留下了什么证据」问起，重点是怎样根据证据作出判定。如果你还想知道这些证据是怎样产生的，
也就是模型给出下一步意图后，到底由谁把它变成可以控制、能够恢复的真实动作，可以去看
[Agent Harness 源码内核](https://plwslpld-arch.github.io/agent-harness-internals/) 里，
那套教材对着六套编程智能体的锁定源码，一路追查配置怎样组出来、工具循环如何往下走、权限在哪几层拦住操作，
以及会话中断后怎样恢复状态。两套教材用的是同一种读法：找到已经锁定的源码，再从精确行号一步步往下追。

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

完整目录已经把案例、实验和验证方法按学习顺序排好，你可以从[文档总目录](contents.md) 进入。
