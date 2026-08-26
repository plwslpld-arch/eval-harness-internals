# 来源与许可证边界

[上一节](verification.md) · [下一节](../00-start-here.md)

本仓库原创代码采用 MIT 许可证，原创文档采用 Creative Commons Attribution 4.0（CC BY 4.0）；上游项目的源码、名称、商标、论文与截图保持各自许可证和权利边界——本仓库不是任何上游项目的官方实现或背书。

## 来源锁定

- `sources/sources.yml`：项目、课程用途、许可证、允许研究的源码范围；
- `sources/sources.lock.yml`：40 位 commit 与精确 scope paths；
- `THIRD_PARTY.md`：面向读者的第三方来源清单；
- `NOTICE.md`：原创与第三方材料的归属说明。

上游仓库按需检出到 Git 忽略目录，不复制进本仓库历史，而正文只链接锁定 commit 下的 scope 文件；课程中的伪代码、流程图和 Reference Harness 是原创教学简化，不冒充上游源码。

## 证据等级

正文区分上游源码事实、跨调用点机制解释、教学简化、外部公开契约和不可核对。读者若引用结论，应同时保留课程所用 commit；若上游后来改变，应针对新 commit 重新核对，不把旧教材结论自动外推。

## 商标与品牌

Eval Harness 源码内核使用独立品牌，不拼接上游 Logo。项目名只用于准确识别被研究对象。若发现许可证、归属或商标说明有误，请通过仓库 Issue 提交具体文件与来源。

[上一节](verification.md) · [下一节](../00-start-here.md)
