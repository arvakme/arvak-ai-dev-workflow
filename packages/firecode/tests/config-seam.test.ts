import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterEach, expect, test } from "bun:test";
import { cleanupFirecodeModules, copyFirecodeSource, FIRECODE_DIR, loadFirecodeModule } from "./loader.ts";

afterEach(cleanupFirecodeModules);

test("portable loader copies runtime sources without repository metadata or development docs", async () => {
	const directory = await mkdtemp(join(tmpdir(), "firecode-copy-"));
	try {
		await copyFirecodeSource(directory);
		expect(existsSync(join(directory, "index.ts"))).toBeTrue();
		expect(existsSync(join(directory, ".git"))).toBeFalse();
		expect(existsSync(join(directory, "docs"))).toBeFalse();
		expect(existsSync(join(directory, "tests"))).toBeFalse();
		expect(
			(await readdir(directory, { recursive: true }))
				.filter((path) => /\.mdx?$/.test(path))
				.map((path) => path.split(sep).join("/"))
				.sort(),
		).toEqual([]);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("missing runtime config disables optional behavior and warns on each session_start", async () => {
	const { default: registerFirecode } = await loadFirecodeModule("index.ts", { configJsonc: null });
	const commands: string[] = [];
	const shortcuts: string[] = [];
	const tools: string[] = [];
	const renderers: string[] = [];
	const events = new Map<string, Array<(...args: unknown[]) => void>>();
	const pi = {
		registerCommand: (name: string) => commands.push(name),
		registerShortcut: (key: string) => shortcuts.push(key),
		registerTool: ({ name }: { name: string }) => tools.push(name),
		registerMessageRenderer: (name: string) => renderers.push(name),
		on: (name: string, handler: (...args: unknown[]) => void) =>
			events.set(name, [...(events.get(name) ?? []), handler]),
	};

	(registerFirecode as (pi: unknown) => void)(pi);

	expect(commands).toEqual([]);
	expect(shortcuts).toEqual([]);
	expect(tools).toEqual([]);
	expect(renderers).toEqual([]);
	const warnings: string[] = [];
	for (let occurrence = 0; occurrence < 2; occurrence++)
		for (const handler of events.get("session_start") ?? [])
			handler({}, { ui: { notify: (message: string) => warnings.push(message) } });
	expect(warnings).toEqual([
		"FireCode 配置有问题：config.jsonc 不存在，已关闭可选功能",
		"FireCode 配置有问题：config.jsonc 不存在，已关闭可选功能",
	]);
});

test("runtime config enables only its declared behavior", async () => {
	const configJsonc = JSON.stringify({
		features: Object.fromEntries([
			"header",
			"statusbar",
			"tools",
			"presets",
			"stats",
			"claudeSub",
			"openaiNative",
			"pet",
		].map((feature) => [feature, false]).concat([["rename", true]])),
		keys: { rename: "alt+r" },
	});
	const { default: registerFirecode } = await loadFirecodeModule("index.ts", { configJsonc });
	const commands: string[] = [];
	const shortcuts: string[] = [];
	(registerFirecode as (pi: unknown) => void)({
		registerCommand: (name: string) => commands.push(name),
		registerShortcut: (key: string) => shortcuts.push(key),
		registerMessageRenderer() {},
		on() {},
	});

	expect(commands).toEqual(["rename"]);
	expect(shortcuts).toEqual(["alt+r"]);
});

test("preset 只认模型原子，旧的三字段写法被拒", async () => {
	const { loadConfig } = await loadFirecodeModule("config.ts", {
		configJsonc: JSON.stringify({
			presets: {
				new: { model: "test/model/high", key: "alt+1" },
				old: { provider: "test", model: "model", thinkingLevel: "high" },
			},
		}),
	});
	const loaded = (loadConfig as () => { config: any; problems: string[] })();

	expect(loaded.config.presets.new.model).toEqual({ model: "test/model", thinking: "high" });
	expect(loaded.problems).toContain("未知字段 presets.old.provider");
	expect(loaded.problems).toContain("未知字段 presets.old.thinkingLevel");
	expect(loaded.problems).toContain(
		"presets.old.model 必须是“provider/model/thinking”字符串（模型段不是 provider/model：model；思考档无效：model）",
	);
});

test("公共配置模板可解析并启用完整推荐工作流", async () => {
	const configJsonc = await readFile(join(FIRECODE_DIR, "config.example.jsonc"), "utf8");
	const { loadConfig } = await loadFirecodeModule("config.ts", { configJsonc });
	const loaded = (loadConfig as () => { config: any; problems: string[] })();

	expect(loaded.problems).toEqual([]);
	for (const feature of ["openaiNative", "pet"])
		expect(loaded.config.features[feature]).toBeTrue();
	expect(loaded.config.features.claudeSub).toBeFalse();
	expect(loaded.config.features.bark).toBeUndefined();

});
