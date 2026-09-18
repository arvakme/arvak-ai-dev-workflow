/** Butler owns non-capturing silhouette strips; a zero-height widget owns their disposal. */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Component, OverlayHandle, OverlayOptions, TUI, TuiMouseEvent, TuiMouseEventResult } from "@earendil-works/pi-tui";
import { BUTLER_MAX_SEGMENTS, butlerFrame, butlerSegments, type ButlerSegment, type ButlerState } from "./butler-frames.js";

// Legacy identity stays stable across package renames and Pi reloads.
const WIDGET = "firecode-butler";
const POSITION = "firecode-butler-position";
type Position = { x: number; y: number };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export class ButlerWidget implements Component {
	private frame = 0;
	private state: ButlerState = "idle";
	private dragging: { screenX: number; screenY: number; col: number; row: number; moved: boolean } | undefined;
	private timer: ReturnType<typeof setInterval> | undefined;
	private lastClick: { time: number; x: number; y: number } | undefined;
	private readonly handles: OverlayHandle[];
	private snapshot: { key: string; segments: ButlerSegment[] } | undefined;
	private disposed = false;

	constructor(
		private readonly tui: TUI,
		private position: Position,
		private readonly save: (position: Position) => void,
		private readonly onFold: (folded: boolean) => void = () => {},
		private folded = false,
	) {
		const self = this;
		this.handles = Array.from({ length: BUTLER_MAX_SEGMENTS }, (_, index) => {
			const segment = () => self.segments[index];
			const options: OverlayOptions = {
				nonCapturing: true,
				visible: () => segment() !== undefined,
				get width() { return segment()?.width ?? 1; },
				get row() { return self.bounds.row + (segment()?.row ?? 0); },
				get col() { return self.bounds.col + (segment()?.col ?? 0); },
			};
			return tui.showOverlay({
				render: () => segment() ? [segment()!.text] : [],
				invalidate() {},
				handleMouse: event => self.handleMouse(event),
			}, options);
		});
		this.syncAnimation();
	}
	private get bounds() {
		const { columns, rows } = this.tui.terminal;
		const width = this.folded ? 1 : columns >= 18 && rows >= 24 ? 17 : columns >= 6 ? 5 : 1;
		const height = width === 17 ? 6 : 1;
		return { width, height,
			col: Math.floor(Math.max(0, columns - width - (columns > 1 ? 1 : 0)) * (this.folded ? 1 : this.position.x)),
			row: this.folded ? 0 : Math.floor(Math.max(0, rows - height - this.bottomMargin) * this.position.y),
		};
	}
	private get segments(): ButlerSegment[] {
		const width = this.bounds.width, rows = this.tui.terminal.rows;
		const key = `${this.state}:${this.frame}:${width}:${rows}:${this.folded}`;
		if (this.snapshot?.key !== key)
			this.snapshot = { key, segments: butlerSegments(this.state, this.frame, width, rows, this.folded) };
		return this.snapshot.segments;
	}
	private syncAnimation(): void {
		clearInterval(this.timer);
		this.timer = undefined;
		if (!this.folded && !this.disposed) {
			this.timer = setInterval(() => { this.frame++; this.tui.requestRender(); }, 180);
			this.timer.unref?.();
		}
	}
	private click(event: TuiMouseEvent): void {
		const now = performance.now();
		if (this.folded || (this.lastClick && now - this.lastClick.time <= 350
			&& event.screenX === this.lastClick.x && event.screenY === this.lastClick.y)) {
			this.folded = !this.folded;
			this.lastClick = undefined;
			this.syncAnimation();
			this.onFold(this.folded);
		} else this.lastClick = { time: now, x: event.screenX, y: event.screenY };
	}
	private get bottomMargin(): number { return Math.min(3, Math.max(0, this.tui.terminal.rows - 1)); }
	update(state: ButlerState): void { this.state = state; this.frame = 0; this.tui.requestRender(); }
	render(width: number): string[] { return butlerFrame(this.state, this.frame, this.folded ? Math.min(this.bounds.width, width) : width, this.tui.terminal.rows, this.folded); }
	handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
		if (this.disposed) return undefined;
		if (event.type === "press" && event.button === "left") {
			const bounds = this.bounds;
			const x = event.screenX - bounds.col, y = event.screenY - bounds.row;
			if (!this.segments.some(segment => y === segment.row && x >= segment.col && x < segment.col + segment.width)) return undefined;
			this.dragging = { screenX: event.screenX, screenY: event.screenY, col: bounds.col, row: bounds.row, moved: false };
			return { handled: true, capture: true };
		}
		if (!this.dragging) return undefined;
		if (event.type === "drag" || event.type === "release") {
			const bounds = this.bounds;
			if (event.screenX !== this.dragging.screenX || event.screenY !== this.dragging.screenY) {
				this.dragging.moved = true;
				this.lastClick = undefined;
			}
			if (this.dragging.moved && !this.folded) {
				const spanX = Math.max(0, this.tui.terminal.columns - bounds.width - (this.tui.terminal.columns > 1 ? 1 : 0));
				const spanY = Math.max(0, this.tui.terminal.rows - bounds.height - this.bottomMargin);
				this.position = {
					x: spanX ? clamp((this.dragging.col + event.screenX - this.dragging.screenX) / spanX) : this.position.x,
					y: spanY ? clamp((this.dragging.row + event.screenY - this.dragging.screenY) / spanY) : this.position.y,
				};
			}
			if (event.type === "release") {
				if (this.dragging.moved) {
					if (!this.folded) this.save({ ...this.position });
				} else this.click(event);
				this.dragging = undefined;
			}
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
		for (const handle of this.handles) handle.hide();
	}
}

export function registerPet(pi: ExtensionAPI): void {
	let widget: ButlerWidget | undefined;
	let ui: ExtensionContext["ui"] | undefined;
	let position: Position = { x: 1, y: 0 };
	let hidden = false;
	let folded = false;
	let state: ButlerState = "idle";
	let settle: ReturnType<typeof setTimeout> | undefined;
	const save = (next: Position) => { position = next; pi.appendEntry(POSITION, next); };
	const mount = () => {
		if (!ui) return;
		ui.setWidget(WIDGET, undefined);
		widget = undefined;
		ui.setWorkingVisible(hidden || folded || state !== "working");
		if (hidden) return;
		ui.setWidget(WIDGET, (tui) => {
			const pet = new ButlerWidget(tui, position, save, (next) => {
				folded = next;
				ui?.setWorkingVisible(hidden || folded || state !== "working");
			}, folded);
			widget = pet;
			pet.update(state);
			// Lifecycle anchor only: no extra content or space in the editor layout.
			return { render: () => [], invalidate() {}, dispose: () => pet.dispose() };
		}, { placement: "belowEditor" });
	};
	const update = (ctx: ExtensionContext, next: ButlerState) => {
		if (ctx.mode !== "tui") return;
		clearTimeout(settle);
		ui = ctx.ui;
		state = next;
		widget?.update(state);
		ui.setWorkingVisible(hidden || folded || state !== "working");
	};
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		clearTimeout(settle);
		ui = ctx.ui;
		state = "idle";
		position = { x: 1, y: 0 };
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type !== "custom" || (entry.customType !== POSITION && entry.customType !== "firecode-nono-position")) continue;
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
	pi.registerCommand("butler", {
		description: "Butler：show / hide / top-right / top-left / center（全屏可拖动，双击收起、点 ◉ 展开）",
		handler: async (args, ctx) => {
			if (ctx.mode !== "tui") return;
			const command = args.trim() || "show";
			const spots: Record<string, Position> = { "top-right": { x: 1, y: 0 }, right: { x: 1, y: 0 }, "top-left": { x: 0, y: 0 }, left: { x: 0, y: 0 }, center: { x: 0.5, y: 0.5 } };
			if (command !== "show" && command !== "hide" && !Object.hasOwn(spots, command)) {
				ctx.ui.notify("用法：/butler show|hide|top-right|top-left|center", "info");
				return;
			}
			ui = ctx.ui;
			hidden = command === "hide";
			folded = false;
			if (Object.hasOwn(spots, command)) save(spots[command]);
			mount();
		},
	});
}
