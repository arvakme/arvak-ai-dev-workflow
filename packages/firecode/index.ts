/** FireCode：Pi 的界面、请求配置和NONO 终端挂件；Agent 调度只属于 Seedmux。 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type Feature, loadConfig } from "./config.js";
import { registerHeader } from "./header.js";
import { registerClaudeSub } from "./provider/claude-sub.js";
import { registerOpenAINative } from "./provider/openai-native/index.js";
import { registerPresets } from "./session/presets.js";
import { registerHerdrDisplay } from "./session/herdr-display.js";
import { registerSessionName } from "./session/rename.js";
import { registerStats } from "./session/stats.js";
import { registerPet } from "./session/pet.js";
import { registerStatusBar } from "./statusbar/index.js";
import { registerToolRendering } from "./tools/index.js";

const REGISTRARS: Record<Feature, (pi: ExtensionAPI) => void> = {
	header: registerHeader,
	tools: registerToolRendering,
	presets: registerPresets,
	rename: registerSessionName,
	stats: registerStats,
	claudeSub: registerClaudeSub,
	openaiNative: registerOpenAINative,
	pet: registerPet,
	statusbar: registerStatusBar,
};

export function registerFirecode(pi: ExtensionAPI): void {
	const { config, problems } = loadConfig();
	for (const [feature, register] of Object.entries(REGISTRARS)) {
		if (config.features[feature as Feature] !== false) register(pi);
	}
	registerHerdrDisplay(pi);

	if (problems.length === 0) return;
	pi.on("session_start", (_event, ctx) => {
		ctx.ui.notify(`FireCode 配置有问题：${problems.join("；")}`, "warning");
	});
}

export default function firecode(pi: ExtensionAPI): void {
	registerFirecode(pi);
}
