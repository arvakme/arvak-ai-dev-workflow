import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveConfigPath } from "../config-migration.ts";
import { cleanupButlerUIModules, loadButlerUIModule } from "./loader.ts";

const roots: string[] = [];
afterEach(async () => { roots.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true })); await cleanupButlerUIModules(); });
function fixture() {
	const root = mkdtempSync(join(tmpdir(), "butler-config-")); roots.push(root);
	const legacy = join(root, "extensions", "firecode", "config.jsonc");
	const canonical = join(root, "extensions", "butler-ui", "config.jsonc");
	mkdirSync(join(root, "extensions", "firecode"), { recursive: true });
	return { root, legacy, canonical };
}
const bytes = '// keep my comments\r\n{"features":{"pet":false},"openai":{"serviceTier":"priority"},"keys":{"fast":"alt+f"}}\r\n';

test("migration preserves exact JSONC bytes, keeps the original and is idempotent", () => {
	const { root, legacy, canonical } = fixture(); writeFileSync(legacy, bytes);
	expect(resolveConfigPath(root)).toEqual({ path: canonical, problems: [] });
	expect(readFileSync(canonical, "utf8")).toBe(bytes);
	expect(readFileSync(legacy, "utf8")).toBe(bytes);
	expect(resolveConfigPath(root)).toEqual({ path: canonical, problems: [] });
	expect(readdirSync(join(root, "extensions", "butler-ui"))).toEqual(["config.jsonc"]);
});

test("existing canonical config wins without overwrite and reports conflicting legacy values", () => {
	const { root, legacy, canonical } = fixture(); writeFileSync(legacy, bytes);
	mkdirSync(join(root, "extensions", "butler-ui")); writeFileSync(canonical, '{"features":{"pet":true}}');
	const resolved = resolveConfigPath(root);
	expect(resolved.path).toBe(canonical); expect(resolved.problems).toHaveLength(1);
	expect(resolved.problems[0]).toContain("使用 butler-ui");
	expect(readFileSync(canonical, "utf8")).toBe('{"features":{"pet":true}}');
	expect(readFileSync(legacy, "utf8")).toBe(bytes);
});

test("failed migration keeps reading legacy config and reports the failure", () => {
	const { root, legacy } = fixture(); writeFileSync(legacy, bytes);
	writeFileSync(join(root, "extensions", "butler-ui"), "occupied");
	const resolved = resolveConfigPath(root);
	expect(resolved.path).toBe(legacy); expect(resolved.problems[0]).toContain("迁移失败");
	expect(readFileSync(legacy, "utf8")).toBe(bytes);
});

test("runtime consumes migrated values instead of defaults", async () => {
	const loaded = await loadButlerUIModule("config.ts", { configJsonc: null,
		extraFiles: { "agent/extensions/firecode/config.jsonc": bytes } });
	const result = (loaded.loadConfig as any)();
	expect(result.config.features.pet).toBe(false); expect(result.config.keys.fast).toBe("alt+f");
	expect(result.problems).toEqual([]);
	expect(loaded.CONFIG_PATH).toContain("extensions/butler-ui/config.jsonc");
});
