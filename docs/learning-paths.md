# 学习路线

[返回目录](contents.md) · [回到最后一篇基础课](foundations/07-eval-to-rl-and-release-eval.md)

## 路线 A：第一次系统学习 Eval Harness

按七篇基础课顺序阅读，每篇先运行实验，再看答案。之后学习 Reference Harness 工程篇，最后进入六条上游源码课程。目标不是记住某个工具的配置，而是能从任意 Harness 中辨认 Trial、证据、评分、聚合和 Gate 的真实责任站点。

验收问题：给你一份只有最终准确率的报告，你能列出还缺哪些身份、分母、血缘和不确定性证据，并说明缺失会使 Gate 失败、阻断还是无法判断。

## 路线 B：源码阅读与工具选型

先读基础 01、02、04、05，再按“完整端到端 README → 入口 → 数据结构 → 执行循环 → Scorer → 报告 → 测试”阅读每条源码课程。最后进入横向比较，不用功能勾选表代替语义分析。

验收问题：对于两个项目里的同名 `metric`，你能说明它们输入是一条 Observation 还是一组 Score，是否承担 Judge、聚合或 Gate 职责，并给出锁定源码证据。

## 路线 C：Agent 与 Coding Agent 评测

重点阅读基础 01、03、04、06，再学习 Harbor/Terminal-Bench、SWE-bench 机制案例和 Agent Environment 工程篇。把工具事件、Diff、测试结果和环境终态分别建模，不使用 Agent 最终自述替代独立断言。

验收问题：面对一个 Coding Agent 超时后成功的案例，你能区分 Agent 内部恢复和 Harness Attempt，证明统计分母没有变化，并从 Gate 反查到补丁与测试 Artifact。

## 路线 D：Eval-to-RL 与质量发布

重点阅读基础 05、06、07，再学习 Judge 校准、统计比较、质量 Gate 和 Eval-to-RL 工程篇。始终把训练 reward、checkpoint choice 和 independent release eval 分开。

验收问题：给定一条 Score，你能写出 RewardAdapter 能力合同，说明它适合 DPO 偏好、GRPO/RFT 标量 reward、部分支持还是不可用，并设计不参与训练的独立发布集。

## 推荐实践节奏

每一阶段都交付一个可核对产物：第一阶段是完整运行目录，第二阶段是带永久链接的调用链笔记，第三阶段是一个新增 Target Adapter 或 Scorer，第四阶段是带计划分母与独立 Gate 的对比报告。产物能运行和回放，比“读完多少页”更能暴露理解缺口。
