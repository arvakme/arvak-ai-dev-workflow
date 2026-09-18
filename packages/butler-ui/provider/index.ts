/** Provider/request hooks are loaded separately from the Butler UI extension. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig } from "../config.js";
import { registerClaudeSub } from "./claude-sub.js";
import { registerOpenAINative } from "./openai-native/index.js";

export default function butlerProviders(pi: ExtensionAPI): void {
	const { config } = loadConfig();
	if (config.features.claudeSub !== false) registerClaudeSub(pi);
	if (config.features.openaiNative !== false) registerOpenAINative(pi);
}
