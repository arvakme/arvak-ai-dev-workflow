import { afterEach, expect, test } from "bun:test";
import { ButlerWidget, registerPet } from "../session/pet.ts";
import { BUTLER_MAX_SEGMENTS, butlerFrame, butlerSegments } from "../session/butler-frames.ts";
import { PI_TUI_URL } from "./loader.ts";

const { TuiAltScreen } = await import(PI_TUI_URL);
const cleanups: Array<() => void> = [];
afterEach(() => { for (const clean of cleanups.splice(0)) clean(); });
const plain = (text: string) => Bun.stripANSI(text);

function terminal() {
	const device = { columns: 80, rows: 30, hideCursor() {} };
	const tui = new TuiAltScreen(device, false);
	let renders = 0;
	tui.requestRender = () => { renders++; };
	const editor = { render: () => ["input"], invalidate() {} };
	tui.setFocus(editor);
	const draw = (base = Array.from({ length: device.rows }, () => "x".repeat(device.columns))) =>
		tui.compositeOverlays(base, device.columns, device.rows);
	const mouse = (type: "press" | "drag" | "release", x: number, y: number) => {
		tui.handleMouseEvent({ button: type === "drag" ? 32 : 0, x, y, release: type === "release" });
		draw();
	};
	const click = (x = 65, y = 2) => { mouse("press", x, y); mouse("release", x, y); };
	return { tui, device, editor, draw, mouse, click, get renders() { return renders; } };
}
function setup(mode = "tui") {
	const host = terminal();
	const handlers = new Map<string, (event: any, ctx: any) => void>();
	const commands = new Map<string, any>();
	const positions: any[] = [], entries: any[] = [];
	let anchor: any, workingVisible = true;
	const ctx = {
		mode, sessionManager: { getEntries: () => entries },
		ui: {
			setWorkingVisible(value: boolean) { workingVisible = value; },
			setWidget(_key: string, factory: any, options?: any) {
				anchor?.dispose(); anchor = factory?.(host.tui);
				if (anchor) expect(options.placement).toBe("belowEditor");
			}, notify() {},
		},
	};
	registerPet({
		on(name: string, handler: any) { handlers.set(name, handler); },
		registerCommand(name: string, command: any) { commands.set(name, command); },
		appendEntry(type: string, data: any) { positions.push({ type, data }); },
	} as any);
	const emit = (name: string, event: any = {}) => { handlers.get(name)!(event, ctx); host.draw(); };
	const command = async (arg: string) => { await commands.get("butler").handler(arg, ctx); host.draw(); };
	cleanups.push(() => emit("session_shutdown"));
	return { ...host, emit, command, positions, entries, get renders() { return host.renders; },
		get anchor() { return anchor; }, get workingVisible() { return workingVisible; } };
}

test("Butler floats without editor space or focus; lifecycle controls working feedback", () => {
	const pet = setup(); pet.emit("session_start");
	const before = pet.draw();
	expect(pet.anchor.render(80)).toEqual([]); expect(pet.tui.focusedComponent).toBe(pet.editor);
	pet.emit("agent_start"); expect(pet.workingVisible).toBeFalse();
	pet.emit("agent_end", { messages: [{ role: "assistant", stopReason: "stop" }] });
	expect(pet.workingVisible).toBeTrue(); expect(pet.draw()).not.toEqual(before);
	pet.emit("session_shutdown"); expect(pet.anchor).toBeUndefined();
	expect(pet.draw().every((line: string) => line === "x".repeat(80))).toBeTrue();
});

test("every animation fits stable silhouette slots and preserves all blank cells", () => {
	for (const state of ["idle", "working", "done", "error"] as const)
		for (const width of [0, 1, 4, 5, 16, 17, 80])
			for (let frame = 0; frame < 240; frame++) {
				const lines = butlerFrame(state, frame, width, 30);
				const segments = butlerSegments(state, frame, width, 30);
				expect(segments.length).toBeLessThanOrEqual(BUTLER_MAX_SEGMENTS);
				const restored = lines.map(line => Array(plain(line).length).fill(" "));
				for (const segment of segments) {
					expect(plain(segment.text)).not.toContain(" ");
					restored[segment.row].splice(segment.col, segment.width, ...plain(segment.text));
				}
				expect(restored.map(line => line.join(""))).toEqual(lines.map(plain));
				expect(lines.every(line => plain(line).length <= width)).toBeTrue();
				expect(lines.length).toBe(width === 0 ? 0 : width < 17 ? 1 : 6);
				expect(lines.join("")).not.toContain("undefined");
			}
	expect(butlerFrame("idle", 0, 80)).not.toEqual(butlerFrame("idle", 8, 80));
	expect(butlerFrame("idle", 0, 80)).not.toEqual(butlerFrame("idle", 30, 80));
});

test("real composition preserves text outside the silhouette and ignores empty-corner clicks", () => {
	const host = terminal();
	const saved: any[] = [];
	const pet = new ButlerWidget(host.tui, { x: 1, y: 0 }, p => saved.push(p));
	cleanups.push(() => pet.dispose());
	const output = host.draw().map(plain), sprite = pet.render(17).map(plain);
	for (let y = 0; y < 30; y++) for (let x = 0; x < 80; x++) {
		const pixel = y < 6 && x >= 62 && x < 79 ? sprite[y][x - 62] : " ";
		expect(output[y][x]).toBe(pixel === " " ? "x" : pixel);
	}
	// The old rectangular hit area intercepted this empty top-left corner.
	expect(host.tui.dispatchMouseToOverlay({ type: "press", button: "left", screenX: 62, screenY: 0 }).hit).toBeFalse();
	host.mouse("press", 65, 2); host.mouse("drag", 34, 12);
	expect(saved).toEqual([]);
	host.mouse("release", -999, 999); expect(saved).toEqual([{ x: 0, y: 1 }]);
	expect(host.tui.focusedComponent).toBe(host.editor);
});

test("resize keeps normalized placement and collapses Butler on small panes", () => {
	const host = terminal();
	const pet = new ButlerWidget(host.tui, { x: 1, y: 0 }, () => {});
	cleanups.push(() => pet.dispose());
	host.device.rows = 15;
	expect(plain(host.draw()[0]).slice(74, 79)).toBe("(oxo)");
	host.device.columns = 1; host.device.rows = 1;
	expect(host.draw().map(plain)).toEqual(["◈"]);
	host.device.columns = 100; host.device.rows = 40;
	const output = host.draw().map(plain);
	expect(output[0].slice(82, 99).trim()).toContain("▀");
	expect(output.every((line: string) => line.length === 100)).toBeTrue();
});

test("hide, reload and shutdown preserve menus and cancel animation", async () => {
	const pet = setup(); pet.emit("session_start");
	const menu = { render: () => ["settings"], invalidate() {} };
	const handle = pet.tui.showOverlay(menu, { width: 20, row: 0, col: 60 });
	await pet.command("hide");
	expect(handle.getBounds()).toBeDefined(); expect(pet.tui.focusedComponent).toBe(menu);
	const renders = pet.renders;
	await new Promise(resolve => setTimeout(resolve, 220)); expect(pet.renders).toBe(renders);
	await pet.command("show"); pet.emit("session_start");
	pet.emit("session_shutdown"); expect(handle.getBounds()).toBeDefined(); expect(pet.tui.focusedComponent).toBe(menu);
	handle.hide();
});

test("positions restore both axes; commands preserve hidden working feedback", async () => {
	const pet = setup();
	pet.entries.push({ type: "custom", customType: "firecode-butler-position", data: { x: 0.3, y: 0.7 } });
	pet.entries.push({ type: "custom", customType: "firecode-butler-position", data: { x: NaN, y: 1 } });
	pet.emit("session_start");
	pet.mouse("press", 21, 16); pet.mouse("drag", 22, 17); pet.mouse("release", 22, 17);
	expect(pet.positions.at(-1).data).toEqual({ x: 19 / 62, y: 15 / 21 });
	pet.emit("agent_start"); await pet.command("hide"); expect(pet.workingVisible).toBeTrue();
	await pet.command("top-right"); expect(pet.positions.at(-1).data).toEqual({ x: 1, y: 0 });
	expect(pet.workingVisible).toBeFalse(); await pet.command("toString"); expect(pet.positions).toHaveLength(2);
});

test("headless sessions have no pet; errors persist until the next turn", () => {
	const headless = setup("rpc"); headless.emit("session_start"); headless.emit("agent_start");
	expect(headless.anchor).toBeUndefined();
	const pet = setup(); pet.emit("session_start");
	pet.emit("agent_end", { messages: [{ role: "assistant", stopReason: "error" }] });
	expect(pet.draw().join("")).toContain("255;162;92");
	pet.emit("agent_start"); expect(pet.draw().join("")).not.toContain("255;162;92");
});

test("legacy positions restore and newer Butler entries take precedence", async () => {
	const pet = setup();
	pet.entries.push({ type: "custom", customType: "firecode-nono-position", data: { x: 0.2, y: 0.6 } });
	pet.emit("session_start");
	pet.mouse("press", 15, 14); pet.mouse("drag", 16, 15); pet.mouse("release", 16, 15);
	expect(pet.positions.at(-1).data).toEqual({ x: 13 / 62, y: 13 / 21 });
	await pet.command("center"); const entry = pet.positions.at(-1);
	expect(entry.type).toBe("firecode-butler-position");
	pet.entries.push({ type: "custom", customType: entry.type, data: entry.data }); pet.emit("session_start");
	pet.click(35, 12); pet.click(35, 12); expect(plain(pet.draw()[0])[78]).toBe("◉");
});

test("double-click docks, pauses animation, and restores position and working feedback", async () => {
	const pet = setup(); pet.emit("session_start"); await pet.command("center"); pet.emit("agent_start");
	pet.click(35, 12); pet.click(35, 12);
	expect(plain(pet.draw()[0])[78]).toBe("◉"); expect(pet.workingVisible).toBeTrue();
	const renders = pet.renders;
	await new Promise(resolve => setTimeout(resolve, 220)); expect(pet.renders).toBe(renders);
	pet.emit("agent_end", { messages: [{ role: "assistant", stopReason: "error" }] });
	pet.emit("agent_start"); expect(pet.workingVisible).toBeTrue();
	pet.click(78, 0); expect(pet.workingVisible).toBeFalse();
	expect(plain(pet.draw()[12])[35]).not.toBe("x"); expect(pet.positions).toHaveLength(1);
	pet.click(35, 12); expect(plain(pet.draw()[0])[78]).toBe("x");
});

test("dragging and separate clicks do not accidentally dock Butler", async () => {
	const pet = setup(); pet.emit("session_start"); pet.click();
	pet.mouse("press", 65, 2); pet.mouse("drag", 64, 2); pet.mouse("release", 65, 2);
	pet.click(); expect(plain(pet.draw()[0])[78]).toBe("x");
	await new Promise(resolve => setTimeout(resolve, 400));
	pet.click(); expect(plain(pet.draw()[0])[78]).toBe("x");
	pet.click(70, 3); expect(plain(pet.draw()[0])[78]).toBe("x");
});

test("docking survives session mounting; show expands and hide removes all strips", async () => {
	const pet = setup(); pet.emit("session_start"); pet.click(); pet.click();
	pet.emit("session_start"); expect(plain(pet.draw()[0])[78]).toBe("◉");
	await pet.command("show"); expect(plain(pet.draw()[0])[78]).toBe("x");
	pet.click(); pet.click(); await pet.command("hide");
	expect(pet.draw().every((line: string) => line === "x".repeat(80))).toBeTrue();
	await pet.command("show"); expect(plain(pet.draw()[2])[65]).not.toBe("x");
});


test("the cyan dock occupies one cell and restores even in a one-cell terminal", () => {
	for (const [columns, rows] of [[80, 30], [3, 30], [1, 1], [80, 4]]) {
		const host = terminal(); host.device.columns = columns; host.device.rows = rows;
		const folded: boolean[] = [];
		const pet = new ButlerWidget(host.tui, { x: 0.5, y: 0.5 }, () => {}, v => folded.push(v), true);
		try {
			const output = host.draw().map(plain);
			expect(output).toHaveLength(rows);
			const col = Math.max(0, columns - 2);
			expect(output[0]).toBe("x".repeat(col) + "◉" + "x".repeat(columns - col - 1));
			expect(output.slice(1).every((line: string) => line === "x".repeat(columns))).toBeTrue();
			host.click(col, 0); expect(folded).toEqual([false]);
		} finally { pet.dispose(); }
	}
});
