/** NONO owns one non-capturing overlay; a zero-height widget owns its disposal. */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Component, OverlayHandle, OverlayOptions, TUI, TuiMouseEvent, TuiMouseEventResult } from "@earendil-works/pi-tui";
import { nonoFrame, type NonoState } from "./nono-frames.js";

const WIDGET = "firecode-nono";
const POSITION = "firecode-nono-position";
type Position = { x: number; y: number };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const percent = (value: number): `${number}%` => `${Number((value * 100).toFixed(4))}%`;

export class NonoWidget implements Component {
	private frame = 0;
	private state: NonoState = "idle";
	private dragging: { screenX: number; screenY: number; col: number; row: number } | undefined;
	private readonly timer: ReturnType<typeof setInterval>;
	private readonly handle: OverlayHandle;
	private disposed = false;

	constructor(
		private readonly tui: TUI,
		private position: Position,
		private readonly save: (position: Position) => void,
	) {
		const self = this;
		const options: OverlayOptions = {
			nonCapturing: true,
			get width() { return tui.terminal.columns >= 18 && tui.terminal.rows >= 24 ? 17 : tui.terminal.columns >= 6 ? 5 : 1; },
			get row() { return percent(self.position.y); },
			get col() { return percent(self.position.x); },
			get margin() { return { right: tui.terminal.columns > 1 ? 1 : 0, bottom: self.bottomMargin }; },
		};
		this.handle = tui.showOverlay(this, options);
		this.timer = setInterval(() => { this.frame++; tui.requestRender(); }, 180);
		this.timer.unref?.();
	}
	private get bottomMargin(): number { return Math.min(3, Math.max(0, this.tui.terminal.rows - 1)); }
	update(state: NonoState): void { this.state = state; this.frame = 0; this.tui.requestRender(); }
	render(width: number): string[] { return nonoFrame(this.state, this.frame, width, this.tui.terminal.rows); }
	handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
		if (this.disposed) return undefined;
		if (event.type === "press" && event.button === "left") {
			const bounds = this.handle.getBounds();
			if (!bounds || event.x < 0 || event.y < 0 || event.x >= bounds.width || event.y >= bounds.height) return undefined;
			this.dragging = { screenX: event.screenX, screenY: event.screenY, col: bounds.col, row: bounds.row };
			return { handled: true, capture: true };
		}
		if (!this.dragging) return undefined;
		if (event.type === "drag" || event.type === "release") {
			const bounds = this.handle.getBounds();
			if (bounds) {
				const spanX = Math.max(0, this.tui.terminal.columns - bounds.width - (this.tui.terminal.columns > 1 ? 1 : 0));
				const spanY = Math.max(0, this.tui.terminal.rows - bounds.height - this.bottomMargin);
				this.position = {
					x: spanX ? clamp((this.dragging.col + event.screenX - this.dragging.screenX) / spanX) : this.position.x,
					y: spanY ? clamp((this.dragging.row + event.screenY - this.dragging.screenY) / spanY) : this.position.y,
				};
			}
			if (event.type === "release") { this.dragging = undefined; this.save({ ...this.position }); }
			this.tui.requestRender();
			return { handled: true };
		}
		return undefined;
	}
	invalidate(): void {}
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		clearInterval(this.timer);
		this.dragging = undefined;
		// ui.custom's done() pops the top overlay, which may belong to a menu.
		this.handle.hide();
	}
}

export function registerPet(pi: ExtensionAPI): void {
	let widget: NonoWidget | undefined;
	let ui: ExtensionContext["ui"] | undefined;
	let position: Position = { x: 1, y: 0 };
	let hidden = false;
	let state: NonoState = "idle";
	let settle: ReturnType<typeof setTimeout> | undefined;
	const save = (next: Position) => { position = next; pi.appendEntry(POSITION, next); };
	const mount = () => {
		if (!ui) return;
		ui.setWidget(WIDGET, undefined);
		widget = undefined;
		ui.setWorkingVisible(hidden || state !== "working");
		if (hidden) return;
		ui.setWidget(WIDGET, (tui) => {
			const pet = new NonoWidget(tui, position, save);
			widget = pet;
			pet.update(state);
			// Lifecycle anchor only: no extra content or space in the editor layout.
			return { render: () => [], invalidate() {}, dispose: () => pet.dispose() };
		}, { placement: "belowEditor" });
	};
	const update = (ctx: ExtensionContext, next: NonoState) => {
		if (ctx.mode !== "tui") return;
		clearTimeout(settle);
		ui = ctx.ui;
		state = next;
		widget?.update(state);
		ui.setWorkingVisible(hidden || state !== "working");
	};
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		clearTimeout(settle);
		ui = ctx.ui;
		state = "idle";
		position = { x: 1, y: 0 };
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type !== "custom" || entry.customType !== POSITION) continue;
			const data = entry.data as { x?: unknown; y?: unknown } | undefined;
			if (typeof data?.x === "number" && Number.isFinite(data.x) && typeof data.y === "number" && Number.isFinite(data.y))
				position = { x: clamp(data.x), y: clamp(data.y) };
		}
		mount();
	});
	pi.on("agent_start", (_event, ctx) => update(ctx, "working"));
	pi.on("agent_end", (event, ctx) => {
		if (ctx.mode !== "tui") return;
		const last = [...event.messages].reverse().find((message) => message.role === "assistant");
		const next = last?.stopReason === "error" ? "error" : last?.stopReason === "aborted" ? "idle" : "done";
		update(ctx, next);
		if (next === "done") {
			settle = setTimeout(() => update(ctx, "idle"), 1800);
			settle.unref?.();
		}
	});
	pi.on("session_shutdown", () => {
		clearTimeout(settle);
		ui?.setWidget(WIDGET, undefined);
		widget = undefined;
		ui?.setWorkingVisible(true);
		ui = undefined;
	});
	pi.registerCommand("nono", {
		description: "NONO：show / hide / top-right / top-left / center（全屏模式可鼠标拖动）",
		handler: async (args, ctx) => {
			if (ctx.mode !== "tui") return;
			const command = args.trim() || "show";
			const spots: Record<string, Position> = { "top-right": { x: 1, y: 0 }, right: { x: 1, y: 0 }, "top-left": { x: 0, y: 0 }, left: { x: 0, y: 0 }, center: { x: 0.5, y: 0.5 } };
			if (command !== "show" && command !== "hide" && !Object.hasOwn(spots, command)) {
				ctx.ui.notify("用法：/nono show|hide|top-right|top-left|center", "info");
				return;
			}
			ui = ctx.ui;
			hidden = command === "hide";
			if (Object.hasOwn(spots, command)) save(spots[command]);
			mount();
		},
	});
}
