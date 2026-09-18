/** Preserve legacy JSONC bytes; publish only when no canonical config exists. */
import { existsSync, readFileSync, mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, linkSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export function resolveConfigPath(agentDir: string): { path: string; problems: string[] } {
	const directory = join(agentDir, "extensions", "butler-ui");
	const path = join(directory, "config.jsonc");
	const legacy = join(agentDir, "extensions", "firecode", "config.jsonc");
	const problems: string[] = [];
	if (!existsSync(legacy)) return { path, problems };
	let temporary: string | undefined;
	try {
		const original = readFileSync(legacy);
		if (!existsSync(path)) {
			mkdirSync(directory, { recursive: true });
			temporary = join(directory, `.config-${randomUUID()}.tmp`);
			const fd = openSync(temporary, "wx", 0o600);
			try { writeFileSync(fd, original); fsyncSync(fd); } finally { closeSync(fd); }
			try { linkSync(temporary, path); }
			catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
		}
		if (!readFileSync(path).equals(original)) {
			problems.push("butler-ui 与 firecode 的 config.jsonc 不同：使用 butler-ui，旧文件已保留；请核对后自行归档旧文件");
		}
		return { path, problems };
	} catch (error) {
		// Keep a present canonical file authoritative even if comparison failed.
		const selected = existsSync(path) ? path : legacy;
		problems.push(`config.jsonc 迁移失败：${String(error)}；继续读取 ${selected}`);
		return { path: selected, problems };
	} finally {
		if (temporary) {
			try { unlinkSync(temporary); } catch { /* A failed cleanup must not change config selection. */ }
		}
	}
}
