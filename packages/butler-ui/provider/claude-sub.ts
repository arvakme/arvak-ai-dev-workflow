/**
 * Anthropic OAuth 会话按 Claude Code 的归因格式发请求：补 user-agent 与
 * 系统提示词首块的 billing header，缺失时注入，已存在则原样通过。
 * 每次请求异步读取本机版本，不猜测版本、不跨请求缓存；检测失败交给宿主
 * 显示扩展错误并保留其原生归因，下一次请求重新检测。
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const BILLING_PREFIX = "x-anthropic-billing-header:";
const execFileAsync = promisify(execFile);
const DEFAULT_ENTRYPOINT = "cli";
const BILLING_SALT = "59cf53e54c78";

type TextBlock = {
	type: "text";
	text: string;
	cache_control?: { type: "ephemeral"; ttl?: "1h" };
};

interface PayloadLike {
	system?: unknown;
	messages?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isTextBlock(value: unknown): value is TextBlock {
	return isObject(value) && value.type === "text" && typeof value.text === "string";
}

function shouldApply(ctx: ExtensionContext): boolean {
	const model = ctx.model;
	return !!model && model.provider === "anthropic" && ctx.modelRegistry.isUsingOAuth(model);
}

async function detectClaudeCodeVersion(): Promise<string> {
	const explicit = process.env.PI_CLAUDE_CODE_VERSION;
	if (explicit !== undefined) {
		const version = explicit.trim();
		if (/^\d+\.\d+\.\d+$/.test(version)) return version;
		throw new Error("Butler UI: PI_CLAUDE_CODE_VERSION 必须是 major.minor.patch 格式的 Claude Code 版本号。");
	}

	try {
		const { stdout } = await execFileAsync("claude", ["--version"], {
			encoding: "utf8",
			timeout: 10_000,
			maxBuffer: 64 * 1024,
		});
		const match = stdout.trim().match(/^\d+\.\d+\.\d+(?=\s|$)/);
		if (match) return match[0];
	} catch {
		// 不把外部进程的 stdout/stderr 写入错误，以免泄漏启动脚本中的环境信息。
	}

	throw new Error(
		"Butler UI: 无法在 10 秒内读取 Claude Code 版本。请确认 PATH 中的 claude --version 正常，" +
		"或将 PI_CLAUDE_CODE_VERSION 设为实际安装版本；本次保留 Pi 原生归因，下次请求会重新检测。",
	);
}

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter(isTextBlock)
		.map((block) => block.text)
		.join("\n");
}

function firstUserText(messages: unknown): string {
	const list = Array.isArray(messages) ? messages : [];
	const firstUser = list.find((message) => isObject(message) && message.role === "user");
	return isObject(firstUser) ? textOf(firstUser.content) : "";
}

function versionSuffix(messageText: string, claudeCodeVersion: string): string {
	const explicit = process.env.PI_CLAUDE_CODE_VERSION_SUFFIX;
	if (explicit) return explicit;

	const sampled = [4, 7, 20].map((index) => messageText[index] ?? "0").join("");
	return createHash("sha256")
		.update(`${BILLING_SALT}${sampled}${claudeCodeVersion}`)
		.digest("hex")
		.slice(0, 3);
}

function buildBillingHeader(messages: unknown, claudeCodeVersion: string): string {
	const version = `${claudeCodeVersion}.${versionSuffix(firstUserText(messages), claudeCodeVersion)}`;
	const entrypoint =
		process.env.PI_CLAUDE_CODE_ENTRYPOINT ?? process.env.CLAUDE_CODE_ENTRYPOINT ?? DEFAULT_ENTRYPOINT;
	const workload = process.env.PI_CLAUDE_CODE_WORKLOAD ?? process.env.CLAUDE_CODE_WORKLOAD;
	const workloadPart = workload ? ` cc_workload=${workload};` : "";
	return `${BILLING_PREFIX} cc_version=${version}; cc_entrypoint=${entrypoint}; cch=00000;${workloadPart}`;
}

function log(details: Record<string, unknown>): void {
	const logFile = process.env.PI_CLAUDE_OAUTH_LOG_FILE;
	if (!logFile) return;

	const path = resolve(logFile);
	try {
		mkdirSync(dirname(path), { recursive: true });
		appendFileSync(path, `${JSON.stringify({ timestamp: new Date().toISOString(), ...details })}\n`, "utf8");
	} catch {
		// 调试日志是可选的。
	}
}

export function registerClaudeSub(pi: ExtensionAPI): void {
	// Pi 每个会话的请求先组装 headers，再构造 payload；只在这两个钩子间保留版本。
	// 注册函数独占此状态，主会话与 worker 不共享版本，未启用的功能也不会启动 CLI。
	let requestVersion: string | undefined;
	pi.on("before_provider_headers", async (event, ctx) => {
		requestVersion = undefined;
		if (!shouldApply(ctx)) return;
		const version = await detectClaudeCodeVersion();
		event.headers["user-agent"] = `claude-cli/${version} (external, cli)`;
		event.headers["x-app"] = "cli";
		requestVersion = version;
	});

	pi.on("before_provider_request", (event, ctx) => {
		const version = requestVersion;
		requestVersion = undefined;
		const payload = event.payload;
		if (!version || !shouldApply(ctx) || !isObject(payload)) return;

		const { system, messages } = payload as PayloadLike;
		const blocks = Array.isArray(system) ? system : typeof system === "string" ? [{ type: "text", text: system }] : [];
		if (blocks.some((block) => isTextBlock(block) && block.text.startsWith(BILLING_PREFIX))) return;

		const header: TextBlock = { type: "text", text: buildBillingHeader(messages, version) };
		log({ event: "billing_header_injected", header: header.text });
		return { ...payload, system: [header, ...blocks] };
	});
}
