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
