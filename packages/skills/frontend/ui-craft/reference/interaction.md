# 交互与反馈

## 4. 文案与交互语义

- 使用用户熟悉的名词和明确动词，采用 sentence case。短标签、单句描述和 Button 文案不加尾句号；错误信息说明问题和可执行的修复方法。
- Button 与链接优先写具体动作或目的，脱离相邻正文仍能理解；上下文已经唯一确定对象时，不重复对象名凑成完整句。
- 设置项的名称和描述写“打开后会发生什么”，不描述关闭态，也不写成双否定。
- 中英文案保持语义、阈值和数量一致；关键措辞用测试锁定。

### 信息减法与页面结构

任务涉及重复页眉、同义标题/描述、显而易见 helper、重复 CTA 或 UI 文案收紧时，先读取 [content-reduction.md](content-reduction.md)，再修改代码。每条保留文字必须提供新的定位、状态、指令、动作、后果或帮助；分别验证桌面、窄屏和读屏语义。

### 表单标注与反馈

任务涉及 Label、Placeholder、输入图标、helper/error、Tooltip、Toggle、Banner 或 Toast 的取舍时，先读取 [forms-and-feedback.md](forms-and-feedback.md)。以下是生产 UI 发布门，不按个人视觉偏好放宽；请求冲突时说明依据并实施最接近原意的安全替代：

- 认证、地址、付款和多字段表单保留持久可见 Label；删除同义 Placeholder，禁止用 Placeholder 或图标替代 Label。
- 错误、安全影响、不可逆后果和完成任务所需的信息禁止藏进 Tooltip 或仅用自动消失的 Toast。
- Toggle 等控件已有明确终态时不重复弹成功通知。

反馈放置默认（完整决策表见 reference）：

| 情况 | 位置 |
|---|---|
| 用户能在字段内修复的错误 | 字段旁，保持到修复，用 `aria-invalid` 和 `aria-describedby` 关联 |
| 登录等整组凭据失败 | 表单内 Alert，统一文案，不指明是账号还是密码错 |
| 用户改不了的系统或网络问题 | 区域 Banner 或表单内 Alert，不标红字段 |
| 无需处理的操作结果 | Toast 或 `role="status"` |

- 错误文案是指令不是指责：不用“Oops”、不用感叹号，正面表述（“仅使用字母”而不是“不要用数字”）；能提前告知的格式要求在出错前就写出来。
- 提交后把焦点移到第一个错误字段；不得在表单合法前禁用提交按钮，否则用户无法得知卡在哪里。

- 每个交互组件都实现适用的 default、hover、focus-visible、active、disabled、loading、error 和 success 状态。清晰反馈是必需的，复杂动画不是。
- Web 自定义控件和项目约定使用 `cursor: pointer`；原生桌面控件遵循平台行为，不全局覆盖 cursor。
- 点击当前 tab、当前选项等幂等目标不得刷新视图或重播进场动画。
- Disabled 优先使用原生 `disabled`。需要保留焦点以解释原因时使用 `aria-disabled` 并拦截动作；不要用 `pointer-events: none` 掩盖语义。
- `:focus-visible` 必须清晰，并与鼠标状态同等完整。
- 有选中项的列表打开时让当前项进入可视区，不重排数据；用 `aria-current`、`aria-selected` 等语义表达状态。
- Chat、日志和时间线打开时可跟随最新内容；用户离开底部后暂停，回到底部恢复。阈值由行高或 token 决定，使用事件和 observer，禁止轮询。
- 复制按钮只在复制是高频任务时常驻；否则在 hover、focus-within 或上下文菜单中出现，并保证键盘可达。
