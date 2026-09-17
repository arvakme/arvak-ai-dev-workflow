---
name: ui-craft
description: 设计、实现或打磨界面布局、视觉与交互；按改动范围查阅对应规范。
---

# UI Craft

沿用项目现有品牌、组件、token 和平台规范。先读取受影响组件及相邻实例；`DESIGN.md` 在涉及设计决策时作为线索与代码核对。局部改色、间距或文案不触发全站重设计。

只有新建界面或大幅重设计时，明确主要用户、核心任务、输入方式与密度；沿用已有约定，缺失时作合理选择。窗口变宽时增加内容或列，不按比例放大控件。原生应用优先系统控件规范。

## 按任务读取

| 当前改动 | 参考 |
|---|---|
| 布局、尺寸、排版间距、表面层级或空态 | [布局与密度](reference/layout.md) |
| 控件状态、表单标注、错误反馈或 UI 文案 | [交互与反馈](reference/interaction.md) |
| 动效、弹簧、进出场或图标动画 | [动效](reference/motion.md) |
| 图标选型、描边、填充或 RTL 方向 | [图标](reference/icons.md) |
| 调色板、主题色、OKLCH 或对比度 | [配色](reference/colors/index.md) |
| 字体选择、字阶、可变字体或 OpenType | [字体](reference/typography/index.md) |
| 键盘、ARIA、读屏或可访问性审查 | [可访问性](reference/accessibility/index.md) |
| 明确要求整体界面审查 | [审查](reference/review.md)，再按实际问题读取上述参考 |

只读取当前改动需要的参考。点名 better-colors／better-typography／better-accessibility 时分别走对应入口；better-ui／better-layout 走布局，better-writing 走交互，better-interface 走审查。

## 交付判断

保持信息层级和操作目的清晰，避免无业务依据的 Card、重复 CTA、装饰数字和模板化段落。保留关键状态、后果和可修复反馈；复用共享组件与 token。

按影响验证真实界面：配色检查实际背景下的可读性；布局检查相关窗口宽度；交互检查键盘和状态；动效检查连续操作与 reduced-motion。只改静态颜色无需重做全套交互或性能审计。明确哪些已目视、哪些只做了代码或自动检查。

没有可运行界面时，用户只要求配置或补丁的任务可交付该产物并注明视觉验证缺口；用户明确要求可运行效果或视觉验收时，该缺口仍是未完成项。不要把配置正确等同于实际画面通过。
