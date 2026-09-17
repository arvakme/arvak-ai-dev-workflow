/** 供应商用量响应 → 剩余百分比窗口。响应结构不是公开契约，解析一律容错。 */

type JsonRecord = Record<string, unknown>;

export type QuotaWindow = {
	label: string;
	remaining: number;
	/** Milliseconds since epoch; absent when the provider does not report a reset. */
	resetsAt?: number;
};

export type QuotaStatus =
	| { state: "loading" }
	| { state: "ready"; windows: QuotaWindow[] }
	| { state: "unavailable" };

export const record = (value: unknown): JsonRecord | undefined =>
	typeof value === "object" && value !== null ? (value as JsonRecord) : undefined;

export const finiteNumber = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** 秒级时间戳或 ISO 字符串 → 毫秒时间戳。 */
export const epochMillis = (value: unknown): number | undefined => {
	if (typeof value === "number" && Number.isFinite(value)) return value * 1_000;
	if (typeof value !== "string") return undefined;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const remainingPercent = (used: number) =>
	Math.round(Math.max(0, Math.min(100, 100 - used)));

function windowFromUsage(
	label: string,
	value: unknown,
	usedKey: string,
	resetKey = "resets_at",
): QuotaWindow | undefined {
	const used = finiteNumber(record(value)?.[usedKey]);
	const resetsAt = epochMillis(record(value)?.[resetKey]);
	return used === undefined ? undefined : { label, remaining: remainingPercent(used), ...(resetsAt !== undefined ? { resetsAt } : {}) };
}

const defined = (window: QuotaWindow | undefined): window is QuotaWindow =>
	Boolean(window);

export function parseOpenAIQuota(value: unknown): QuotaWindow[] {
	const rateLimit = record(record(value)?.rate_limit);
	const primary = record(rateLimit?.primary_window);
	const secondary = record(rateLimit?.secondary_window);
	const label = (window: JsonRecord | undefined, fallback: string) => {
		const seconds = finiteNumber(window?.limit_window_seconds);
		if (!seconds) return fallback;
		if (seconds % 86_400 === 0) return `${seconds / 86_400}d`;
		if (seconds % 3_600 === 0) return `${seconds / 3_600}h`;
		return fallback;
	};
	return [
		windowFromUsage(label(primary, "5h"), primary, "used_percent", "reset_at"),
		windowFromUsage(label(secondary, "7d"), secondary, "used_percent", "reset_at"),
	].filter(defined);
}

/** Both legacy buckets and the newer scoped limits shape used by Claude Code. */
export function parseAnthropicQuota(value: unknown): QuotaWindow[] {
	const source = record(value);
	const limits = Array.isArray(source?.limits) ? source.limits.map(record).filter((v): v is JsonRecord => !!v) : [];
	const fromLimit = (label: string, limit: JsonRecord | undefined) => {
		if (!limit || ((limit.percent ?? 0) === 0 && limit.resets_at == null)) return undefined;
		return windowFromUsage(label, limit, "percent");
	};
	const weeklyModels = ["Sonnet", "Opus", "Fable"].map(label => {
		const limit = limits.find(item => {
			const name = record(record(item.scope)?.model)?.display_name;
			return item.kind === "weekly_scoped" && typeof name === "string" && name.toLowerCase().includes(label.toLowerCase());
		});
		return fromLimit(label, limit) ?? windowFromUsage(label, source?.[`seven_day_${label.toLowerCase()}`], "utilization");
	});
	return [
		windowFromUsage("5h", source?.five_hour, "utilization") ?? fromLimit("5h", limits.find(item => item.kind === "session")),
		windowFromUsage("7d", source?.seven_day, "utilization") ?? fromLimit("7d", limits.find(item => item.kind === "weekly_all")),
		...weeklyModels,
	].filter(defined);
}

export function parseGrokQuota(
	monthlyValue: unknown,
	weeklyValue: unknown,
): QuotaWindow[] {
	const monthly = record(record(monthlyValue)?.config);
	const weekly = record(record(weeklyValue)?.config);
	const monthlyLimit = finiteNumber(record(monthly?.monthlyLimit)?.val);
	const monthlyUsed = finiteNumber(record(monthly?.used)?.val);
	const monthlyWindow =
		monthlyLimit !== undefined && monthlyLimit > 0 && monthlyUsed !== undefined
			? { label: "30d", remaining: remainingPercent((monthlyUsed / monthlyLimit) * 100) }
			: undefined;
	return [
		windowFromUsage("7d", weekly, "creditUsagePercent"),
		monthlyWindow,
	].filter(defined);
}
