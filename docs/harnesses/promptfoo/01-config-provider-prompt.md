# Promptfoo 配置与 Provider：先解析身份，再生成请求

[上一节](README.md) · [下一节](02-test-case-runtime.md)

## 本篇要解决什么问题

看到 `providers: [openai:gpt-4o-mini]` 时，你可能以为 Evaluator 拿这个字符串直接调 SDK 就行，但实际代码还得识别短名、带 config 的对象、JavaScript 函数、模块文件和多 Provider（提供方）配置。prompt 自己可以带标签、模板和配置，测试还能换掉默认 Provider。如果不先把这些写法归一，执行层就得到处判断输入类型，也很难准确记下这次究竟调了谁。这一篇就来看 Provider 如何解析，prompt、provider 和 test 又是在哪里组合起来的。

源码版本锁定之后，你可以逐段核对每条解析路径，但这一篇不会穷举 Promptfoo 支持的所有 Provider。同一个短名将来可能指向另一种实现，所以核对时要同时看锁定 commit，以及解析后的 `id()`、配置和输入，不能只看那个短名。

## 先建立源码地图

| 源码位置 | 作用 | 阅读问题 |
| --- | --- | --- |
| [`src/providers/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/providers/index.ts#L83-L121) | `loadApiProvider`、`resolveProvider`、`loadApiProviders` | 输入形式怎样变成 ApiProvider |
| [`src/evaluator.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator.ts) | 合并 prompt 配置、生成 RunEvalOptions | 解析对象怎样进入运行矩阵 |
| [`src/types/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/types/index.ts) | TestSuite、RunEvalOptions、EvaluateResult 等契约 | 哪些字段跨越层级 |

## 完整调用链

![Promptfoo Provider 解析与矩阵生成](../../assets/diagrams/harnesses/promptfoo/config-provider.svg)

1. `loadApiProviders` 接受单个或多个 Provider 引用。已经满足 ApiProvider 契约的对象可直接使用；函数被包装为 `callApi`；字符串和配置对象进入 `loadApiProvider`。
2. 路径型配置可导出一个或多个 Provider。单 Provider 入口若读到多个 Provider 会明确报错，避免调用者误以为只选择了第一个。
3. 解析阶段合并 basePath、环境、Provider options、label、transform、delay 与 inputs。带模板的动态配置保留到实际 `callApi()` 上下文再渲染，而不是在全局加载时过早求值。
4. Evaluator 先构建 tests，再对每个 test 计算变量组合；随后按 prompt 和 provider 逐层附加 `RunEvalOptions`。测试级 Provider override 可以替换套件默认 Provider。
5. `createRunEvalOption` 固定 testIdx、promptIdx、具体 `ApiProvider`、具体 `Prompt`、vars、timeout 和运行控制项。到这里，一个配置矩阵才变成可调度步骤。
6. 单步运行时把 Provider 配置与 prompt config 合并为调用上下文，渲染模板后调用 `provider.callApi(renderedPrompt, context, options)`，并把返回值标准化为结果行。

## 关键数据结构

`ApiProvider` 关心的不只是厂商名称，还要给出稳定身份和调用能力。它用 `id()` 标明结果归谁，用 `callApi()` 圈出目标调用边界，再用 label/config/transform/delay/inputs 说明额外行为。`Prompt` 会把 raw、label 和 config 一起留下，否则报告里只有一大段模板，你根本分不清它属于哪个候选。`TestSuite` 收着尚未展开的配置，`AtomicTestCase` 则是合并 default/scenario 后的测试，直到 `RunEvalOptions` 出现，程序才真正得到某个 provider × prompt × test × vars 的执行单位。

想复现这次运行，清单里至少要记下锁定 commit、解析后的 Provider ID 与 label、非敏感配置摘要、prompt 摘要、变量值、测试断言、输入文件摘要和运行选项。环境变量里若有密钥，只记它的名称或来源，别把密钥本身写进证据包。

## 实现取舍与失败语义

输入既可以是简单 YAML，也可以一路扩展到自定义函数，用起来很灵活，但配置解析也因此进入了可信计算范围。如果一个文件导出多个 Provider，解析器会拒绝暗中挑选，直接报错，以此保证你能预料它会调谁。动态配置则等到真正调用时才渲染，因为只有那时才拿得到 per-test 变量。于是，两个 Provider 加载时看起来一样，各自测试真正发出的请求却可能不同。

如果 Provider 没能解析，说明装配就出了错，系统应该在调用目标前就报出来。`callApi` 返回 error，说明错误落在 Provider 调用这条路径上，不能单凭这个字段断定目标已经真正执行。transform 或 prompt 渲染失败，问题则在输入或适配层。这三种情况要是都被压成 `success: false`，用户便无法判断应该修哪一层。还要注意，缓存命中只是在说这次执行的结果从哪里来，它没有新增一条独立观察。

## 动手实验

设计三个逻辑相同的 Provider，分别用短名、内联函数和模块文件来实现，再写出它们各自的 identity 字段，说明为什么只留展示 label 无法复现。随后加入一个 test 级 Provider override，画出它与 suite 默认 Provider 谁优先，最后给 prompt 配置加入 `temperature`，并指出程序应该在哪一层合并它、又该怎样把它写进审计信息。

离线核对命令：

```bash
python scripts/sources.py verify
python -m pytest tests/test_harness_course_docs.py -q
```

## 预期输出与答案

短名至少要留下解析后的实现 ID 和配置，函数要留下模块或代码摘要以及稳定 label，文件则要留下规范化相对路径、文件摘要和导出对象 ID。展示 label 可能重复，也可能被用户修改，所以它不能单独证明身份。测试级 override 只会改变该测试生成的步骤，其他测试仍然调用 suite providers。创建调用上下文时，程序应该按明确优先级合并 prompt config 与 Provider/prompt 配置，再把非敏感快照随结果或运行清单一起保存。

如果一个文件导出了多个 Provider，你却用单 Provider API 去加载，程序应该给出明确错误，不能暗中挑选其中一个。如果配置里有每个测试自己的模板变量，就等运行到当前测试时，再根据当时的 vars 渲染。

## 如何核对

先在 [`src/providers/index.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/providers/index.ts#L370-L409) 从 `loadApiProviders` 追到 `loadApiProvider`，观察函数包装、对象直通、文件配置和多导出拒绝逻辑，然后再到 [`src/evaluator.ts`](https://github.com/promptfoo/promptfoo/blob/ce89186a22c59543f4f71a55d42442ff3f0e3654/src/evaluator.ts#L2577-L2616) 追 `appendRunEvalOptionsForTestCase`、`appendRunEvalOptionsForVars`、`appendRunEvalOptionsForProvider` 和 `createRunEvalOption`。

## 本篇不能证明什么

即便 Provider 已经加载成功，你仍然不知道凭据是否有效、模型版本是否固定、外部 API 能否访问，也无法确认服务端真的按所声明的参数执行了请求。配置摘要替代不了完整的供应链锁定，自定义函数是否安全、沙箱是否圈住了它，也都要另外审计。

[上一节](README.md) · [下一节](02-test-case-runtime.md)
