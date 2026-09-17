# FireCode

FireCode 提供 Pi 的终端界面、会话预设、请求配置和 Butler 终端挂件。多 Agent 执行与独立审查统一使用 Seedmux；项目关系用 Agora 梳理。

经仓库根 `package.json` 安装本地 Pi package：

```bash
pi install ~/Devs/workstation
```

运行配置是 `~/.pi/agent/extensions/firecode/config.jsonc`，模板见 `config.example.jsonc`。缺少配置时关闭可选功能并提示；模板本身不会被运行读取。预设模型统一写 `provider/model/thinking`。通知走 Moshi，`claudeSub` 默认关闭。

`features.pet` 在右上角显示常驻像素 Butler，空闲时浮动眨眼。`/butler hide|show|top-right|top-left|center` 控制显示与位置，全屏模式可上下左右拖动；双击小人收成右上角的 `◈`，单击 `◈` 恢复原位置。收起时暂停动画，工作状态仍可见。改配置后重载 Pi。独立审查用工作站的 `seedmux-review` skill，派发与回执用 Seedmux 官方 `seedmux-team`。

开发验证：在仓库根运行 `bun run test`。测试 loader 用 `PI_PACKAGES_DIR` 指向 pi-mono 的 `packages/`，开发版 Pi 在 PATH 时可自动定位。
