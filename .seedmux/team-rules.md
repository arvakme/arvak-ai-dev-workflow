# 本仓库 Seedmux 协作

并行写入与独立审查按 `packages/skills/development/project-flow/references/delivery.md` 确定隔离目录及输入版本；所有 worker 只通过 Seedmux 派发。

主控拥有整合和已授权的主分支推送；worker 交付本任务差异与对应验证证据。scope 检查不能证明作者归属，出现归因问题应保留差异交主控核对。

不运行整目录覆盖的 `npm run sync`。保留其他任务的未提交改动；交付物只包含工单范围内自己的差异。
