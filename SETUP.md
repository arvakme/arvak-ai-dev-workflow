# 这台机器上的用法

本仓库是 arvak 的 Pi 工作流，不是上游那份「整机发行版」。

已经有的不要再装：

- 终端：Kitty + zsh + oh-my-posh，配置在 `~/.config`
- 窗管 / 状态栏：AeroSpace + SketchyBar
- 不要 brew Ghostty / Starship / Maple Mono，也不要复制任何 `config/terminal`（这个仓库里已经没有）
- 不要把 `packages/pi-config/SYSTEM.md` 覆盖到 `~/.pi/agent/SYSTEM.md`

## Pi package

```bash
pi install ~/Devs/workstation
pi install npm:pi-antigravity
```

`pi list` 里应能看到本仓库目录和 `pi-antigravity`。

FireCode 运行配置：`~/.pi/agent/extensions/firecode/config.jsonc`，模板是 `packages/firecode/config.example.jsonc`。通知走本机 Moshi（Pi / Cursor / Grok 都已 hook），仓库不含 Bark。

## Seedmux 与 Agora

Seedmux 提供 `~/.seedmux/bin/smx-team` 和 `~/.agents/skills/seedmux-team`；Pi 会自动发现后者。先用 `smx-team panes --json` 核对现场，再按 `seedmux-team` skill 派发。此检查不会创建 Agent。

Agora 提供 `canvas` CLI 与 `canvas/skills/canvas`。从实际维护 Agora 画布的 checkout 运行 `canvas/scripts/install-skills.sh` 链接官方 skill；若旧目录被移走，检查所有 agent 的链接及 Pi 目录内部的 `SKILL.md` 链接。安装器会跳过已有真实目录，需要单独处理其中的断链。

用 `canvas status` 确认服务和 room；白板修改前显式选择项目 room。已有页面先 `canvas --room <slug> brief <pageId>` 读取上下文。各 agent 共用这份技能，项目流程由本仓库的 `project-flow` 串联。

Seedmux 的默认全权配置由 `scripts/configure-seedmux.py` 管理（Python 3.11+），先预览再应用：

```bash
python3.11 scripts/configure-seedmux.py
python3.11 scripts/configure-seedmux.py --apply
```

它启用 Seedmux 支持的六种 Agent 的 YOLO 开关，并设置 Codex 的持久权限默认值，覆盖 `smx-team` 和恢复会话省略全权参数的路径；保留其余配置并生成备份。不改应用生成的 shim。运行中的 Agent 保持旧权限，新启动/恢复时才读取；显式 CLI 参数仍优先。目录 trust 与执行权限是不同检查，派发必须传真实绝对 cwd，并由官方 `smx-team` 预置信任。已停在权限弹窗的 pane 先恢复到输入态，不能把消息直接注入弹窗。

NONO 随 FireCode 加载，`features.pet` 控制开关；重载 Pi 后在输入框上方常驻。`/nono` 可显示或定位，无需安装额外应用。

## BCU

```bash
cd ~/Devs/workstation/packages/better-computer-use
npm install --ignore-scripts && npm run build
npm install --global --ignore-scripts "./$(npm pack --silent)"
node "$(npm root -g)/better-computer-use/scripts/setup-helper.mjs" --runtime
bcu setup
bcu doctor
```

`bcu setup` 会要求给 `bcu.app` 开辅助功能和屏幕录制。

## 浏览器自动化（按需）

上游用隔离的 cloakbrowser，不要去动日常 Helium / Chrome 的 Cookie。需要时再装，路径别写进 Kitty / zsh rice。
