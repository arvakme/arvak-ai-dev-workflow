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
```

`pi list` 里应能看到本仓库目录。本机 settings 入口是 `~/.pi/agent/settings.json`，经软链加载 `~/.config/agent-stuff/config/local/pi-coding/settings.json`；`packages` 使用当前工作副本的绝对路径，避免相对路径随工作目录改变。

Pi 内不安装 Antigravity / Cursor 的代理扩展；这些 CLI 由 Seedmux 调度。模型目录使用 Pi 的 `pi update --models` 刷新，个人模型覆盖与凭据留在本机。

Butler UI 运行配置：`~/.pi/agent/extensions/butler-ui/config.jsonc`，模板是 `packages/butler-ui/config.example.jsonc`。首次加载会在新路径缺失时保留原字节迁移 `extensions/firecode/config.jsonc`，不删除旧文件；两份不同会提示且优先新路径，详见 [迁移说明](packages/butler-ui/docs/migration.md)。UI 入口 `index.ts` 和 provider 入口 `provider/index.ts` 由包清单分别加载，不要再单独添加旧入口。通知走本机 Moshi（Pi / Cursor / Grok 都已 hook），仓库不含 Bark。

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

Devin / Cursor 的 CLI 接入由 `scripts/configure-seedmux-agents.py` 管理；默认预览，`--apply` 应用。默认模板源为 `config/seedmux/agents.json`，应用时仅在缺失时初始化 `~/.config/agent-stuff/config/local/seedmux/agents.json`，已有用户值不会被覆盖。wrapper 每次 spawn 读取外置配置，其中 `cmd`、`args`、`model_flag`、`prompt_flag` 可自行编辑；`cursor` 是 `cursor-agent` 的别名。它复用官方 pane 桥接，不扩展原生菜单；运行与恢复权限按各 CLI 的启动参数分别设置，不能靠新增一个未支持的 `*_yolo` 配置键接入 Agent。运行 `smx-team --doctor` 可只读检查接入状态，不会创建 Agent。

Butler 随 Butler UI 加载，`features.pet` 控制开关；重载 Pi 后在右上角常驻。全屏模式可鼠标拖动，`/butler` 可显示或定位，无需安装额外应用。Pi 设置中的 `butler` 主题与挂件配色一致。

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
