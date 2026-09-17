import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { cleanupFirecodeModules, loadFirecodeModule, PI_CODING_AGENT_URL, PI_TUI_URL } from "./loader.ts";
import { ButlerWidget } from "../session/pet.ts";
import themeJson from "../themes/butler.json";
import darkThemeJson from "../themes/butler-dark.json";

const { TuiAltScreen, visibleWidth } = await import(PI_TUI_URL);
const { DefaultResourceLoader, SettingsManager, Theme } = await import(PI_CODING_AGENT_URL);
afterAll(cleanupFirecodeModules);

test("the real fullscreen host dispatches 2D dragging and preserves a menu when Butler closes", () => {
	const terminal = { columns: 80, rows: 30, hideCursor() {} };
	const tui = new TuiAltScreen(terminal, false);
	tui.requestRender = () => {};
	const editor = { render: () => ["input"], invalidate() {} };
	tui.setFocus(editor);
	const saved: any[] = [];
	const pet = new ButlerWidget(tui, { x: 1, y: 0 }, (position) => saved.push(position));
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

test("the compact header stays within its width and reserves Butler's corner", async () => {
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
	expect(header.render(80).join("\n")).not.toContain("FIRECODE");
	expect(header.render(80).join("\n")).toContain("Butler Code");
});

test("Pi discovers Butler through the package manifest and resolves every color", async () => {
	const agentDir = await mkdtemp(resolve(tmpdir(), "butler-theme-"));
	try {
		const settingsManager = SettingsManager.inMemory({ packages: [resolve(import.meta.dir, "../../..")] });
		const loader = new DefaultResourceLoader({ cwd: agentDir, agentDir, settingsManager,
			noExtensions: true, noSkills: true, noPromptTemplates: true, noContextFiles: true });
		await loader.reload();
		const { themes, diagnostics } = loader.getThemes();
		expect(diagnostics).toEqual([]);
		for (const name of ["butler", "butler-dark"]) {
			const theme = themes.find((item: any) => item.name === name);
			expect(theme).toBeDefined();
			for (const key of Object.keys(themeJson.colors)) {
				if (key.endsWith("Bg")) expect(theme.bg(key, "sample")).toContain("sample");
				else expect(theme.fg(key, "sample")).toContain("sample");
			}
		}
	} finally { await rm(agentDir, { recursive: true, force: true }); }
});

test("the real host releases capture after docking and restores Butler from its one-cell handle", () => {
	const terminal = { columns: 80, rows: 30, hideCursor() {} };
	const tui = new TuiAltScreen(terminal, false);
	tui.requestRender = () => {};
	const editor = { render: () => ["input"], invalidate() {} };
	tui.setFocus(editor);
	const saved: any[] = [], folded: boolean[] = [];
	const pet = new ButlerWidget(tui, { x: 0.5, y: 0.5 }, p => saved.push(p), value => folded.push(value));
	const draw = () => tui.compositeOverlays([], 80, 30);
	const click = (x: number, y: number) => {
		tui.handleMouseEvent({ button: 0, x, y, release: false });
		tui.handleMouseEvent({ button: 0, x, y, release: true });
		draw();
	};
	try {
		draw(); click(35, 12); click(35, 12);
		expect(folded).toEqual([true]);
		click(35, 12); expect(folded).toEqual([true]);
		click(78, 0); expect(folded).toEqual([true, false]);
		expect(pet.render(17)).toHaveLength(6);
		expect(saved).toEqual([]); expect(tui.focusedComponent).toBe(editor);
		click(35, 12); click(35, 12); expect(folded).toEqual([true, false, true]);
		const menu = { render: () => ["settings"], invalidate() {} };
		const handle = tui.showOverlay(menu, { width: 20 });
		pet.dispose(); draw();
		expect(handle.getBounds()).toBeDefined(); expect(tui.focusedComponent).toBe(menu);
		handle.hide();
	} finally { pet.dispose(); }
});


test("light and dark cards keep readable text, including tool rows and the jump indicator", () => {
	const luminance = (hex: string) => {
		const channels = hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255)
			.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
		return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
	};
	for (const palette of [themeJson, darkThemeJson]) {
		const color = (key: string) => {
			const value = (palette.colors as any)[key];
			return (palette.vars as any)[value] ?? value;
		};
		for (const [background, foregrounds] of [
			["userMessageBg", ["userMessageText"]], ["customMessageBg", ["customMessageText"]],
			["toolSuccessBg", ["text", "toolTitle", "toolOutput", "syntaxVariable", "syntaxComment"]],
			["toolPendingBg", ["text", "toolTitle", "toolOutput"]], ["toolErrorBg", ["toolTitle", "toolOutput"]],
			["selectedBg", ["text"]], ["searchMatchBg", ["searchMatchText"]],
		] as const) {
			const bg = luminance(color(background));
			if (palette === themeJson) expect(bg).toBeGreaterThan(0.6);
			else expect(bg).toBeLessThan(0.15);
			for (const foreground of foregrounds) {
				const fg = luminance(color(foreground));
				expect((Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05), `${palette.name} ${foreground}/${background}`).toBeGreaterThanOrEqual(4.5);
			}
		}
	}
});

test("Pi's native paired theme switches on terminal events and manual choice disables auto", async () => {
	const native = await import(new URL("./modes/interactive/theme/theme.js", PI_CODING_AGENT_URL).href);
	const { InteractiveThemeController } = await import(new URL("./modes/interactive/theme/theme-controller.js", PI_CODING_AGENT_URL).href);
	const themes = [themeJson, darkThemeJson].map(palette => {
		const colors = Object.fromEntries(Object.entries(palette.colors).map(([key, value]) => [key, (palette.vars as any)[value] ?? value]));
		const theme = new Theme(colors, colors, "truecolor");
		theme.name = palette.name;
		return theme;
	});
	native.setRegisteredThemes(themes);
	let listener: ((mode: string) => void) | undefined, changes = 0;
	const notifications: boolean[] = [], errors: string[] = [];
	const controller = new InteractiveThemeController({
		onTerminalColorSchemeChange(handler: any) { listener = handler; return () => { listener = undefined; }; },
		queryTerminalColorScheme: async () => "light",
		queryTerminalBackgroundColor: async () => undefined,
		setTerminalColorSchemeNotifications(value: boolean) { notifications.push(value); },
		invalidate() {}, requestRender() {},
	}, { getSettingsManager: () => ({ getThemeSetting: () => "butler/butler-dark" }),
		showError: (error: string) => errors.push(error), onChanged: () => { changes++; } });
	try {
		await controller.applyFromSettings();
		expect(native.theme.name).toBe("butler"); expect(notifications).toEqual([true]);
		listener!("dark"); expect(native.theme.name).toBe("butler-dark");
		listener!("light"); expect(native.theme.name).toBe("butler");
		expect(changes).toBe(3); expect(errors).toEqual([]);
		controller.setThemeName("butler-dark");
		listener!("light"); expect(native.theme.name).toBe("butler-dark");
		expect(notifications).toEqual([true, false]);
	} finally {
		controller.dispose(); native.stopThemeWatcher(); native.setRegisteredThemes([]);
	}
	expect(listener).toBeUndefined();
});
