# 来源与许可证边界

[上一节](verification.md) · [下一节](../00-start-here.md)

原创代码与文档分开授权——前者采用 MIT 许可证，后者采用 Creative Commons Attribution 4.0（CC BY 4.0）。上游项目的源码、名称、商标、论文与截图仍受各自许可证和权利边界约束，本仓库也不代表任何上游项目的官方实现或背书。

## 来源锁定

- `sources/sources.yml`：项目、课程用途、许可证、允许研究的源码范围；
- `sources/sources.lock.yml`：40 位 commit 与精确 scope paths；
- `THIRD_PARTY.md`：面向读者的第三方来源清单；
- `NOTICE.md`：原创与第三方材料的归属说明。

上游仓库只会按需检出到 Git 忽略目录，不会复制进本仓库历史，而正文也只链接锁定 commit 下的 scope 文件。课程里的伪代码、流程图和 Reference Harness 属于原创教学简化，不会冒充上游源码。

## 证据等级

正文会区分上游源码事实、跨调用点机制解释、教学简化、外部公开契约和不可核对内容。读者引用结论时应当同时保留课程所用 commit，因为上游一旦发生变化，就需要针对新 commit 重新核对，不能把旧教材里的结论直接外推。

## 商标与品牌

Eval Harness 源码内核使用独立品牌，也不会拼接上游 Logo，而项目名只用于准确识别被研究对象。如果许可证、归属或商标说明有误，请通过仓库 Issue 提交对应文件和来源。

[上一节](verification.md) · [下一节](../00-start-here.md)
