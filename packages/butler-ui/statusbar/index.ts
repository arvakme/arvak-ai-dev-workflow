/** Claude-style footer: model/context, cache/usage/reset, session-average speed/session ID. */
import { join } from "node:path";
import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent";
import { fileQuotaCache } from "./quota-cache.js";
import { registerQuota } from "./quota.js";
import type { QuotaStatus } from "./quota-parse.js";
import { latestCacheHitPercent, sessionSpeeds, type Speeds } from "./metrics.js";
import { renderFooter } from "./render.js";

export function registerStatusBar(pi: ExtensionAPI): void {
	let quota: QuotaStatus | undefined;
	let requestRender = () => {};
	registerQuota(pi, status => { quota = status; requestRender(); }, fileQuotaCache(join(getAgentDir(), "tmp")));
	pi.on("message_end", event => { if (event.message.role === "assistant") requestRender(); });
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setFooter((tui, theme, footerData) => {
			requestRender = () => tui.requestRender();
			const unsubscribe = footerData.onBranchChange(requestRender);
			let initialized = false, leaf: string | null = null;
			let cache: number | undefined, speeds: Speeds | undefined;
			return {
				dispose: unsubscribe,
				invalidate() {},
				render(width: number): string[] {
					const nextLeaf = ctx.sessionManager.getLeafId();
					if (!initialized || leaf !== nextLeaf) {
						const entries = ctx.sessionManager.getBranch();
						cache = latestCacheHitPercent(entries); speeds = sessionSpeeds(entries);
						leaf = nextLeaf; initialized = true;
					}
					return renderFooter(theme, {
						model: ctx.model?.id,
						thinking: ctx.model?.reasoning ? pi.getThinkingLevel() : undefined,
						fast: footerData.getExtensionStatuses().has("pi-openai-native-fast"),
						branch: footerData.getGitBranch(), context: ctx.getContextUsage(),
						contextWindow: ctx.model?.contextWindow ?? 0,
						cache, speeds, quota, sessionId: ctx.sessionManager.getSessionId(),
					}, width);
				},
			};
		});
	});
	pi.on("thinking_level_select", () => requestRender());
	pi.on("session_shutdown", (_event, ctx) => {
		requestRender = () => {};
		if (ctx.mode === "tui") ctx.ui.setFooter(undefined);
	});
}
