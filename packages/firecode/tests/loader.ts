/**
 * 在测试里加载 Butler UI 模块：扩展运行时由 pi 注入 `@earendil-works/*`，
 * 测试环境没有这层注入，因此把整个插件目录复制到临时目录并把包名改写到 已安装的 Pi（或显式指定的源码）。
 */
import { existsSync, realpathSync, readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { delimiter, dirname, extname, join, relative, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FIRECODE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE_DIR = FIRECODE_DIR;

function piHostEntries(): { codingAgent: string; ai: string; compat: string; tui: string } {
	if (process.env.PI_PACKAGES_DIR) {
		const root = process.env.PI_PACKAGES_DIR;
		const entries = { codingAgent: join(root, "coding-agent/src/index.ts"), ai: join(root, "ai/src/index.ts"),
			compat: join(root, "ai/src/compat.ts"), tui: join(root, "tui/src/index.ts") };
		for (const path of Object.values(entries)) if (!existsSync(path)) throw new Error(`Pi source entry missing: ${path}`);
		return entries;
	}
	for (const directory of (process.env.PATH ?? "").split(delimiter)) {
		const executable = join(directory, process.platform === "win32" ? "pi.exe" : "pi");
		if (!existsSync(executable)) continue;
		const resolved = realpathSync(executable);
		let root = dirname(resolved);
		while (dirname(root) !== root) {
			const manifest = join(root, "package.json");
			if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === "@earendil-works/pi-coding-agent") {
				// Bun resolves import-only package exports against the installed host dependencies.
				const resolve = (name: string) => Bun.resolveSync(name, root);
				const codingAgent = join(root, "dist/index.js");
				if (existsSync(codingAgent)) return { codingAgent, ai: resolve("@earendil-works/pi-ai"),
					compat: resolve("@earendil-works/pi-ai/compat"), tui: resolve("@earendil-works/pi-tui") };
				const packages = dirname(root);
				if (existsSync(join(root, "src/index.ts"))) return { codingAgent: join(root, "src/index.ts"),
					ai: join(packages, "ai/src/index.ts"), compat: join(packages, "ai/src/compat.ts"), tui: join(packages, "tui/src/index.ts") };
			}
			root = dirname(root);
		}
	}
	throw new Error("Cannot locate Pi host: install pi on PATH or set PI_PACKAGES_DIR to a working pi-mono packages directory");
}

const host = piHostEntries();
export const PI_CODING_AGENT_URL = pathToFileURL(host.codingAgent).href;
const PI_CODING_AGENT = PI_CODING_AGENT_URL;
export const PI_AI_URL = pathToFileURL(host.ai).href;
export const PI_AI_COMPAT_URL = pathToFileURL(host.compat).href;
const PI_AI = PI_AI_URL;
const PI_TUI = pathToFileURL(host.tui).href;

const created: string[] = [];
const NON_RUNTIME_ROOTS = new Set([".git", "docs", "tests"]);
const TEST_CONFIG_JSONC = JSON.stringify({
	features: {
		header: true,
		statusbar: true,
		tools: true,
		presets: true,
		rename: true,
		stats: true,
		claudeSub: false,
		openaiNative: false,
		pet: false,
	},
	keys: { rename: "ctrl+r", cyclePreset: "ctrl+shift+u", fast: "ctrl+f" },
	presets: { deep: { model: "test/deep/high", key: "alt+1" } },
});

export async function copyFirecodeSource(destination: string): Promise<void> {
	await cp(SOURCE_DIR, destination, {
		recursive: true,
		filter: (source) => {
			const path = relative(SOURCE_DIR, source);
			const [root] = path.split(sep);
			if (NON_RUNTIME_ROOTS.has(root)) return false;
			if (![".md", ".mdx"].includes(extname(path))) return true;
			return false;
		},
	});
}

async function rewriteImports(directory: string): Promise<void> {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			await rewriteImports(path);
			continue;
		}
		if (!entry.name.endsWith(".ts")) continue;
		const source = (await readFile(path, "utf8"))
			.replaceAll('"@earendil-works/pi-coding-agent"', JSON.stringify(PI_CODING_AGENT))
			.replaceAll('"@earendil-works/pi-ai"', JSON.stringify(PI_AI))
			.replaceAll('"@earendil-works/pi-tui"', JSON.stringify(PI_TUI));
		await writeFile(path, source);
	}
}

/**
 * 加载插件内某个模块，例如 `tools/index.ts`、`session/presets.ts`。
 * `configJsonc` 可覆写或移除测试 Agent 目录里的运行配置，用于验证配置边界。
 */
export async function prepareFirecodeFixture(
	entry: string,
	options: {
		configJsonc?: string | null;
		replacements?: Record<string, string>;
		extraFiles?: Record<string, string>;
	} = {},
): Promise<{ directory: string; agentDir: string }> {
	const directory = await mkdtemp(join(tmpdir(), "firecode-test-"));
	created.push(directory);
	await copyFirecodeSource(directory);
	const agentDir = join(directory, "agent");
	const configDir = join(agentDir, "extensions", "firecode");
	await mkdir(configDir, { recursive: true });
	if (options.configJsonc !== null) {
		const configJsonc = options.configJsonc ?? TEST_CONFIG_JSONC;
		await writeFile(join(configDir, "config.jsonc"), configJsonc);
	}
	for (const [path, content] of Object.entries(options.extraFiles ?? {})) {
		const destination = join(directory, path);
		await mkdir(dirname(destination), { recursive: true });
		await writeFile(destination, content);
	}
	await rewriteImports(directory);
	const configModule = join(directory, "config.ts");
	const getAgentDirImport = `import { getAgentDir } from ${JSON.stringify(PI_CODING_AGENT)};`;
	const configSource = await readFile(configModule, "utf8");
	if (!configSource.includes(getAgentDirImport)) throw new Error("Butler UI config path seam changed");
	await writeFile(
		configModule,
		configSource.replace(getAgentDirImport, `const getAgentDir = () => ${JSON.stringify(agentDir)};`),
	);
	for (const [oldText, newText] of Object.entries(options.replacements ?? {})) {
		const sourceEntry = entry.endsWith(".js") ? `${entry.slice(0, -3)}.ts` : entry;
		const path = join(directory, sourceEntry);
		await writeFile(path, (await readFile(path, "utf8")).replace(oldText, newText));
	}
	return { directory, agentDir };
}

export async function loadFirecodeModule(entry: string, options: Parameters<typeof prepareFirecodeFixture>[1] = {}): Promise<Record<string, unknown>> {
	const { directory } = await prepareFirecodeFixture(entry, options);
	return import(`${pathToFileURL(join(directory, entry)).href}?test=${Date.now()}`);
}

export async function cleanupFirecodeModules(): Promise<void> {
	await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
}

export const PI_TUI_URL = PI_TUI;
