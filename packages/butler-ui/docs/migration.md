# Butler UI 迁移与集成

`packages/firecode/` 整体映射到 `packages/butler-ui/`；Pi 包名为 `pi-butler-ui`。根包与子包清单都声明 UI `index.ts`、供应商 `provider/index.ts` 两个入口，主题目录随包迁移。UI 不注册供应商钩子，供应商入口保留 `claudeSub`、`openaiNative` 和 `/fast` 功能。不要继续把旧路径列为额外扩展；按新清单重启或重载 Pi。

## 用户配置

运行配置位于 `getAgentDir()/extensions/butler-ui/config.jsonc`。仅存在旧 `extensions/firecode/config.jsonc` 时，按原字节写入新文件：保留 JSONC 注释、快捷键、模型预设和 openai 字段，原文件仍保留。写入先落临时文件并 fsync，再通过排他硬链接发布；并发迁移也不覆盖已存在目标。新旧两份内容不同会在会话开始警告，始终优先新配置。确认迁移后可自行归档旧文件，避免后续编辑新配置时反复提示差异。

迁移失败且新文件不存在时继续使用旧路径并报告失败，避免悄悄回退默认值；已有新文件时仍以新文件为准。两份都没有时不自动安装模板，保留“关闭可选功能并提示”的行为。模板仅用于人工参考，不覆盖用户配置。

## 会话与重载兼容

`firecode-butler-position`、`firecode-nono-position` 的历史会话记录继续可读；位置、widget 和 herdr source ID 保持不变。工具原型 patch 的 `pi.firecode.*` Symbol 保持不变，防止热重载重复包装。额度缓存的 `firecode-quota-*` 名称保持不变，沿用缓存与失败退避。这些是有意保留的兼容标识，不是安装入口或新配置路径。`PI_CLAUDE_*` 环境变量与已有 JSON 字段不变。

## 主控集成尚未提交的改动

本次工作基线为 `4dd6325`，没有把原检出的未提交内容纳入本次提交。集成时先保存原始 diff/未跟踪文件，在新目录上保留这些内容；不得以本分支旧基线内容覆盖它们。

| 原路径（相对 `packages/firecode/`） | 目标路径（相对 `packages/butler-ui/`） | 集成要求 |
| --- | --- | --- |
| `session/pet.ts` | `session/pet.ts` | 保留原检出当前行为；本任务仅加兼容 ID 说明，无 UI 算法改动 |
| `session/butler-frames.ts` | `session/butler-frames.ts` | 保留原检出当前像素/segment 实现 |
| `tests/pet.test.ts` | `tests/pet.test.ts` | 保留原检出测试；若导入 loader 旧 helper，按下述映射修改 |
| `tests/appearance.test.ts` | `tests/appearance.test.ts` | 保留原检出测试并映射 loader helper |
| `themes/butler.json`、`themes/butler-dark.json` | 同名文件 | 保留原内容及未跟踪主题；清单使用目录发现，无需逐个列出 |
| `AGENTS.md`、`session/AGENTS.md` | 同名文件 | 合并当前文档约束与目录/入口说明，不能整文件替换 |

测试 helper 映射：`loadFirecodeModule` → `loadButlerUIModule`，`cleanupFirecodeModules` → `cleanupButlerUIModules`，`copyFirecodeSource` → `copyButlerUISource`，`FIRECODE_DIR` → `BUTLER_UI_DIR`。运行时类型映射：`FireCodeConfig` → `ButlerUIConfig`，`FireCodeKeys` → `ButlerUIKeys`。根 `AGENTS.md`、README、SETUP 也应按差异合并；原检出的 skills、素材与脚本改动由其所有者集成。

旧 `sync-sources` 脚本及专用测试已移除。资产检查改用 `bun run test:assets`；完整 UI 验证用 `bun run test`，供应商 CLI 验证用 `bun run test:pi-smoke`。测试宿主优先解析 PATH 中已安装的 Pi，也可显式设置 `PI_PACKAGES_DIR` 使用依赖完整的源码；找不到宿主会失败，不会静默跳过。
