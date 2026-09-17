import { expect, test } from "bun:test";
import { latestCacheHitPercent, sessionSpeeds } from "../statusbar/metrics.ts";
import { parseAnthropicQuota, parseOpenAIQuota } from "../statusbar/quota-parse.ts";
const entry = (role: string, seconds: number, usage?: any, stopReason = "stop") => ({
	type: "message", timestamp: new Date(seconds * 1000).toISOString(), message: { role, usage, stopReason },
});

test("cache hit matches Claude's read/(read+write) rather than all prompt input", () => {
	expect(latestCacheHitPercent([entry("assistant", 10, { input: 1000, cacheRead: 800, cacheWrite: 200 })])).toBe(80);
	expect(latestCacheHitPercent([entry("assistant", 10, { input: 1000 })])).toBe(0);
	expect(latestCacheHitPercent([])).toBeUndefined();
	expect(latestCacheHitPercent([entry("assistant", 10, { cacheRead: 100 }), entry("assistant", 20, {}, "error")])).toBe(100);
});

test("session speeds merge tool-loop intervals, exclude user idle gaps and can be rebuilt after resume", () => {
	const entries = [entry("user", 0), entry("assistant", 2, { input: 100, output: 20, cacheRead: 5000 }),
		entry("toolResult", 3), entry("assistant", 4, { input: 100, output: 20 }),
		entry("user", 100), entry("assistant", 102, { input: 100, output: 20 })];
	expect(sessionSpeeds(entries)).toEqual({ input: 50, output: 10, total: 60 });
	expect(sessionSpeeds(JSON.parse(JSON.stringify(entries)))).toEqual(sessionSpeeds(entries));
	expect(sessionSpeeds([entry("assistant", 10, { input: 500, output: 100 })])).toBeUndefined();
	expect(sessionSpeeds([entry("user", 10), entry("assistant", 10, { input: 500 })])).toBeUndefined();
	expect(sessionSpeeds([...entries, entry("assistant", 500, { input: 99999 }, "error")])).toEqual(sessionSpeeds(entries));
});

test("legacy and scoped Anthropic quotas retain reset time without inventing missing model buckets", () => {
	const reset = "2026-09-17T12:00:00Z";
	const parsed = parseAnthropicQuota({ five_hour: { utilization: 19, resets_at: reset }, seven_day: { utilization: 47 },
		seven_day_sonnet: { utilization: 12 }, seven_day_opus: null,
		limits: [{ kind: "weekly_scoped", scope: { model: { display_name: "Claude Fable" } }, percent: 35, resets_at: reset }] });
	expect(parsed).toEqual([{ label: "5h", remaining: 81, resetsAt: Date.parse(reset) }, { label: "7d", remaining: 53 },
		{ label: "Sonnet", remaining: 88 }, { label: "Fable", remaining: 65, resetsAt: Date.parse(reset) }]);
	expect(parseAnthropicQuota({ limits: [
		{ kind: "session", percent: 25, resets_at: reset }, { kind: "weekly_all", percent: 10, resets_at: reset },
		{ kind: "weekly_scoped", scope: { model: { display_name: "Opus" } }, percent: 0, resets_at: null },
	] }).map(w => w.label)).toEqual(["5h", "7d"]);
	expect(parseOpenAIQuota({ rate_limit: { primary_window: { used_percent: 25, reset_at: 1000 } } })[0].resetsAt).toBe(1000000);
});
