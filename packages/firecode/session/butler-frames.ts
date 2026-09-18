/** Small shaded Butler sprite: twelve subpixel rows inside the original six-line terminal footprint. */
export type ButlerState = "idle" | "working" | "done" | "error";

const RESET = "\x1b[0m";
const COLORS: Record<string, string> = {
	h: "245;253;255", w: "218;234;244", s: "120;161;191", d: "66;101;133",
	n: "20;43;67", v: "35;71;98", c: "65;217;242", b: "40;126;191",
	e: "114;245;255", r: "255;162;92", t: "35;100;133",
};
// Light comes from the upper left; the visor, lower shell and thruster have separate depth bands.
const SHELL = [
	"       chc       ",
	"      cwhwc      ",
	"     shhhwws     ",
	"   bwhhhwwwwsb   ",
	"  cwhvvvvvvvwwc  ",
	" cwwvnnnnnnnvwsc ",
	"  swvnnnnnnnvws  ",
	"   swwvnnnvwws   ",
	"  bcswwwwwsscb   ",
	"      dbcbd      ",
];
function pixel(top: string, bottom: string): string {
	if (top === " " && bottom === " ") return " ";
	if (top === " ") return `\x1b[38;2;${COLORS[bottom]}m▄${RESET}`;
	if (bottom === " ") return `\x1b[38;2;${COLORS[top]}m▀${RESET}`;
	return `\x1b[38;2;${COLORS[top]}m\x1b[48;2;${COLORS[bottom]}m▀${RESET}`;
}
function butlerCells(state: ButlerState, frame: number, available: number, rows: number, folded = false): string[][] {
	if (available <= 0 || rows <= 0) return [];
	if (folded) return [[`\x1b[38;2;${COLORS.c}m◉${RESET}`]];
	const blink = state === "idle" && frame % 32 >= 30;
	const cyan = `\x1b[38;2;${COLORS[state === "error" ? "r" : "c"]}m`;
	if (available < 17 || rows < 24) {
		const face = state === "error" ? "(! !)" : state === "done" ? "(^ ^)" : blink ? "(- -)" : "(o o)";
		return [[...(available < 5 ? "◈" : face)].map(char => char === " " ? " " : cyan + char + RESET)];
	}
	const body = SHELL.map(line => [...line]);
	const phase = frame % 48;
	const gaze = state === "idle" ? phase >= 12 && phase < 20 ? -1 : phase >= 36 && phase < 42 ? 1 : 0 : 0;
	for (const eye of [5 + gaze, 10 + gaze]) {
		body[5][eye] = blink ? "n" : state === "error" ? "r" : "h";
		body[5][eye + 1] = blink ? "n" : state === "error" ? "r" : "e";
		body[6][eye] = state === "done" ? "n" : state === "error" ? "r" : "c";
		body[6][eye + 1] = state === "done" ? "n" : state === "error" ? "r" : "e";
	}
	body[7][8] = state === "done" ? "e" : "b";
	// A slow glint on the curved shell and a soft thruster pulse add depth without flashing.
	body[3][5 + Math.floor((frame % 40) / 10)] = "h";
	body[9][8] = Math.floor(frame / 4) % 2 ? "e" : "c";
	const hover = Math.floor(frame / (state === "done" ? 3 : 8)) % 2;
	const canvas = Array.from({ length: 12 }, () => Array<string>(17).fill(" "));
	for (let y = 0; y < body.length; y++) canvas[y + hover] = body[y];
	canvas[10 + hover][8] = state === "working" ? "c" : "t";
	if (state === "working") {
		const orbit = [[1, 3], [4, 1], [12, 1], [15, 4], [14, 8], [2, 8]][frame % 6];
		canvas[orbit[1]][orbit[0]] = "e";
	}
	const lines: string[][] = [];
	for (let y = 0; y < 12; y += 2) lines.push(canvas[y].map((color, x) => pixel(color, canvas[y + 1][x])));
	return lines;
}

export function butlerFrame(state: ButlerState, frame: number, available: number, rows = 30, folded = false): string[] {
	return butlerCells(state, frame, available, rows, folded).map(line => line.join(""));
}

export type ButlerSegment = { row: number; col: number; width: number; text: string };
// Six body rows and at most one detached orbit pixel. Stable slots keep menus above the pet.
export const BUTLER_MAX_SEGMENTS = 7;
export function butlerSegments(state: ButlerState, frame: number, available: number, rows: number, folded = false): ButlerSegment[] {
	const segments: ButlerSegment[] = [];
	for (const [row, cells] of butlerCells(state, frame, available, rows, folded).entries()) {
		let run: ButlerSegment | undefined;
		for (const [col, cell] of cells.entries()) {
			if (cell === " ") { run = undefined; continue; }
			if (!run) { run = { row, col, width: 0, text: "" }; segments.push(run); }
			run.width++;
			run.text += cell;
		}
	}
	return segments;
}
