# arvak-ai-dev-workflow

arvak 的开发工作流：**Agora 白板梳理项目 → Seedmux 调度 Agents → Pi / 原生 CLI 实现与验证**。Butler UI 提供 Pi 界面与 Butler 终端挂件，BCU 提供桌面操作，Skills 连接工作方法。

终端、窗管、SketchyBar 在 [`~/.config`](https://github.com/arvakme/dotfiles)（Kitty + AeroSpace），不在这个仓库。不要装 Ghostty / Starship，也不要跑上游 `SETUP.md`。

## 用法

```bash
pi install /Users/zhijie/Devs/workstation
```

仓库根 `package.json` 声明了 `pi.extensions`（Butler UI 与独立的 provider 入口）和 `pi.skills`。运行配置在 `~/.pi/agent/extensions/butler-ui/config.jsonc`。本机 `~/.pi/agent/settings.json` 经软链读取 `~/.config/agent-stuff/config/local/pi-coding/settings.json`；其中 `packages` 应写工作副本的绝对路径。Pi 自己的模型/密钥从其 Agent 目录加载，不进这个仓库。不要把 `packages/pi-config/SYSTEM.md` 覆盖到本机 `SYSTEM.md`。通知走 Moshi，这个仓库没有 Bark。

BCU 需要原生 helper，见 `packages/better-computer-use/README.md`。

`project-flow` skill 负责把目标、依赖、未决问题和验收条件整理到 Agora，再按授权交给 Seedmux。它复用两个外部 skill：Seedmux 提供 `seedmux-team`，Agora 提供 `canvas`；本仓库不复制它们的 CLI 操作说明。画布和 Seedmux 回执作为项目 tracker 的上下文与证据，不另建任务状态。所有子代理与独立审查者都由 Seedmux 创建，主控就是当前负责集成与验收的 Seedmux pane。独立审查使用 `seedmux-review`。

Butler 默认悬浮在 Pi 右上角，空闲时浮动、眨眼，工作时有环绕动效。全屏模式可上下左右拖动，`/butler hide|show|top-right|top-left|center` 控制显示和位置。`butler` 主题将界面统一为冰蓝、青色与深蓝，保留暖色警告；在 Pi 设置中选择。Agent 调度始终留在 Seedmux。

## 和上游的关系

`upstream` 是 [Suge8/my-agent-workstation](https://github.com/Suge8/my-agent-workstation)。这边拆掉的是终端模板，不是 BCU / Skills。

`architecture-wiki` 的事实源是 [arvakme/architecture-wiki](https://github.com/arvakme/architecture-wiki)：默认 2D 等距，要 3D 或两种都要时跟 agent 说。不要从 Suge8 整包 sync 这一份。项目流程放在 Agora 共享白板。

上游变更按具体文件评审、移植，不做整仓 merge。旧 `sync-sources` 脚本与 `npm run sync` 入口已移除，避免覆盖本地实现。旧路径的补丁需要先映射到 `packages/butler-ui/`。

旧配置会在新配置缺失时按原字节迁移；两份存在且不同时明确提示并保留双方，详见 [Butler UI 迁移说明](packages/butler-ui/docs/migration.md)。

Butler 的原始 2D 造型、空闲动画与参考渲染收藏于 [assets/butler](assets/butler)；渲染图仅作造型参考，终端仍使用像素版。
