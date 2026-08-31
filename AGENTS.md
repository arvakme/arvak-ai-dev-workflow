# workstation

Pi 包入口是仓库根 `package.json` 的 `pi.extensions`，只指向 `packages/firecode`。

- 改工具行 / 状态栏 / master：读 `packages/firecode/AGENTS.md`
- 不要往这个仓库塞 Kitty / SketchyBar / zsh，那些在 `~/.config`
- 不要把作者的 SYSTEM.md 覆盖到 `~/.pi/agent/SYSTEM.md`
- 不要 `git merge upstream/main` 整包合回来

```bash
bun run test
```
