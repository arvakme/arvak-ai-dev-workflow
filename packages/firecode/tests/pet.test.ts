import { afterEach, expect, test } from "bun:test";
import { ButlerWidget, registerPet } from "../session/pet.ts";
import { butlerFrame } from "../session/butler-frames.ts";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const clean of cleanups.splice(0)) clean(); });
const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

function terminal() {
	const overlays: any[] = [];
	const tui = {
		terminal: { columns: 80, rows: 30 }, renders: 0, focus: "editor",
		requestRender() { this.renders++; },
		showOverlay(component: any, options: any) {
			const entry = { component, options };
			overlays.push(entry);
			if (!options.nonCapturing) tui.focus = "menu";
			return {
				hide() { const i = overlays.indexOf(entry); if (i >= 0) overlays.splice(i, 1); },
				getBounds() {
					if (!overlays.includes(entry)) return undefined;
					const width = options.width, height = component.render(width).length;
					return { width, height,
						col: Math.floor((tui.terminal.columns - width - options.margin.right) * parseFloat(options.col) / 100),
						row: Math.floor((tui.terminal.rows - height - options.margin.bottom) * parseFloat(options.row) / 100) };
				},
			};
		},
	};
	return { tui, overlays };
}
function setup(mode = "tui") {
	const handlers = new Map<string, (event: any, ctx: any) => void>();
	const commands = new Map<string, any>();
	const positions: any[] = [], entries: any[] = [];
	const { tui, overlays } = terminal();
	let anchor: any, workingVisible = true;
	const ctx = {
		mode, sessionManager: { getEntries: () => entries },
		ui: {
			setWorkingVisible(value: boolean) { workingVisible = value; },
			setWidget(_key: string, factory: any, options?: any) {
				anchor?.dispose(); anchor = factory?.(tui);
				if (anchor) expect(options.placement).toBe("belowEditor");
			}, notify() {},
		},
	};
	registerPet({
		on(name: string, handler: any) { handlers.set(name, handler); },
		registerCommand(name: string, command: any) { commands.set(name, command); },
		appendEntry(type: string, data: any) { positions.push({ type, data }); },
	} as any);
	const emit = (name: string, event: any = {}) => handlers.get(name)!(event, ctx);
	cleanups.push(() => emit("session_shutdown"));
	return { emit, ctx, positions, entries, commands, tui, overlays,
		get anchor() { return anchor; }, get widget(): ButlerWidget | undefined { return overlays[0]?.component; },
		get workingVisible() { return workingVisible; } };
}
const mouse = (type: string, screenX: number, screenY: number, x = 3, y = 2) =>
	({ type, button: "left", x, y, screenX, screenY, width: 17, height: 6, shift: false, alt: false, ctrl: false }) as any;

test("Butler floats at top-right without taking focus or editor space and stays across turns", () => {
	const pet = setup(); pet.emit("session_start");
	const widget = pet.widget;
	expect(widget).toBeDefined(); expect(pet.tui.focus).toBe("editor");
	expect(pet.anchor.render(80)).toEqual([]);
	expect(pet.overlays[0].options.col).toBe("100%"); expect(pet.overlays[0].options.row).toBe("0%");
	pet.emit("agent_start"); expect(pet.widget).toBe(widget); expect(pet.workingVisible).toBeFalse();
	pet.emit("agent_end", { messages: [{ role: "assistant", stopReason: "stop" }] });
	expect(pet.widget).toBe(widget); expect(pet.workingVisible).toBeTrue();
	pet.emit("session_shutdown"); expect(pet.widget).toBeUndefined();
});

test("frames stay within narrow terminals and keep stable height while bobbing and blinking", () => {
	for (const state of ["idle", "working", "done", "error"] as const)
		for (const width of [0, 1, 4, 5, 16, 17, 80])
			for (let frame = 0; frame < 33; frame++) {
				const lines = butlerFrame(state, frame, width, 30);
				expect(lines.every((line) => [...plain(line)].length <= width)).toBeTrue();
				expect(lines.length).toBe(width === 0 ? 0 : width < 17 ? 1 : 6);
				expect(lines.join("")).not.toContain("undefined");
			}
	expect(butlerFrame("idle", 0, 80)).not.toEqual(butlerFrame("idle", 8, 80));
	expect(butlerFrame("idle", 0, 80)).not.toEqual(butlerFrame("idle", 30, 80));
	expect(butlerFrame("idle", 0, 80, 15)).toHaveLength(1);
});

test("dragging moves both axes, clamps to viewport, persists only on release, and never focuses", () => {
	const pet = setup(); pet.emit("session_start"); const widget = pet.widget!;
	expect(widget.handleMouse(mouse("press", 0, 0, -1))).toBeUndefined();
	expect(widget.handleMouse(mouse("press", 65, 2))).toEqual({ handled: true, capture: true });
	widget.handleMouse(mouse("drag", 34, 12));
	expect(pet.positions).toEqual([]); expect(pet.overlays[0].options.col).toBe("50%");
	expect(parseFloat(pet.overlays[0].options.row)).toBeCloseTo(1000 / 21, 3);
	widget.handleMouse(mouse("release", -999, 999));
	expect(pet.positions.at(-1).data).toEqual({ x: 0, y: 1 });
	expect(pet.tui.focus).toBe("editor");
});

test("resize keeps normalized placement and collapses the sprite on small panes", () => {
	const pet = setup(); pet.emit("session_start"); const options = pet.overlays[0].options;
	expect(options.width).toBe(17);
	pet.tui.terminal.rows = 15; expect(options.width).toBe(5);
	expect(pet.widget!.render(options.width)).toHaveLength(1);
	pet.tui.terminal.columns = 1; pet.tui.terminal.rows = 1;
	expect(options.width).toBe(1); expect(options.margin).toEqual({ right: 0, bottom: 0 });
	pet.tui.terminal.columns = 100; pet.tui.terminal.rows = 40;
	expect(options.width).toBe(17); expect(options.col).toBe("100%");
});

test("hide, reload and shutdown remove only Butler, preserving menus and cancelling animation", async () => {
	const pet = setup(); pet.emit("session_start");
	const menu = { component: {}, options: {} }; pet.overlays.push(menu);
	pet.tui.focus = "menu";
	await pet.commands.get("butler").handler("hide", pet.ctx);
	expect(pet.overlays).toEqual([menu]); expect(pet.tui.focus).toBe("menu");
	const renders = pet.tui.renders;
	await new Promise((resolve) => setTimeout(resolve, 220)); expect(pet.tui.renders).toBe(renders);
	await pet.commands.get("butler").handler("show", pet.ctx);
	pet.emit("session_start"); expect(pet.overlays).toHaveLength(2);
	pet.emit("session_shutdown"); expect(pet.overlays).toEqual([menu]);
});

test("commands and session positions restore both axes and preserve hidden working feedback", async () => {
	const pet = setup();
	pet.entries.push({ type: "custom", customType: "firecode-butler-position", data: { x: 0.3, y: 0.7 } });
	pet.entries.push({ type: "custom", customType: "firecode-butler-position", data: { x: NaN, y: 1 } });
	pet.emit("session_start"); expect(pet.overlays[0].options.col).toBe("30%"); expect(pet.overlays[0].options.row).toBe("70%");
	pet.emit("agent_start"); await pet.commands.get("butler").handler("hide", pet.ctx);
	expect(pet.overlays).toHaveLength(0); expect(pet.workingVisible).toBeTrue();
	await pet.commands.get("butler").handler("top-right", pet.ctx);
	expect(pet.positions.at(-1).data).toEqual({ x: 1, y: 0 }); expect(pet.workingVisible).toBeFalse();
	await pet.commands.get("butler").handler("toString", pet.ctx);
	expect(pet.positions).toHaveLength(1);
});

test("headless sessions have no overlay; errors persist until the next turn", () => {
	const headless = setup("rpc"); headless.emit("session_start"); headless.emit("agent_start");
	expect(headless.widget).toBeUndefined();
	const pet = setup(); pet.emit("session_start");
	pet.emit("agent_end", { messages: [{ role: "assistant", stopReason: "error" }] });
	expect(pet.widget!.render(17).join("")).toContain("255;162;92");
	pet.emit("agent_start"); expect(pet.widget!.render(17).join("")).not.toContain("255;162;92");
});

test("Butler restores legacy positions and newer Butler entries take precedence", async () => {
    const pet = setup();
    pet.entries.push({ type: "custom", customType: "firecode-nono-position", data: { x: 0.2, y: 0.6 } });
    pet.emit("session_start");
    expect(pet.overlays[0].options.col).toBe("20%");
    expect(pet.overlays[0].options.row).toBe("60%");
    await pet.commands.get("butler").handler("center", pet.ctx);
    expect(pet.positions.at(-1).type).toBe("firecode-butler-position");
    pet.entries.push({ type: "custom", customType: pet.positions.at(-1).type, data: pet.positions.at(-1).data });
    pet.emit("session_start");
    expect(pet.overlays[0].options.col).toBe("50%");
    expect(pet.overlays[0].options.row).toBe("50%");
});
