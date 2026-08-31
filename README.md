# workstation

kazelis 的 Pi 工作站。只装一件事：**FireCode**（工具行、状态栏、预设、master / review / watch）。

终端、窗管、SketchyBar 在 [`~/.config`](https://github.com/arvakme/dotfiles)（Kitty + AeroSpace），不在这个仓库。不要跑上游 `SETUP.md`——那会装 Ghostty / Starship，把 rice 盖掉。

## 用法

```bash
pi install ~/Devs/workstation
```

运行配置在 `~/.pi/agent/extensions/firecode/config.jsonc`。改 FireCode 源码就改 `packages/firecode/`，重启 Pi 生效。Pi 自己的模型/密钥在 `~/.pi/agent/`，不进这个仓库。

## 和上游的关系

`upstream` 是 [Suge8/my-agent-workstation](https://github.com/Suge8/my-agent-workstation)。这边已经拆掉终端模板、BCU、那包 Skills 和 sync 快照流程。要偷上游 FireCode 某段，按需 cherry-pick，不要整仓 merge。

```bash
git fetch upstream
# 按需：git checkout upstream/main -- packages/firecode/某文件
```
