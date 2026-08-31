# arvak-ai-dev-workflow

Pi 包入口是仓库根 `package.json`：`pi.extensions` → FireCode，`pi.skills` → `packages/skills`。

- 改工具行 / 状态栏 / master：读 `packages/firecode/AGENTS.md`
- 改 BCU：读 `packages/better-computer-use/README.md`
- architecture-wiki 事实源是 `https://github.com/arvakme/architecture-wiki`（默认 2D，3D 可选），不要从 Suge8 覆盖
- 不要往这个仓库塞 Kitty / SketchyBar / zsh，那些在 `~/.config`
- 不要把 `packages/pi-config/SYSTEM.md` 覆盖到 `~/.pi/agent/SYSTEM.md`
- 不要 `git merge upstream/main` 整包合回来
- `npm run sync` 会整目录覆盖 firecode/skills，本地改过就别跑

```bash
bun run test
npm run test:bcu
```
