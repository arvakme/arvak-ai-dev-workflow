# arvak-ai-dev-workflow

Pi 包入口是仓库根 `package.json`：`pi.extensions` → Butler UI + provider/index.ts，`pi.skills` → `packages/skills`。

本机通过 `~/.pi/agent/settings.json` 的 `packages` 绝对路径加载工作副本（不要写相对路径）；该 settings 文件经 `.pi` 软链读取 `~/.config/agent-stuff/config/local/pi-coding/settings.json`。运行配置仍由 `getAgentDir()` 定位，不因源码目录迁移而改成任意 `.config` 扫描。还在改源码，不要 `pi install git:`。

- 改 Butler UI preset：改 `~/.pi/agent/extensions/butler-ui/config.jsonc`
- 改工具行 / 状态栏 / Butler 挂件：读 `packages/butler-ui/AGENTS.md`
- 改 BCU：读 `packages/better-computer-use/README.md`
- architecture-wiki 事实源是 `https://github.com/arvakme/architecture-wiki`（默认 2D，3D 可选），不要从 Suge8 覆盖
- Agent 调度用 Seedmux 自带 `seedmux-team` skill 和 `~/.seedmux/bin/smx-team`；不在本仓库复制官方 skill。所有子代理和审查者必须由 Seedmux 创建；禁止 Butler UI 自建子会话、Worker 池或另一个主控。Master 职责属于 Seedmux 中的当前主控 pane。
- 项目目标、依赖、决策和验收关系用 Agora 白板，先读 `project-flow`，画布操作用 Agora 提供的 `canvas` skill。任务状态仍以项目指定 tracker 为准。
- architecture-wiki 用于代码架构可视化。
- 不要往这个仓库塞 Kitty / SketchyBar / zsh，那些在 `~/.config`
- 不要把 `packages/pi-config/SYSTEM.md` 覆盖到 `~/.pi/agent/SYSTEM.md`
- 不要 `git merge upstream/main` 整包合回来
- 整目录覆盖的 sync-sources / npm run sync 已移除；上游修改按文件审查和移植

```bash
bun run test
npm run test:bcu
```
