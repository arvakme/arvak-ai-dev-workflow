# FireCode

Pi 定制层：终端界面、预设、请求配置和 NONO 终端挂件。所有 Agent（含独立审查者）只能由 Seedmux 的 `seedmux-team` skill 调度；本扩展不得创建子会话、Worker 池或后台主控。

这是本工作站的工作副本。`npm run sync` 会整目录覆盖本地实现，不要运行。

`index.ts` 按 `config.features` 注册独立功能。状态只归所属模块；`session/pet.ts` 通过不抢焦点的 overlay 渲染 NONO（零高度 widget 仅负责释放资源），`session/nono-frames.ts` 提供像素帧。只读取本会话生命周期，位置按 Pi custom entry 保存；不创建状态目录或桌面进程。

- `session/`：预设、命名、统计、显示投影和 NONO，见 [session/AGENTS.md](session/AGENTS.md)。
- `statusbar/`：身份、模型、额度与用量，见 [statusbar/AGENTS.md](statusbar/AGENTS.md)。
- `tools/`：默认工具渲染。不要包装 grep/find/ls，Pi 注册即激活，会改变用户工具集。
- `provider/`：Anthropic OAuth 归因及 OpenAI/xAI 请求配置。

带背景卡片的单行截断用 `format.ts` 的 `clip`。Pi 的 `TruncatedText`/`truncateToWidth` 省略号会全量重置 ANSI，破坏外层背景色。

`tools/grouping.ts` 依赖 Pi 内部组件树与原型 patch，升级宿主优先验证这里。

唯一运行配置由 `getAgentDir()` 解析：`extensions/firecode/config.jsonc`。模板不参与运行读取；缺配置关闭可选功能并在会话启动警告。模型原子统一为 `provider/model/thinking`，不要重新引入拆字段兼容层。快捷键启动时绑定，改配置需重载 Pi。

测试见根 `package.json`；`tests/loader.ts` 通过 `PI_PACKAGES_DIR` 定位宿主，并把运行源码复制到临时目录以隔离配置。

`themes/nono.json` 是 Pi 标准主题，包清单负责发现，用户设置负责选择；扩展不强行重设主题。冰蓝与青色沿用 NONO，警告与错误保留暖色以区分语义。
