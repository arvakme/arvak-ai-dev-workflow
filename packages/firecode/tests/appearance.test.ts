import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { cleanupFirecodeModules, loadFirecodeModule, PI_CODING_AGENT_URL, PI_TUI_URL } from "./loader.ts";
import { NonoWidget } from "../session/pet.ts";
import themeJson from "../themes/nono.json";

const { TuiAltScreen, visibleWidth } = await import(PI_TUI_URL);
const { DefaultResourceLoader, SettingsManager, Theme } = await import(PI_CODING_AGENT_URL);
afterAll(cleanupFirecodeModules);

test("the real fullscreen host dispatches 2D dragging and preserves a menu when NONO closes", () => {
	const terminal = { columns: 80, rows: 30, hideCursor() {} };
	const tui = new TuiAltScreen(terminal, false);
	tui.requestRender = () => {};
	const editor = { render: () => ["input"], invalidate() {} };
	tui.setFocus(editor);
	const saved: any[] = [];
	const pet = new NonoWidget(tui, { x: 1, y: 0 }, (position) => saved.push(position));
	try {
		tui.compositeOverlays([], 80, 30);
		expect(tui.focusedComponent).toBe(editor);
		tui.handleMouseEvent({ button: 0, x: 65, y: 2, release: false });
		tui.handleMouseEvent({ button: 32, x: 34, y: 12, release: false });
		tui.compositeOverlays([], 80, 30);
		tui.handleMouseEvent({ button: 0, x: 34, y: 12, release: true });
		expect(saved).toHaveLength(1);
		expect(saved[0].x).toBe(0.5); expect(saved[0].y).toBeCloseTo(10 / 21);
		expect(tui.focusedComponent).toBe(editor);
		const menu = { render: () => ["settings"], invalidate() {} };
		const handle = tui.showOverlay(menu, { width: 20 });
		pet.dispose(); tui.compositeOverlays([], 80, 30);
		expect(handle.getBounds()).toBeDefined(); expect(tui.focusedComponent).toBe(menu);
		handle.hide(); expect(tui.focusedComponent).toBe(editor);
	} finally { pet.dispose(); }
});

test("the compact header stays within its width and reserves NONO's corner", async () => {
	const { registerHeader } = await loadFirecodeModule("header.ts");
	const colors = Object.fromEntries(Object.entries(themeJson.colors).map(([key, value]) => [key, (themeJson.vars as any)[value] ?? value]));
	const theme = new Theme(colors, colors, "truecolor");
	let start: any, header: any;
	(registerHeader as any)({ on(_name: string, handler: any) { start = handler; } });
	start({}, { mode: "rpc", ui: { setHeader() { throw new Error("headless header"); } } });
	start({}, { mode: "tui", ui: { setHeader(factory: any) { header = factory({}, theme); } } });
	for (const width of [0, 1, 12, 25, 39, 40, 80, 120]) {
		const lines = header.render(width);
		expect(lines).toHaveLength(3);
		expect(lines.every((line: string) => visibleWidth(line) <= width - (width >= 40 ? 20 : 0))).toBeTrue();
	}
	expect(header.render(80).join("\n")).toContain("FIRECODE");
	expect(header.render(80).join("\n")).toContain("NONO");
});

test("Pi discovers NONO through the package manifest and resolves every color", async () => {
	const agentDir = await mkdtemp(resolve(tmpdir(), "nono-theme-"));
	try {
		const settingsManager = SettingsManager.inMemory({ packages: [resolve(import.meta.dir, "../../..")] });
		const loader = new DefaultResourceLoader({ cwd: agentDir, agentDir, settingsManager,
			noExtensions: true, noSkills: true, noPromptTemplates: true, noContextFiles: true });
		await loader.reload();
		const { themes, diagnostics } = loader.getThemes();
		expect(diagnostics).toEqual([]);
		const theme = themes.find((item: any) => item.name === "nono");
		expect(theme).toBeDefined();
		for (const key of Object.keys(themeJson.colors)) {
			if (key.endsWith("Bg")) expect(theme.bg(key, "sample")).toContain("sample");
			else expect(theme.fg(key, "sample")).toContain("sample");
		}
	} finally { await rm(agentDir, { recursive: true, force: true }); }
});
