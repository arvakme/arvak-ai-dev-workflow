# arvak-ai-dev-workflow

Pi 包入口是仓库根 `package.json`：`pi.extensions` → FireCode，`pi.skills` → `packages/skills`。

本机活指针是 `~/.pi/agent/settings.json` 的 `packages`：`/Users/zhijie/Devs/workstation`（绝对路径，不要写成相对 `../../Devs/workstation`）。运行配置在 `~/.pi/agent/`（FireCode 活配置 `extensions/firecode/config.jsonc`），不进这个仓库；本机 `~/.pi/agent` 的入口通过软链读取 `~/.config/agent-stuff` 中的配置源。还在改源码，不要 `pi install git:`。

- 改 FireCode preset：改 `~/.pi/agent/extensions/firecode/config.jsonc`
- 改工具行 / 状态栏 / Butler 挂件：读 `packages/firecode/AGENTS.md`
- 改 BCU：读 `packages/better-computer-use/README.md`
- architecture-wiki 事实源是 `https://github.com/arvakme/architecture-wiki`（默认 2D，3D 可选），不要从 Suge8 覆盖
- Agent 调度用 Seedmux 自带 `seedmux-team` skill 和 `~/.seedmux/bin/smx-team`；不在本仓库复制官方 skill。所有子代理和审查者必须由 Seedmux 创建；禁止 FireCode 自建子会话、Worker 池或另一个主控。Master 职责属于 Seedmux 中的当前主控 pane。
- 项目目标、依赖、决策和验收关系用 Agora 白板，先读 `project-flow`，画布操作用 Agora 提供的 `canvas` skill。任务状态仍以项目指定 tracker 为准。
- architecture-wiki 用于代码架构可视化。
- 不要往这个仓库塞 Kitty / SketchyBar / zsh，那些在 `~/.config`
- 不要把 `packages/pi-config/SYSTEM.md` 覆盖到 `~/.pi/agent/SYSTEM.md`
- 不要 `git merge upstream/main` 整包合回来
- `npm run sync` 会整目录覆盖 firecode/skills，本地改过就别跑

```bash
bun run test
npm run test:bcu
```
