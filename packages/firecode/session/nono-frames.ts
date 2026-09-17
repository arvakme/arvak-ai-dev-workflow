/** 小号终端像素 NONO：双像素半块字符，透明留白，不依赖图片或桌面进程。 */
export type NonoState = "idle" | "working" | "done" | "error";

const RESET = "\x1b[0m";
const COLORS: Record<string, string> = {
	w: "218;234;244", s: "120;161;191", n: "20;43;67",
	c: "65;217;242", b: "40;126;191", e: "114;245;255", r: "255;162;92",
};
const PIXELS = [
	" c      c      c ",
	" bc    cwc    cb ",
	"  bc wwwwwww cb  ",
	"   wwwnnnnnwww   ",
	"  wwnneenneennww ",
	"  wwnneenneennww ",
	"   wwnnncnnnww   ",
	"  cbwwwwwwwwwbc  ",
	"    swwwwws     ",
	"       bcb      ",
].map((line) => line.padEnd(17));

function pixel(top: string, bottom: string): string {
	if (top === " " && bottom === " ") return " ";
	if (top === " ") return `\x1b[38;2;${COLORS[bottom]}m▄${RESET}`;
	if (bottom === " ") return `\x1b[38;2;${COLORS[top]}m▀${RESET}`;
	return `\x1b[38;2;${COLORS[top]}m\x1b[48;2;${COLORS[bottom]}m▀${RESET}`;
}

export function nonoFrame(state: NonoState, frame: number, available: number, rows = 30): string[] {
	if (available <= 0) return [];
	const blink = state === "idle" && frame % 32 >= 30;
	const cyan = `\x1b[38;2;${COLORS[state === "error" ? "r" : "c"]}m`;
	if (available < 17 || rows < 24) {
		const face = state === "error" ? "(! !)" : state === "done" ? "(^ ^)" : blink ? "(- -)" : "(o o)";
		return [cyan + (available < 5 ? "◈" : face) + RESET];
	}
	const pixels = PIXELS.map((line) => [...line]);
	if (blink) for (const row of [4, 5]) {
		for (let x = 0; x < 17; x++) if (pixels[row][x] === "e") pixels[row][x] = row === 4 ? "n" : "c";
	}
	if (state === "error") for (const line of pixels) {
		for (let x = 0; x < 17; x++) if (line[x] === "e") line[x] = "r";
	}
	if (state === "working") {
		const orbit = [[0, 4], [1, 8], [8, 9], [15, 8], [16, 4], [15, 1]][frame % 6];
		pixels[orbit[1]][orbit[0]] = "e";
	}
	if (state === "done") pixels[0][8] = "e";
	const lines: string[] = [];
	for (let y = 0; y < 10; y += 2)
		lines.push(pixels[y].map((color, x) => pixel(color, pixels[y + 1][x])).join(""));
	// 固定六行，浮动时也不推动输入框或消息流。
	return Math.floor(frame / (state === "done" ? 2 : 8)) % 2 ? ["", ...lines] : [...lines, ""];
}
