# arvak-ai-dev-workflow

arvak 的开发工作流：**Agora 白板梳理项目 → Seedmux 调度 Agents → Pi / 原生 CLI 实现与验证**。FireCode 提供 Pi 界面与 NONO 终端挂件，BCU 提供桌面操作，Skills 连接工作方法。

终端、窗管、SketchyBar 在 [`~/.config`](https://github.com/arvakme/dotfiles)（Kitty + AeroSpace），不在这个仓库。不要装 Ghostty / Starship，也不要跑上游 `SETUP.md`。

## 用法

```bash
pi install ~/Devs/workstation
```

仓库根 `package.json` 声明了 `pi.extensions`（FireCode）和 `pi.skills`。运行配置在 `~/.pi/agent/extensions/firecode/config.jsonc`。Pi 自己的模型/密钥在 `~/.pi/agent/`，不进这个仓库。不要把 `packages/pi-config/SYSTEM.md` 覆盖到本机 `SYSTEM.md`。通知走 Moshi，这个仓库没有 Bark。

BCU 需要原生 helper，见 `packages/better-computer-use/README.md`。

`project-flow` skill 负责把目标、依赖、未决问题和验收条件整理到 Agora，再按授权交给 Seedmux。它复用两个外部 skill：Seedmux 提供 `seedmux-team`，Agora 提供 `canvas`；本仓库不复制它们的 CLI 操作说明。画布和 Seedmux 回执作为项目 tracker 的上下文与证据，不另建任务状态。所有子代理与独立审查者都由 Seedmux 创建，主控就是当前负责集成与验收的 Seedmux pane。独立审查使用 `seedmux-review`。

NONO 是 Pi 输入框上方的常驻像素小挂件，空闲时浮动、眨眼，工作时有环绕动效。`/nono hide|show|left|center|right` 控制显示和位置；支持鼠标的 Pi 终端模式可左右拖动。Agent 调度始终留在 Seedmux。

## 和上游的关系

`upstream` 是 [Suge8/my-agent-workstation](https://github.com/Suge8/my-agent-workstation)。这边拆掉的是终端模板，不是 BCU / Skills。

`architecture-wiki` 的事实源是 [arvakme/architecture-wiki](https://github.com/arvakme/architecture-wiki)：默认 2D 等距，要 3D 或两种都要时跟 agent 说。不要从 Suge8 整包 sync 这一份。项目流程放在 Agora 共享白板；明确要求 tldraw Desktop 或 `.tldraw` 文件时走 `/tldraw-offline`。

要偷上游某段，按需 cherry-pick，不要整仓 merge。`npm run sync` 会从本机维护源整目录覆盖 `packages/firecode` 和 `packages/skills`，本地改过就别跑。

```bash
git fetch upstream
# 按需：git checkout upstream/main -- packages/firecode/某文件
```
