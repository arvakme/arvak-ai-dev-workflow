# arvak-ai-dev-workflow

kazelis 的 Pi coding 工作流： **FireCode** + **BCU** + **Skills**。

终端、窗管、SketchyBar 在 [`~/.config`](https://github.com/arvakme/dotfiles)（Kitty + AeroSpace），不在这个仓库。不要装 Ghostty / Starship，也不要跑上游 `SETUP.md`。

## 用法

```bash
pi install ~/Devs/workstation
```

仓库根 `package.json` 声明了 `pi.extensions`（FireCode）和 `pi.skills`。运行配置在 `~/.pi/agent/extensions/firecode/config.jsonc`。Pi 自己的模型/密钥在 `~/.pi/agent/`，不进这个仓库。不要把 `packages/pi-config/SYSTEM.md` 覆盖到本机 `SYSTEM.md`。

BCU 需要原生 helper，见 `packages/better-computer-use/README.md`。

## 和上游的关系

`upstream` 是 [Suge8/my-agent-workstation](https://github.com/Suge8/my-agent-workstation)。这边拆掉的是终端模板，不是 BCU / Skills。

要偷上游某段，按需 cherry-pick，不要整仓 merge。`npm run sync` 会从本机维护源整目录覆盖 `packages/firecode` 和 `packages/skills`，本地改过就别跑。

```bash
git fetch upstream
# 按需：git checkout upstream/main -- packages/firecode/某文件
```
