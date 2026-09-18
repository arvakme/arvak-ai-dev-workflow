# Butler UI

Pi 定制层：终端界面、预设、请求配置和 Butler 终端挂件。所有 Agent（含独立审查者）只能由 Seedmux 的 `seedmux-team` skill 调度；本扩展不得创建子会话、Worker 池或后台主控。

这是本工作站的工作副本。整目录同步入口已移除；上游变更按文件移植。

`index.ts` 按 `config.features` 仅注册 UI/会话功能；`provider/index.ts` 独立注册供应商/认证请求钩子。两个入口只由包清单各声明一次。状态只归所属模块；`session/pet.ts` 通过不抢焦点的 overlay 渲染 Butler（零高度 widget 仅负责释放资源），`session/butler-frames.ts` 提供像素帧。只读取本会话生命周期，位置按 Pi custom entry 保存；不创建状态目录或桌面进程。

- `session/`：预设、命名、统计、显示投影和 Butler，见 [session/AGENTS.md](session/AGENTS.md)。
- `statusbar/`：Claude 风格的三行模型、上下文、已用额度、速度与会话 ID，见 [statusbar/AGENTS.md](statusbar/AGENTS.md)。
- `tools/`：默认工具渲染。不要包装 grep/find/ls，Pi 注册即激活，会改变用户工具集。
- `provider/`：Anthropic OAuth 归因及 OpenAI/xAI 请求配置。

带背景卡片的单行截断用 `format.ts` 的 `clip`。Pi 的 `TruncatedText`/`truncateToWidth` 省略号会全量重置 ANSI，破坏外层背景色。

`tools/grouping.ts` 依赖 Pi 内部组件树与原型 patch，升级宿主优先验证这里。

唯一运行配置由 `getAgentDir()` 解析：`extensions/butler-ui/config.jsonc`。旧 `extensions/firecode/config.jsonc` 仅在新文件缺失时迁移，保留原文件并报告冲突，见 [迁移说明](docs/migration.md)。模板不参与运行读取；缺配置关闭可选功能并在会话启动警告。模型原子统一为 `provider/model/thinking`，不要重新引入拆字段兼容层。快捷键启动时绑定，改配置需重载 Pi。

测试见根 `package.json`；`tests/loader.ts` 优先通过 PATH 的 `pi` 定位安装版宿主，也支持显式 `PI_PACKAGES_DIR` 源码宿主，并把运行源码复制到临时目录以隔离配置。

`themes/butler.json` 是 Pi 标准主题，包清单负责发现，用户设置负责选择；扩展不强行重设主题。冰蓝与青色沿用 Butler，警告与错误保留暖色以区分语义。
