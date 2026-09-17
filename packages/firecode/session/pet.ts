/** 常驻 aboveEditor 的 NONO 小挂件。仅绘制本会话状态；Agent 调度归 Seedmux。 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Component, TUI, TuiMouseEvent, TuiMouseEventResult } from "@earendil-works/pi-tui";
import { nonoFrame, type NonoState } from "./nono-frames.js";

const WIDGET = "firecode-nono";
const POSITION = "firecode-nono-position";

export class NonoWidget implements Component {
	private frame = 0;
	private state: NonoState = "idle";
	private offset = 0;
	private artWidth = 0;
	private width = 0;
	private dragging: { screenX: number; offset: number } | undefined;
	private readonly timer: ReturnType<typeof setInterval>;

	constructor(
		private readonly tui: TUI,
		private fraction: number,
		private readonly save: (fraction: number) => void,
	) {
		this.timer = setInterval(() => { this.frame++; tui.requestRender(); }, 180);
		this.timer.unref?.();
	}

	update(state: NonoState): void { this.state = state; this.frame = 0; this.tui.requestRender(); }
	move(fraction: number): void {
		this.fraction = Math.max(0, Math.min(1, fraction));
		this.save(this.fraction);
		this.tui.requestRender();
	}
	render(width: number): string[] {
		this.width = Math.max(0, width);
		const rows = this.tui.terminal.rows;
		this.artWidth = width >= 17 && rows >= 24 ? 17 : width >= 5 ? 5 : width > 0 ? 1 : 0;
		this.offset = Math.round(Math.max(0, width - this.artWidth) * this.fraction);
		return nonoFrame(this.state, this.frame, width, rows).map((line) => " ".repeat(this.offset) + line);
	}
	handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
		if (event.type === "press" && event.button === "left" && event.x >= this.offset && event.x < this.offset + this.artWidth) {
			this.dragging = { screenX: event.screenX, offset: this.offset };
			return { handled: true, capture: true };
		}
		if (!this.dragging) return undefined;
		if (event.type === "drag") {
			const span = Math.max(0, this.width - this.artWidth);
			this.fraction = span ? Math.max(0, Math.min(1, (this.dragging.offset + event.screenX - this.dragging.screenX) / span)) : 0.5;
			return { handled: true };
		}
		if (event.type === "release") {
			this.dragging = undefined;
			this.save(this.fraction);
			return { handled: true };
		}
		return undefined;
	}
	invalidate(): void {}
	dispose(): void { clearInterval(this.timer); }
}

export function registerPet(pi: ExtensionAPI): void {
	let widget: NonoWidget | undefined;
	let ui: ExtensionContext["ui"] | undefined;
	let fraction = 0.5;
	let hidden = false;
	let state: NonoState = "idle";
	let settle: ReturnType<typeof setTimeout> | undefined;
	const save = (next: number) => {
		fraction = next;
		pi.appendEntry(POSITION, { fraction });
	};
	const mount = () => {
		if (!ui) return;
		widget?.dispose();
		widget = undefined;
		ui.setWorkingVisible(hidden || state !== "working");
		if (hidden) ui.setWidget(WIDGET, undefined);
		else ui.setWidget(WIDGET, (tui) => {
			widget = new NonoWidget(tui, fraction, save);
			widget.update(state);
			return widget;
		}, { placement: "aboveEditor" });
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
		fraction = 0.5;
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type !== "custom" || entry.customType !== POSITION) continue;
			const data = entry.data as { fraction?: unknown } | undefined;
			if (typeof data?.fraction === "number" && Number.isFinite(data.fraction))
				fraction = Math.max(0, Math.min(1, data.fraction));
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
		widget?.dispose();
		widget = undefined;
		ui?.setWidget(WIDGET, undefined);
		ui?.setWorkingVisible(true);
		ui = undefined;
	});
	pi.registerCommand("nono", {
		description: "NONO：show / hide / left / center / right（支持鼠标的终端可左右拖动）",
		handler: async (args, ctx) => {
			if (ctx.mode !== "tui") return;
			const command = args.trim() || "show";
			if (!["show", "hide", "left", "center", "right"].includes(command)) {
				ctx.ui.notify("用法：/nono show|hide|left|center|right", "info");
				return;
			}
			ui = ctx.ui;
			hidden = command === "hide";
			if (["left", "center", "right"].includes(command)) save({ left: 0, center: 0.5, right: 1 }[command]!);
			mount();
		},
	});
}
