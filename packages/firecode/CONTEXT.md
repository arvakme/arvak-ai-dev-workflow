# 跨模块命名

**Seedmux 主控**：当前承担拆分、派发、集成和验收的真实 Agent pane。Master 是这一职责，不是 FireCode 中的另一套运行时。

**Agent pane**：Seedmux 管理的原生 CLI 会话。任务、范围、回执与唤醒遵循 Seedmux 官方 `seedmux-team`，FireCode 不维护并行任务状态。

**Agora 白板**：项目目标、依赖、问题与决策的共享上下文。白板 session、Seedmux pane 和 Pi session 是三种不同身份，不互换 ID。

**回执**：执行者提交的证据输入；主控核对实际改动、命令退出码与需求后才能验收。任务状态以项目指定 tracker 为准。

**Butler**：FireCode 在 Pi 右上角的常驻像素挂件。显示当前会话状态，空闲也有小动作；不创建 Agent 或承担主控职责。

**模型原子**：`provider/model/thinking`，仅在 FireCode 预设配置内指定模型和思考档。Seedmux 各 Agent 的模型选择由其官方接口管理。
