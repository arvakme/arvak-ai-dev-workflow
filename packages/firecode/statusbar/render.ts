/** Three compact ccstatusline-style rows, using Pi-owned data and the selected theme. */
import type { ThemeColor } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { clip, formatModelName, formatTokens } from "../format.js";
import { cacheColor, contextColor, quotaColor } from "../theme.js";
import type { QuotaStatus, QuotaWindow } from "./quota-parse.js";
import type { Speeds } from "./metrics.js";

type Palette = { fg(color: ThemeColor, text: string): string; bold(text: string): string };
export type FooterState = {
	model?: string;
	thinking?: string;
	fast?: boolean;
	branch?: string | null;
	context?: { tokens: number | null; contextWindow: number; percent: number | null };
	contextWindow: number;
	cache?: number;
	quota?: QuotaStatus;
	speeds?: Speeds;
	sessionId: string;
};
export function displayModel(id?: string): string {
	const name = formatModelName(id);
	const claude = /^claude-(fable|opus|sonnet|haiku)-(\d+)(?:-(\d+))?$/i.exec(name);
	if (!claude) return name;
	return `${claude[1][0].toUpperCase()}${claude[1].slice(1)} ${claude[2]}${claude[3] ? `.${claude[3]}` : ""}`;
}
function resetText(window: QuotaWindow | undefined, now: number): string {
	if (!window?.resetsAt || !Number.isFinite(window.resetsAt)) return "";
	const minutes = Math.ceil(Math.max(0, window.resetsAt - now) / 60_000);
	if (minutes === 0) return "Reset: now";
	const hours = Math.floor(minutes / 60);
	return `Reset: ${hours ? `${hours}h ` : ""}${minutes % 60}m`;
}
function fit(candidates: string[][], width: number, separator: string): string {
	if (width <= 0) return "";
	const lines = candidates.map(parts => parts.filter(Boolean).join(separator));
	return lines.find(line => visibleWidth(line) <= width) ?? clip(lines.at(-1) ?? "", width, "end");
}
function context(theme: Palette, state: FooterState, barWidth: number): string {
	const percent = state.context?.percent;
	const valid = percent != null && Number.isFinite(percent);
	const used = state.context?.tokens;
	const window = state.context?.contextWindow ?? state.contextWindow;
	const numeric = valid ? Math.max(0, Math.min(100, percent)) : 0;
	const filled = Math.round(numeric * barWidth / 100);
	const bar = valid && barWidth ? `[${"█".repeat(filled)}${"░".repeat(barWidth - filled)}] ` : "";
	const detail = barWidth ? `${used != null ? used === 0 ? "0" : formatTokens(used) : "?"}/${window > 0 ? formatTokens(window) : "?"} ` : "";
	return theme.fg(contextColor(valid ? numeric : undefined), `Context: ${bar}${detail}(${valid ? `${Math.round(numeric)}%` : "?"})`);
}
function speed(value: number | undefined): string {
	if (value === undefined || !Number.isFinite(value)) return "—";
	return value >= 1000 ? `${(value / 1000).toFixed(1)}k t/s` : `${value.toFixed(1)} t/s`;
}
export function renderFooter(theme: Palette, state: FooterState, width: number, now = Date.now()): string[] {
	const separator = theme.fg("borderMuted", " \\ ");
	const model = theme.fg("accent", displayModel(state.model));
	const thinking = state.thinking ? theme.fg("muted", `Thinking: ${state.thinking}`) : "";
	const branch = state.branch ? theme.fg("muted", `Git: ${state.branch}`) : "";
	const fast = state.fast ? theme.fg("warning", "fast") : "";
	const first = fit([
		[model, thinking, fast, branch, context(theme, state, 16)],
		[model, thinking, branch, context(theme, state, 8)],
		[model, thinking, context(theme, state, 0)],
		[model, context(theme, state, 0)],
		[context(theme, state, 0)],
	], width, separator);
	const cache = theme.fg(state.cache === undefined ? "dim" : cacheColor(state.cache), `Cache Hit: ${state.cache === undefined ? "n/a" : `${Math.round(state.cache)}%`}`);
	const windows = state.quota?.state === "ready" ? state.quota.windows : [];
	const usage = (window: QuotaWindow) => theme.fg(quotaColor(window.remaining), `${window.label === "7d" ? "Weekly" : window.label === "30d" ? "Monthly" : window.label}: ${Math.round(100 - window.remaining)}%`);
	const scoped = ["Sonnet", "Opus", "Fable"].flatMap(label => windows.filter(w => w.label === label).map(usage));
	const general = windows.filter(w => !["Sonnet", "Opus", "Fable", "5h"].includes(w.label)).map(usage);
	const pending = state.quota?.state === "loading" ? theme.fg("dim", "Usage: …") : state.quota?.state === "unavailable" ? theme.fg("dim", "Usage: —") : "";
	const resetLabel = resetText(windows.find(w => w.label === "5h"), now);
	const reset = resetLabel ? theme.fg("accent", resetLabel) : "";
	const second = fit([[cache, ...scoped, ...general, pending, reset], [cache, ...general, pending, reset], [cache, ...general, pending], [...general, pending, cache]], width, separator);
	const input = theme.fg("muted", `In: ${speed(state.speeds?.input)}`);
	const output = theme.fg("accent", `Out: ${speed(state.speeds?.output)}`);
	const total = theme.fg("muted", `Total: ${speed(state.speeds?.total)}`);
	const session = theme.fg("dim", `Session ID: ${state.sessionId}`);
	const short = theme.fg("dim", `Session: ${state.sessionId.length > 8 ? `${state.sessionId.slice(0, 8)}…` : state.sessionId}`);
	const third = fit([[input, output, total, session], [input, output, total, short], [output, total, short], [output, short], [short]], width, separator);
	return [first, second, third].map(line => theme.bold(line));
}
