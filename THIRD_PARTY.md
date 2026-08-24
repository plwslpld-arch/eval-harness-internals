# 第三方来源与许可证

本仓库的正文、图示和 Reference Harness 是独立编写的教学材料。源码课程通过永久链接引用上游公开仓库，不把上游源码复制进本仓库，也不改变上游许可证、名称或商标的归属。

`sources/sources.yml` 说明每个来源的研究范围，`sources/sources.lock.yml` 固定实际阅读的提交。正文中的“源码事实”必须能回到这里锁定的文件；跨多个调用点重建的数据流会标为“机制解释”，为教学缩小的实现会标为“教学简化”。

| 来源 | 锁定提交 | 许可证 | 本仓库使用方式 |
| --- | --- | --- | --- |
| [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) | `ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66` | [MIT](https://github.com/EleutherAI/lm-evaluation-harness/blob/ffb2f7b0dfbb05a8095b04947a15cc0a70d54c66/LICENSE.md) | 永久链接与机制讲解 |
| [Inspect AI](https://github.com/UKGovernmentBEIS/inspect_ai) | `ebf4815ee260afcc8c34ad9d66e6f8d98a89e905` | [MIT](https://github.com/UKGovernmentBEIS/inspect_ai/blob/ebf4815ee260afcc8c34ad9d66e6f8d98a89e905/LICENSE) | 永久链接与机制讲解 |
| [OpenAI Evals](https://github.com/openai/evals) | `8eac7a7de5215c907fbddc30efdaf316913eccdd` | [MIT](https://github.com/openai/evals/blob/8eac7a7de5215c907fbddc30efdaf316913eccdd/LICENSE.md) | 永久链接与机制讲解 |
| [Promptfoo](https://github.com/promptfoo/promptfoo) | `ce89186a22c59543f4f71a55d42442ff3f0e3654` | [MIT](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/LICENSE) | 永久链接与机制讲解 |
| [DeepEval](https://github.com/confident-ai/deepeval) | `a2e0d4cfd3118352d321c1c84bdeba17d4a201bc` | [Apache-2.0](https://github.com/confident-ai/deepeval/blob/a2e0d4cfd3118352d321c1c84bdeba17d4a201bc/LICENSE.md) | 永久链接与机制讲解 |
| [Harbor](https://github.com/harbor-framework/harbor) | `74f0176384cff88b99306770473b4875760c5a21` | [Apache-2.0](https://github.com/harbor-framework/harbor/blob/74f0176384cff88b99306770473b4875760c5a21/LICENSE) | 永久链接与机制讲解 |
| [Terminal-Bench 1](https://github.com/harbor-framework/terminal-bench-1) | `d28711d0da2675d0bb1d56de45ae5df6082438a3` | [Apache-2.0](https://github.com/harbor-framework/terminal-bench-1/blob/d28711d0da2675d0bb1d56de45ae5df6082438a3/LICENSE) | Harbor 课程的历史机制对照 |
| [SWE-bench](https://github.com/SWE-bench/SWE-bench) | `7a21e05772954cc81471ae19d56f436cecf43c54` | [MIT](https://github.com/SWE-bench/SWE-bench/blob/7a21e05772954cc81471ae19d56f436cecf43c54/LICENSE) | Agent 环境评测机制案例 |

课程中的上游项目名称仅用于识别研究对象，不表示这些项目认可或维护本仓库。若上游仓库在锁定提交之后改变实现，正文仍以锁定提交为解释对象，更新时必须重新生成锁文件并复核课程链接。

## 核对命令

```bash
python scripts/sources.py verify
python scripts/sources.py links
```

第一条命令检查注册表与锁文件的一致性；第二条命令列出所有锁定源码文件的永久链接。重新锁定会访问上游分支，只有在准备同步更新课程时才执行：

```bash
python scripts/sources.py lock
```
