---
status: accepted
---

# 模型和思考档作为一个配置值

Butler UI 预设用 `provider/model/thinking` 表达模型选择，避免模型与思考档拆开配置后分别生效。切换模型失败时不能单独改变思考档。

不接受旧的分字段或两段式写法：兼容多种形状会扩大校验与维护面。错误信息直接指出所需形状。Seedmux 调度的 Agent 模型不属于 Butler UI 配置。
