---
description: 用 tldraw Desktop 画或改流程图
argument-hint: "[画什么]"
---
读并使用 tldraw-offline skill，在本机 tldraw Desktop 上画或改。

默认当流程图：方块节点、`helpers.createArrowBetweenShapes` 绑定箭头、`helpers.getLints()`、本地文档 `helpers.saveDoc()`。应用没开就停，让用户打开 tldraw-offline。不要手写 `.tldraw` 文件。

${@:-按用户这句在当前或新建画布上画流程图}
