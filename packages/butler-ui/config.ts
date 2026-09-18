/** Butler UI 配置：读取 Pi Agent 目录下的 `extensions/butler-ui/config.jsonc`。 */
import { existsSync, readFileSync } from "node:fs";
import { resolveConfigPath } from "./config-migration.js";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { parseJsonc } from "./jsonc.js";

export type ThinkingLevelValue =
	| "off"
	| "minimal"
	| "low"
	| "medium"
	| "high"
	| "xhigh"
	| "max";

/**
 * 模型原子：配置里一律写作 "provider/model/thinking"，解析后拆成运行时模型 id 与思考档。
 * 全仓库指定模型与思考档的唯一形状。
 */
export interface ModelAtom {
	model: string;
	thinking: ThinkingLevelValue;
}

export interface Preset {
	model?: ModelAtom;
	tools?: string[];
	instructions?: string;
	/** 一键切换，如 alt+1；不填则无快捷键 */
	key?: string;
}

export const FEATURES = [
	"header",
	"statusbar",
	"tools",
	"presets",
	"rename",
	"stats",
	"claudeSub",
	"openaiNative",
	"pet",
] as const;

export type Feature = (typeof FEATURES)[number];

export const DEFAULT_KEYS = {
	rename: "ctrl+r",
	cyclePreset: "ctrl+shift+u",
	fast: "ctrl+f",
} as const;

export type ButlerUIKeys = {
	rename: string;
	cyclePreset: string;
	fast: string;
};

export interface ButlerUIConfig {
	features: Partial<Record<Feature, boolean>>;
	keys: ButlerUIKeys;
	presets: Record<string, Preset>;
}

export type LoadedConfig = {
	config: ButlerUIConfig;
	problems: string[];
};

const resolvedConfig = resolveConfigPath(getAgentDir());
export const CONFIG_PATH = resolvedConfig.path;

function readFile(problems: string[]): Record<string, unknown> {
	if (!existsSync(CONFIG_PATH)) {
		problems.push("config.jsonc 不存在，已关闭可选功能");
		return { features: Object.fromEntries(FEATURES.map((feature) => [feature, false])) };
	}
	try {
		const parsed: unknown = parseJsonc(readFileSync(CONFIG_PATH, "utf8"));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			problems.push("config.jsonc 顶层必须是对象");
			return {};
		}
		return parsed as Record<string, unknown>;
	} catch (error) {
		// 统一前缀：文件级故障必须能被调用方识别并阻断功能，
		// 不能因为消息文本不带节名就被当成无关问题过滤掉。
		const message = error instanceof Error ? error.message : String(error);
		problems.push(`config.jsonc 解析失败：${message}`);
		return {};
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

/** 嵌套对象也做键白名单：拼写错误必须报出来，不能静默回退默认值。 */
function rejectUnknownKeys(
	record: Record<string, unknown>,
	allowed: readonly string[],
	field: string,
	problems: string[],
) {
	for (const key of Object.keys(record))
		if (!allowed.includes(key)) problems.push(`未知字段 ${field}.${key}`);
}

function stringValue(value: unknown, field: string, problems: string[]): string | undefined {
	if (typeof value === "string" && value) return value;
	problems.push(`${field} 必须是非空字符串`);
	return undefined;
}

function stringArray(value: unknown, field: string, problems: string[]): string[] {
	if (value === undefined) return [];
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) {
		problems.push(`${field} 必须是非空字符串数组`);
		return [];
	}
	return [...new Set(value)];
}

function checkFeatures(features: Record<string, unknown>, problems: string[]): void {
	for (const [key, value] of Object.entries(features)) {
		if (!FEATURES.includes(key as Feature)) {
			problems.push(`未知开关 features.${key}，可用：${FEATURES.join(" / ")}`);
			continue;
		}
		// 开关只能是布尔：写成字符串 "false" 时因为 `!== false` 仍会启用，
		// 不能把类型错误当成用户授权启用功能。
		if (typeof value !== "boolean")
			problems.push(`features.${key} 必须是 true 或 false`);
	}
}

function checkKeys(keys: ButlerUIKeys, presets: Record<string, Preset>, problems: string[]): void {
	const owners = new Map<string, string>([
		[keys.rename, "keys.rename"],
		[keys.cyclePreset, "keys.cyclePreset"],
		[keys.fast, "keys.fast"],
	]);
	const declared = Object.entries(keys);
	for (let index = 0; index < declared.length; index++) {
		for (let other = index + 1; other < declared.length; other++) {
			if (declared[index][1] === declared[other][1]) {
				problems.push(
					`快捷键 ${declared[index][1]} 被 keys.${declared[index][0]} 和 keys.${declared[other][0]} 重复占用`,
				);
			}
		}
	}
	for (const [name, preset] of Object.entries(presets)) {
		if (!preset?.key) continue;
		const owner = owners.get(preset.key);
		if (owner) problems.push(`快捷键 ${preset.key} 被 ${owner} 和预设 ${name} 重复占用`);
		else owners.set(preset.key, `预设 ${name}`);
	}
}

let cached: LoadedConfig | undefined;

export function loadConfig(): LoadedConfig {
	if (cached) return cached;

	const problems: string[] = [...resolvedConfig.problems];
	const raw = readFile(problems);
	// features 省略表示沿用默认全开；只要显式写了，就必须是对象。
	// 非对象不能回退成 {}，因为 {} 在入口语义里正是「全部启用」。
	const invalidFeatures = raw.features !== undefined && !isPlainObject(raw.features);
	if (invalidFeatures) problems.push("features 必须是对象");
	const features: Partial<Record<Feature, boolean>> = invalidFeatures
		? Object.fromEntries(FEATURES.map((feature) => [feature, false]))
		: asRecord(raw.features);
	const rawKeys = asRecord(raw.keys);
	const presets = parsePresets(raw.presets, problems);
	const keys: ButlerUIKeys = {
		rename: typeof rawKeys.rename === "string" ? rawKeys.rename : DEFAULT_KEYS.rename,
		cyclePreset:
			typeof rawKeys.cyclePreset === "string" ? rawKeys.cyclePreset : DEFAULT_KEYS.cyclePreset,
		fast: typeof rawKeys.fast === "string" ? rawKeys.fast : DEFAULT_KEYS.fast,
	};
	checkFeatures(features, problems);
	checkKeys(keys, presets, problems);

	cached = { config: { features, keys, presets }, problems };
	return cached;
}

// ---- 模型原子 ----

const THINKING_LEVELS = new Set<ThinkingLevelValue>([
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
]);
const FALLBACK_THINKING: ThinkingLevelValue = "medium";

/**
 * 解析 "provider/model/thinking"：按最后一个斜杠切出思考档，前半必须仍是 provider/model。
 * 任何位置的模型配置都走这里，解析失败只记录问题并留空模型，让上层拒绝启动。
 * 每个字段只报一条问题，且必带目标形状——两段式旧写法会同时踩中两项校验，逐项报错说不出该改成什么。
 */
export function parseModelAtom(value: unknown, field: string, problems: string[]): ModelAtom {
	const shape = `${field} 必须是“provider/model/thinking”字符串`;
	if (typeof value !== "string" || !value) {
		problems.push(shape);
		return { model: "", thinking: FALLBACK_THINKING };
	}
	const slash = value.lastIndexOf("/");
	const model = slash > 0 ? value.slice(0, slash) : "";
	const thinking = slash > 0 ? value.slice(slash + 1) : value;
	const providerSlash = model.indexOf("/");
	const valid = THINKING_LEVELS.has(thinking as ThinkingLevelValue);
	const faults: string[] = [];
	if (providerSlash <= 0 || providerSlash === model.length - 1)
		faults.push(`模型段不是 provider/model：${model || value}`);
	if (!valid) faults.push(`思考档无效：${thinking}`);
	if (faults.length) problems.push(`${shape}（${faults.join("；")}）`);
	return { model, thinking: valid ? (thinking as ThinkingLevelValue) : FALLBACK_THINKING };
}

// ---- presets 节 ----

const PRESET_KEYS = ["model", "tools", "instructions", "key"] as const;

function parsePresets(value: unknown, problems: string[]): Record<string, Preset> {
	if (value === undefined) return {};
	if (!isPlainObject(value)) {
		problems.push("presets 必须是对象");
		return {};
	}
	return Object.fromEntries(
		Object.entries(value).map(([name, raw]) => [name, parsePreset(raw, `presets.${name}`, problems)]),
	);
}

/** preset 只在写了 model 时切模型；其余字段与模型原子互不依赖。 */
function parsePreset(value: unknown, field: string, problems: string[]): Preset {
	if (!isPlainObject(value)) {
		problems.push(`${field} 必须是对象`);
		return {};
	}
	rejectUnknownKeys(value, PRESET_KEYS, field, problems);
	return {
		...(value.model === undefined
			? {}
			: { model: parseModelAtom(value.model, `${field}.model`, problems) }),
		...(value.tools === undefined ? {} : { tools: stringArray(value.tools, `${field}.tools`, problems) }),
		...(value.instructions === undefined
			? {}
			: { instructions: stringValue(value.instructions, `${field}.instructions`, problems) }),
		...(value.key === undefined ? {} : { key: stringValue(value.key, `${field}.key`, problems) }),
	};
}
