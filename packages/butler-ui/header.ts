/** Butler Code wordmark; leaves the top-right corner to the pet. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { clip } from "./format.js";

export function registerHeader(pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setHeader((_tui, theme) => ({
			invalidate() {},
			render(width: number): string[] {
				const available = Math.max(0, width - (width >= 40 ? 20 : 0));
				const title = `${theme.fg("borderAccent", "◈")}  ${theme.bold(theme.fg("accent", "Butler Code"))}`;
				const subtitle = theme.fg("muted", "think · build · explore");
				return [clip(title, available, "end", ""), clip(subtitle, available, "end", ""), ""];
			},
		}));
	});
}
