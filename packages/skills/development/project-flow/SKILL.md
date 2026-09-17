---
name: project-flow
description: 用 Agora 梳理项目目标、依赖和决策，并衔接 Seedmux 执行；用户要整理项目流程或从白板计划转入派发时使用。
---

# 项目流程：Agora → Seedmux → 验证

Agora 白板承载共享理解，Seedmux 管理真实 Agent pane，Pi 或各原生 CLI 完成工作。项目指定的 tracker 保持任务状态权威；白板节点与 Seedmux 回执引用任务及证据，不各维护一份完成状态。

## 先读现场

- 读目标项目的 AGENTS.md，核对当前 checkout、已有改动和 tracker 约定。
- 操作白板前，加载 Agora 提供的 `canvas` skill；用 `canvas status` 核对服务和 room。用户已有页面时先用 `canvas --room <slug> brief <pageId>`，保留已决定事项和节点身份。`main` 是默认 room，不等于目标项目。
- 用户给的是 canvas session ID 时，用 `canvas session <id> --json` 读取共享上下文；它不同于 Pi session ID 或 Seedmux pane ID。
- 派发前，加载 Seedmux 提供的 `seedmux-team` skill。只到需要派发、续派或回收结果时再读对应操作说明。

`canvas`、`seedmux-team` 的技能与 CLI 由各自应用维护。技能未发现时检查全局 skills 的安装或断链，CLI 语法以实际 `--help` 为准；接入缺失时说明具体缺口，不编造工具或已完成的白板更新。

## 把问题整理到白板

按项目需要表达目标、当前事实、未决问题、可独立验证的交付项与依赖。已有页面做局部更新；重构整张图前先读评论和决策。节点关联已有 Issue、代码路径或验证证据，让讨论能回到依据。

讨论中的方案保留为待决定事项。用户尚在思考的方案不自动变成实现任务。只有影响当前决策的缺口才追问，其余说明可逆假设后继续整理。

## 从计划进入执行

用户已授权执行时，将边界明确的工作交给 Seedmux；小任务由当前 Agent 直接完成，无需白板或多 agent。复用或新建 pane、任务文件、允许路径、验收方式和回执均按 `seedmux-team` 执行，所有子代理都只由 Seedmux 创建；主控职责由当前 Seedmux pane 承担。

并行写入、独立审查或集成前读取 [工作目录与交付证据](references/delivery.md)，确定各任务的隔离目录、输入版本与交付阶段。scope 不能代替工作目录隔离。

给执行者带上项目路径、相关 Issue、白板 room/page 或 session ID、已定决策和验收条件。不要把整个白板、全部会话历史重复塞进每张工单。

## 回收结果

读取回执及与验收有关的证据，核对实际改动和验证结果。通过检查与需求已满足分别判断；派发成功、pane 空闲、Agent 说完成都不能单独代表验收。

将新决策、仍未解除的依赖和验证证据回写到授权的白板位置，并按项目规则更新 tracker。修改图形后按 `canvas` skill 截图查看；没有可用浏览器 executor 时如实说明未完成视觉验证。提交、推送和发布遵守用户授权及项目自身规则。
