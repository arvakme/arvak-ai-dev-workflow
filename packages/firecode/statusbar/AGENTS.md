# statusbar：底部三行

布局对齐个人 ccstatusline：模型、思考强度、Git 分支、上下文进度条；缓存命中与已用额度、重置时间；会话平均输入/输出/总速度与 Pi 会话 ID。颜色归 Pi 主题，不读取 Claude 会话数据。没有 jj 时不伪装 bookmark；Git 分支由 Pi 提供。

`metrics.ts` 从当前分支计算 Cache Hit = cacheRead / (cacheRead + cacheWrite)。速度为非缓存 input/output token 除以合并后的 user→assistant 时间区间，排除用户空闲间隔，恢复会话可重建；没有有效区间显示未知。只在 leaf 改变时重新扫描，不随宠物动画重算。

额度内部保持 remaining，显示层转成已用百分比，避免与 Claude statusline 的方向相反。Anthropic 接受旧 bucket 和新 scoped limits，缺少模型配额时不编造值。重置时间由渲染时计算，不增加轮询。

额度支持 openai-codex、anthropic、xai（后两者需 OAuth 登录，xai 读官方 CLI 登录态）。抓取由会话启动、切换模型、每轮结束触发。结果与失败退避写在 `~/.pi/agent/tmp/firecode-quota-<provider>.json`；连续失败按 1 → 2 → 5 分钟退避。
