import { afterEach, expect, test } from "bun:test";
import { NonoWidget, registerPet } from "../session/pet.ts";
import { nonoFrame } from "../session/nono-frames.ts";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const clean of cleanups.splice(0)) clean(); });
const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

function setup(mode = "tui") {
	const handlers = new Map<string, (event: any, ctx: any) => void>();
	const commands = new Map<string, any>();
	const positions: any[] = [];
	const entries: any[] = [];
	let widget: NonoWidget | undefined;
	let workingVisible = true;
	const tui = { terminal: { rows: 30 }, requestRender() {} };
	const ctx = {
		mode, sessionManager: { getEntries: () => entries },
		ui: {
			setWorkingVisible(value: boolean) { workingVisible = value; },
			setWidget(_key: string, factory: any) { widget?.dispose(); widget = factory?.(tui); },
			notify() {},
		},
	};
	registerPet({
		on(name: string, handler: any) { handlers.set(name, handler); },
		registerCommand(name: string, command: any) { commands.set(name, command); },
		appendEntry(type: string, data: any) { positions.push({ type, data }); },
	} as any);
	const emit = (name: string, event: any = {}) => handlers.get(name)!(event, ctx);
	cleanups.push(() => emit("session_shutdown"));
	return { emit, ctx, positions, entries, commands, get widget() { return widget; }, get workingVisible() { return workingVisible; } };
}

test("NONO stays above the editor while idle and across turns, then disposes on shutdown", () => {
	const pet = setup();
	pet.emit("session_start");
	const widget = pet.widget;
	expect(widget).toBeDefined();
	expect(pet.workingVisible).toBeTrue();
	pet.emit("agent_start");
	expect(pet.widget).toBe(widget);
	expect(pet.workingVisible).toBeFalse();
	pet.emit("agent_end", { messages: [{ role: "assistant", stopReason: "stop" }] });
	expect(pet.widget).toBe(widget);
	expect(pet.workingVisible).toBeTrue();
	pet.emit("session_shutdown");
	expect(pet.widget).toBeUndefined();
});

test("frames stay within narrow terminals and keep a stable height while bobbing and blinking", () => {
	for (const state of ["idle", "working", "done", "error"] as const)
		for (const width of [0, 1, 4, 5, 16, 17, 80])
			for (let frame = 0; frame < 33; frame++) {
				const lines = nonoFrame(state, frame, width, 30);
				expect(lines.every((line) => [...plain(line)].length <= width)).toBeTrue();
				expect(lines.length).toBe(width === 0 ? 0 : width < 17 ? 1 : 6);
				expect(lines.join("")).not.toContain("undefined");
			}
	expect(nonoFrame("idle", 0, 80)).not.toEqual(nonoFrame("idle", 8, 80));
	expect(nonoFrame("idle", 0, 80)).not.toEqual(nonoFrame("idle", 30, 80));
	expect(nonoFrame("idle", 0, 80, 15)).toHaveLength(1);
});

test("horizontal dragging captures only the pet, clamps to the viewport and persists on release", () => {
	const positions: number[] = [];
	const widget = new NonoWidget({ terminal: { rows: 30 }, requestRender() {} } as any, 0.5, (value) => positions.push(value));
	cleanups.push(() => widget.dispose());
	widget.render(80);
	const mouse = (type: string, x: number) => ({ type, button: "left", x, y: 2, screenX: x, screenY: 2, width: 80, height: 6, shift: false, alt: false, ctrl: false }) as any;
	expect(widget.handleMouse(mouse("press", 0))).toBeUndefined();
	expect(widget.handleMouse(mouse("press", 35))).toEqual({ handled: true, capture: true });
	widget.handleMouse(mouse("drag", 999));
	expect(positions).toEqual([]);
	widget.handleMouse(mouse("release", 999));
	expect(positions).toEqual([1]);
	expect(widget.render(80).every((line) => plain(line).length <= 80)).toBeTrue();
	expect(widget.render(8).every((line) => plain(line).length <= 8)).toBeTrue();
});

test("show/hide and keyboard positioning preserve working feedback and session position", async () => {
	const pet = setup();
	pet.entries.push({ type: "custom", customType: "firecode-nono-position", data: { fraction: 1 } });
	pet.emit("session_start");
	expect(plain(pet.widget!.render(80)[1]).startsWith(" ".repeat(63))).toBeTrue();
	pet.emit("agent_start");
	await pet.commands.get("nono").handler("hide", pet.ctx);
	expect(pet.widget).toBeUndefined();
	expect(pet.workingVisible).toBeTrue();
	await pet.commands.get("nono").handler("left", pet.ctx);
	expect(pet.positions.at(-1).data.fraction).toBe(0);
	expect(pet.widget).toBeDefined();
	expect(pet.workingVisible).toBeFalse();
});

test("headless sessions create no widget, and errors remain visible until the next turn", () => {
	const headless = setup("rpc");
	headless.emit("session_start");
	headless.emit("agent_start");
	expect(headless.widget).toBeUndefined();
	const pet = setup();
	pet.emit("session_start");
	pet.emit("agent_end", { messages: [{ role: "assistant", stopReason: "error" }] });
	expect(pet.widget!.render(80).join("")).toContain("255;162;92");
	pet.emit("agent_start");
	expect(pet.widget!.render(80).join("")).not.toContain("255;162;92");
});
