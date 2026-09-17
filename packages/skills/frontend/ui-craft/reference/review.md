# 界面审查

## 按审查范围验证

- 验收基线是 WCAG 2.2 AA；优先使用 button、input、nav、dialog 等语义元素，复杂组件遵循 WAI-ARIA APG。
- ARIA 属性必须配套键盘、焦点和状态行为。
- 自动检查之外，使用纯键盘走完整路径，并在实际 pointer 与 touch 设备上验证对应 profile。
- 截图只验证静态对齐；动效必须录制或用浏览器 Animation/Performance 工具逐帧检查起点、终点、反向和掉帧。
- 在数据加载、滚动和连续操作同时发生时复测；确认没有每帧全页 layout/paint、图层爆增或主线程长任务，不能只验空闲 Demo。
- 动效验证包含快速重复操作、中途反向、低性能设备和 reduced-motion。

## 审查输出

只覆盖本次要求审查的范围；按发现的问题分组输出 Before / After；没有证据的问题不列。优先修 token 和共享组件，不逐实例打补丁。

- 每条发现标一个严重度：`HIGH` 阻断任务、误导用户、隐藏内容或控件；`MEDIUM` 明显损害理解、效率或一致性；`LOW` 局部打磨。同一根因合并为一条，列出全部发生位置。
- 一次审查最多 15 条；发现少是合法结果，不凑数。
- 只有影响决策的取舍才说明否决理由，不为填满报告编造候选。
- 验证分两栏：已验证（写出命令或操作与观察结果）和未验证（写出原因）。验证缺口不得写成发现。
- 结论只能是三中之一：有 `HIGH` 则 `Block`；只剩 `MEDIUM`/`LOW` 则 `Needs changes`；无待办且覆盖已验证才是 `Approve`。
- 审查默认只读；用户没要求实现时不改源码。

- [ ] 已读取现有设计系统，并明确 input mode 与 density profile
- [ ] Button、Input、Select 高度一致；桌面未套用触屏命中区；触屏达到 44/48
- [ ] 字号、图标、padding 和 row height 来自同一密度 token
- [ ] 首个视口能确认当前位置、主要状态和下一步；主任务与主操作层级唯一清晰
- [ ] 无重复眉题、同义标题/描述、显而易见 helper 或多处同一 CTA；保留项都提供新信息
- [ ] 去重后文档 title、landmark、Heading、Label、Tab/Panel 关联和读屏名称仍完整
- [ ] Placeholder 未重复或替代 Label；关键后果、错误和可修复反馈没有藏进 Tooltip/Toast
- [ ] 控件已有终态时不重复通知；字段、表单和系统错误分别留在对应上下文
- [ ] 分割线、Card、Sticky、Empty state 都由内容语义决定，没有插件模板外溢
- [ ] 阴影与描边分工明确；shadow-border 有暗色与 `forced-colors` 退路；容器能承受最长文本
- [ ] 图标描边匹配相邻文字字重，状态由 `currentColor` 驱动，outline/fill 成对使用
- [ ] 每个控件状态完整；幂等操作、列表定位、Chat 跟随使用事件驱动
- [ ] 默认反馈克制；Enter/Exit 同路径；easing、时长和频率匹配使用场景
- [ ] 按下缩放按控件尺寸分档；stagger 只用于低频分段入场且总时长可接受
- [ ] Spring 参数来自一套 token；共享状态、几何、锚点和固定占位形成连续空间关系
- [ ] 标志性 Card、Draw、Wiggle、Pop 只用于明确组件，没有压过内容与主任务
- [ ] 无 `transition: all`、动画终态跳变、通用 `.group:hover` 污染或被覆盖的动效参数
- [ ] Focus、键盘、touch、目标尺寸、reduced-motion 和负载下性能验证通过
