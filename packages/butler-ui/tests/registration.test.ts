import { afterAll, expect, test } from "bun:test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { BUTLER_UI_DIR, cleanupButlerUIModules, prepareButlerUIFixture, PI_CODING_AGENT_URL } from "./loader.ts";
import rootManifest from "../../../package.json";
const { DefaultResourceLoader, SettingsManager } = await import(PI_CODING_AGENT_URL);
afterAll(cleanupButlerUIModules);

test("real Pi resource loader loads UI and provider once even with overlapping package declarations", async () => {
	const { directory, agentDir } = await prepareButlerUIFixture("index.ts", {
		configJsonc: JSON.stringify({ features: { header: false, statusbar: false, tools: false, presets: false,
			rename: true, stats: false, claudeSub: true, openaiNative: true, pet: true } }),
	});
	const packageManifest = JSON.parse(await readFile(join(BUTLER_UI_DIR, "package.json"), "utf8"));
	const rootEntries = rootManifest.pi.extensions.map((entry) => resolve(import.meta.dir, "../../..", entry));
	expect(rootEntries).toEqual(packageManifest.pi.extensions.map((entry: string) => resolve(BUTLER_UI_DIR, entry)));
	const wrapper = join(directory, "wrapper"); await mkdir(wrapper);
	await writeFile(join(wrapper, "package.json"), JSON.stringify({ name: "test-wrapper", pi: {
		extensions: rootEntries.map((entry) => join(directory, entry.slice(BUTLER_UI_DIR.length + 1))),
	} }));
	const loader = new DefaultResourceLoader({ cwd: agentDir, agentDir,
		settingsManager: SettingsManager.inMemory({ packages: [wrapper, directory] }),
		noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
	await loader.reload();
	const result = loader.getExtensions();
	expect(result.errors).toEqual([]);
	expect(result.extensions).toHaveLength(2);
	const ui = result.extensions.find((entry: any) => entry.path === join(directory, "index.ts"));
	const provider = result.extensions.find((entry: any) => entry.path === join(directory, "provider/index.ts"));
	expect(ui).toBeDefined(); expect(provider).toBeDefined();
	expect([...ui.commands.keys()].sort()).toEqual(["butler", "rename"]);
	expect(ui.handlers.has("before_provider_headers")).toBe(false);
	expect(ui.handlers.has("before_provider_request")).toBe(false);
	expect([...provider.commands.keys()]).toEqual(["fast"]);
	expect([...provider.flags.keys()]).toEqual(["verbosity"]);
	expect(provider.handlers.get("before_provider_headers")).toHaveLength(1);
	expect(provider.handlers.get("before_provider_request")).toHaveLength(2);
	for (const extension of result.extensions) {
		expect([...extension.commands.keys()]).not.toContain("subagent");
		expect([...extension.tools.keys()]).not.toContain("subagent");
	}
});
