# 动效

## 5. 默认动效语言

```css
:root {
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-state: cubic-bezier(0.2, 0, 0, 1);
  --duration-micro: 120ms;
  --duration-state: 160ms;
  --duration-overlay: 200ms;
  --duration-view: 240ms;
}
```

- 默认反馈使用颜色、opacity、轻微位移等 120–180ms 过渡。高频操作只保留即时反馈；标志性动效使用 280–700ms，但只能出现在少数低频、高意图组件。
- 动画预算与操作频率成反比：键盘快捷键、命令面板开合等每日上百次的操作不加进出场动画；delight 只留给低频或首次体验。
- 进出场和即时反馈默认缓出；屏内连续位移或形变使用 ease-in-out；匀速循环才使用 linear。需要即时响应的交互不用 ease-in。
- Motion 必须表达状态、层级、方向或操作结果。静态内容不因“需要高级感”而自动入场。
- 动效不得是唯一反馈通道：动画传达的状态变化必须同时有颜色、图标或文字等静态线索，reduced-motion 或错过动画的用户仍能得知结果。
- Enter 与 exit 走同一空间路径；exit 通常为 enter 时长的 70–80%，距离更短。交互高频重复或退场不传递空间信息时，直接移除不播动画。
- 动画必须从当前呈现值继续，可中断、反向且不排队。异步状态由事件、Promise、transitionend 或 observer 驱动。
- 位移、缩放和进出场默认动画 transform/opacity；状态反馈可以过渡颜色。布局或材质属性仅在语义需要且目标设备验证流畅时使用。
- `prefers-reduced-motion: reduce` 下取消位移、旋转、缩放、布局重排和 stagger 的插值过程，直接呈现终态；保留短 opacity/color 反馈。定义静态布局所需的 transform 可以保留。

### 弹簧与空间连续性

- 颜色、opacity 和短 hover 用 CSS tween；手势、共享布局、可中断位移和有深度的 Card 编排才用 spring。不得为单个普通按钮引入 Motion。
- 项目没有 spring token 时，微型图标或布局切换可从 `{ stiffness: 500, damping: 30, mass: 0.8 }` 起调；Card、CoverFlow 等较大空间编排可从 `{ stiffness: 220, damping: 24, mass: 0.8 }` 起调。默认无明显回弹，只有动量手势或 playful 语气允许轻微 overshoot。
- Motion 的 `duration/bounce` 与 `stiffness/damping/mass` 是两套配置；选择一套，不混写被覆盖的参数。
- 拖拽释放时把当前速度交给 spring；边界使用渐增阻力，不硬停。Pointer drag 使用 capture，并从元素当前屏幕位置继续。
- 任务涉及拖拽、swipe、bottom sheet、carousel 等手势驱动交互时，先读取 [gestures.md](gestures.md) 获取速度交接、动量投射和边界阻力的具体参数。
- 一组元素由一个交互状态驱动；位置、旋转、缩放、opacity 和 z-order 由 `index - activeIndex` 等同一几何关系派生，不给每层随机曲线。每个组件只保留一个主运动意图。
- `transform-origin` 对齐物理锚点：Popover 指向 trigger，Card fan 使用扇轴，Modal 保持中心。进出方向、z-order 和阴影必须符合相同的空间关系。
- 图标或文案替换使用固定占位和叠层，避免容器宽高跳动；presence 初始渲染不重播，退出完成前保留旧层，共享布局从旧几何连续过渡到新几何。

## 6. 进出场配方

| 组件 | Enter | Exit |
|---|---|---|
| 行内区块、列表项 | 120–160ms，opacity + `translateY(2–4px)` | 100–120ms，短位移淡出 |
| Popover / Dropdown | 140–180ms，从触发方向位移 4–6px，`scale(.98→1)` | 100–130ms 反向收起 |
| Dialog | 180–220ms，opacity + `translateY(8px)` + `scale(.98→1)` | 140–170ms，位移 4px |
| Toast | 180–220ms，从堆叠方向进入 | 130–160ms 淡出，剩余项 180ms 重排 |
| 视图切换 | 180–240ms，方向与导航关系一致 | 140–180ms |

- Blur 不是默认入场属性；只有视觉语言明确需要且实测流畅时添加。Cross-fade 两层重叠感调不掉时，可在过渡期加 ≤2px blur 融合新旧状态。
- Stagger 默认间隔 30–50ms，最多 6 个语义块；长列表只动画新增或可见项。首屏、成功页、Onboarding 等低频分段入场可放宽到 80–100ms 以强调层级，但最后一个块的开始时间不得超过 400ms。
- Stagger 按语义分块，不按 DOM 顺序洒；切 tab、hover 列表行、筛选重排、打开菜单等高频交互一律不 stagger。同一区域只在本会话首次进入时错峰，回退或重新渲染不重播。
- Tooltip 首次 hover 保留延时防误触；已有 Tooltip 打开时，相邻 Tooltip 立即显示并跳过入场动画。
- 首屏默认可见，不误播路由或交互动效。条件区块收起时同步处理 `inert` 和焦点。

### 按下反馈

视觉位移 = 尺寸 × (1 − scale) ÷ 2。固定一个比例会在小控件上看不见、在大元素上发晃，按尺寸分档，目标每边 1.5–2px：

| 控件 | scale |
|---|---:|
| 图标按钮、≤40px 小控件 | 0.90–0.92 |
| 标准按钮 80–160px | 0.96 |
| 宽 CTA ≥200px | 0.98 |
| 整卡片、列表行 | 不缩放，用 `translateY(1px)` 加 elevation 降一级 |

- 按下 80–100ms、释放 150–200ms，均 ease-out：按压要跟手，释放才是动画。
- 同时把 elevation 降一级比单纯缩放更接近物理按压。大块内容缩放会让文字发虚，超过 200px 的元素优先用位移和阴影。
- 用 `transition-property: scale`（或 transform）保持可中断，中途松手能平滑回弹；不用 keyframes。
- 纯文字链接和导航项不缩放，只换颜色。

## 7. Icon 规范

任务涉及图标选型、描边粗细、填充态、尺寸、颜色状态或 RTL 方向时，先读取 [icons.md](icons.md)；下表只管动效。

| Motif | 参数 | 用途 |
|---|---|---|
| 位移 | 140–180ms，2–3px | 箭头、发送、外链等有方向的动作 |
| 旋转 | 160–200ms，45–90° | 展开、刷新、设置等状态变化 |
| Cross-fade | 160–220ms，opacity + `scale(.8→1)` | 播放/暂停、复制/完成、展开/收起 |
| Wiggle / Pop | 280–360ms，一次 | 收藏、固定、删除确认等少量强调 |
| Draw 重绘 | 450–700ms，一次 | 内容型或品牌化图标的标志性反馈 |

简单 hover 反馈是默认；Wiggle、Pop 和 Draw 由组件语义或产品动效语言显式启用，不分配给每个图标。

- Icon swap 保持 16–20px 固定槽位；旧图标与新图标叠放，使用成对的 cross-fade、scale 或相反方向位移，Button 外壳不跟着伸缩。
- 复制完成、收藏成功等状态动效由真实动作触发并保留可读终态，不用 hover 假装成功。装饰性 sparkle 最多一次，50–100ms 的局部错峰不得延迟主反馈。
- 箭头、发送、展开等方向性图标的轨迹必须匹配动作方向；高频工具栏只切换颜色或做 2–3px 位移，不反复旋转、弹跳。

### Draw 规范

多笔画 SVG 不得硬编码像素级 `stroke-dasharray`。先给每条可绘制笔画设置 `pathLength="1"`，再使用：

```css
[data-draw] path {
  stroke-dasharray: 1 1;
  stroke-dashoffset: 1;
}
[data-draw][data-active] path {
  stroke-dashoffset: 0;
}
```

- 在组件初始化时归一化 SVG；未归一化的图标保持静态，不在 pointerover 时临时改 DOM。
- 重绘完成后的终态必须等于静态图标，避免动画结束跳变。
- Pointer leave 不反向“擦除”图标；恢复静态状态即可。状态切换需要可逆时使用 Cross-fade。
- 触发器使用专属 `data-*` 属性，不用通用 `.group:hover`，防止外层 hover 误触发。

## 8. 动效实现纪律

- 优先使用项目已有 motion、GSAP 或 CSS；不为单个微动效新增依赖。
- 禁止 `transition: all`。只声明实际变化的属性。
- 可被快速重复触发的进出场用 transition，不用 keyframes：transition 可中断重定向，keyframes 中断即从零重播。纯 CSS 入场优先 `@starting-style`，不用 `useEffect` 置 mounted 标记。
- Motion 的 `x`/`y`/`scale` 简写在主线程 rAF 运行，页面负载下会掉帧；确定性动画优先 CSS 或 WAAPI，JS 动画需要硬件加速时写完整 `transform` 字符串。
- 拖拽跟随不要在父容器改 CSS 变量驱动子元素（触发全子树样式重算）；直接写目标元素的 `transform`。
- `will-change` 只在性能测量证明有收益时使用，并在动画后释放。
- 同一节点的同一属性只由 CSS、Motion 或 GSAP 中一个系统控制；需要组合时拆 wrapper，避免 transform 相互覆盖。
- 使用 Motion 时在应用边界设置 `MotionConfig reducedMotion="user"`，局部保留 opacity/color 替代；Presence 切换默认关闭首帧入场，列表替换或共享几何使用 layout/popLayout 等连续布局能力。
- Tailwind v4 的独立 translate、scale、rotate 属性可能被 keyframe 的 `transform` 覆盖；组合前检查最终 computed style。
- One-shot 动画结束后回到静态样式。使用 `fill-mode: both` 时，终态必须与组件状态一致。
- Hover 动效只在精细指针启用；语义和关键反馈必须同时支持 focus、键盘与 touch，不用延时模拟 sticky hover。
- Toast 全应用共用一个 Stack；tone、图标和颜色映射只有一处事实源。
- 列表新增可用轻量 enter，删除后用 FLIP 重排；高频流式更新不逐项播放复杂动画。
