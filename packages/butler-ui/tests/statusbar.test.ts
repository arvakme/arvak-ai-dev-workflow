import { afterAll, expect, test } from "bun:test";
import { cleanupButlerUIModules, loadButlerUIModule, PI_TUI_URL, PI_CODING_AGENT_URL } from "./loader.ts";
import palette from "../themes/butler.json";
const { visibleWidth } = await import(PI_TUI_URL);
const { Theme } = await import(PI_CODING_AGENT_URL);
afterAll(cleanupButlerUIModules);
const plain = (s: string) => s.replace(/\x1b\[[\d;]*m/g, "");
test("three-row footer matches Claude labels, used-percent direction, cache and context bar at all widths", async () => {
	const { renderFooter } = await loadButlerUIModule("statusbar/render.ts");
	const colors = Object.fromEntries(Object.entries(palette.colors).map(([k, v]) => [k, (palette.vars as any)[v] ?? v]));
	const theme = new Theme(colors, colors, "truecolor");
	const now = Date.parse("2026-09-17T10:00:00Z");
	const state = { model: "claude-fable-5-1", thinking: "low", branch: "main", contextWindow: 250000,
		context: { tokens: 50000, contextWindow: 250000, percent: 20 }, cache: 80,
		quota: { state: "ready", windows: [{ label: "5h", remaining: 81, resetsAt: now + 3600000 }, { label: "7d", remaining: 53 }, { label: "Fable", remaining: 65 }] },
		speeds: { input: 50, output: 10, total: 60 }, sessionId: "12345678-abcd-4321-9876-123456789abc" };
	const render = (renderFooter as any);
	const full = render(theme, state, 160, now).map(plain);
	expect(full[0]).toContain("Fable 5.1 \\ Thinking: low \\ Git: main \\ Context: [███░░░░░░░░░░░░░] 50k/250k (20%)");
	expect(full[1]).toBe("Cache Hit: 80% \\ Fable: 35% \\ Weekly: 47% \\ Reset: 1h 0m");
	expect(full[2]).toContain("In: 50.0 t/s \\ Out: 10.0 t/s \\ Total: 60.0 t/s \\ Session ID: 12345678");
	for (const width of [0, 1, 8, 20, 40, 60, 80, 100, 160]) {
		const lines = render(theme, state, width, now); expect(lines).toHaveLength(3);
		expect(lines.every((line: string) => visibleWidth(line) <= width)).toBeTrue();
	}
	const empty = render(theme, { ...state, context: undefined, quota: undefined, cache: undefined, speeds: undefined }, 160, now).map(plain);
	expect(empty[0]).toContain("?/250k (?)");
	expect(plain(render(theme, { ...state, context: { tokens: 0, contextWindow: 250000, percent: 0 } }, 160, now)[0])).toContain("0/250k (0%)");
	expect(empty[1]).toBe("Cache Hit: n/a");
	expect(empty[2]).toContain("Out: —");
});
