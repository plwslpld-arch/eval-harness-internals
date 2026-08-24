# 安全策略

## 支持范围

当前仅维护 `main` 分支的最新版本。Reference Harness 是教学实现，不应在未经独立安全评审的情况下直接用于不受信任代码或生产发布流程。

## 私密报告

凭据泄露、路径穿越、命令注入、沙箱逃逸、恶意 Artifact、敏感数据泄露等问题，请使用 GitHub Private Vulnerability Reporting。若仓库没有启用该功能，请通过 [`plwslpld-arch` GitHub 主页](https://github.com/plwslpld-arch)公开的联系方式先建立私密渠道，不要在公开 Issue 中提交利用细节。

报告建议包含受影响提交、运行环境、最小复现、影响范围和建议修复方向。请移除令牌、Cookie、个人数据、专有样本和无关攻击载荷。

## 凭据处理

任何出现在日志、聊天、Issue 或提交中的真实凭据都应视为已泄露：立即撤销并轮换。仅删除可见文本不能使凭据恢复安全。

## 评测安全边界

- Reference Harness 的本地子进程 Target 不构成安全沙箱；
- 导入外部 Trace 或 Artifact 前应校验大小、路径、摘要和媒体类型；
- LLM-as-a-Judge 的输入可能携带提示注入，不应获得工具、网络或发布权限；
- Gate 计算结果是证据，不自动授予生产发布权限。
