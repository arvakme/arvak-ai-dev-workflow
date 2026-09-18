# session：会话层功能

预设、改名、`/tokens`、herdr 身份投影、Butler 挂件。各功能互不依赖，关掉任何一个不影响其余。通知走 Moshi，这里没有 Bark。

| 文件 | 职责 |
| --- | --- |
| `presets.ts` | 预设切换：模型原子、工具集、附加指令 |
| `rename.ts` | `/rename` 与 `keys.rename` 改会话名 |
| `herdr-display.ts` | 会话身份投影到 herdr 的 agent 副标题 |
| `stats.ts` | `/tokens` 扫会话 jsonl 统计 token 与成本（源自 pi-token-stats, MIT） |
| `pet.ts` | 右上角常驻 Butler 浮层、状态动效与二维拖动 |

预设的 `model` 是模型原子（`provider/model/thinking`），模型与思考档一起切换：模型切换失败时思考档也不动。
调 Pi 接口前才把 provider 与模型名拆开。

预设名写入会话记录，重开会话只恢复名字与附加指令，不重放模型和工具切换。

pet：只处理 TUI 会话生命周期；浮层按每行连续的非空像素分段，轮廓外不绘制也不拦截鼠标；固定复用这些分段的 handle，动画不得重建浮层抢到菜单上方。浮层不占消息流或输入框空间，零高度 widget 绑定宿主 dispose。只通过自己的 overlay handle 关闭，避免误关上层菜单。计时器随 dispose 清理，工作时取代 Working 行。二维相对位置保存于本会话 custom entry，缩放后仍在视口内；底部留三行给输入区，不传递对话内容。双击收成右上角单格青蓝色 ◉，单击恢复原位置；收起时暂停动画并恢复宿主 Working 提示。点击与拖动按完整按下/释放手势区分，拖动不参与双击计数。鼠标由全屏宿主派发，不自行切换终端鼠标模式；普通终端模式用 `/butler top-right|top-left|center` 定位。

## herdr-display

把 pi 单向投影到 herdr 的 agent 副标题：`pane.report_metadata` 的 `display_agent` 写 `pi·模型/思考等级`，
`title` 写会话名，同一请求的 `tokens.session` 再把会话名供给侧边栏行布局（herdr 侧边栏只消费自定义 token，
用户 herdr 配置的 pi 行布局引用 `$session`）。

workspace、pane label 与 tab label 都归 herdr 或用户管；FireCode 不写这些持久名称——tab 是多 pane
共享状态，而 herdr 没有条件 rename/CAS 与清除自定义名的接口，先检查再 rename 无法消除 split/move 竞态。

改名不从 `rename.ts` 接线，只听宿主的 `session_info_changed`（命令、快捷键、自动命名已在宿主收口），另听
model/thinking 选择。同一身份不重发，只有确认送达才记为已发布，请求串行避免乱序覆盖，失败静默并由下一
事件重试。非 TUI 模式（print/json/rpc）不投影：无头调用不能接管可见会话的显示。只有 `quit` 清空副标题，
reload/new/resume/fork 由新会话覆盖。

没有 feature 开关：herdr 之外（无 `HERDR_ENV`）自我禁用。
