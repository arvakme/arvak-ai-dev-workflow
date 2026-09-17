import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dir, "../packages/skills/web-search");
test("consolidated search CLIs authenticate and return results without exposing credentials", async () => {
	const directory = await mkdtemp(join(tmpdir(), "web-search-contract-"));
	try {
		const preload = join(directory, "fetch.mjs");
		await writeFile(preload, `import assert from 'node:assert/strict';
globalThis.fetch = async (url, options) => {
  const brave = String(url).includes('api.search.brave.com');
  assert.equal(options.headers[brave ? 'X-Subscription-Token' : 'x-api-key'], 'fixture-secret');
  if (brave) assert.equal(new URL(url).searchParams.get('q'), 'example');
  else assert.equal(JSON.parse(options.body).query, 'example');
  return new Response(JSON.stringify(brave ? {web:{results:[{title:'Primary source',url:'https://example.test',description:'Evidence'}]}}
    : {results:[{title:'Primary source',url:'https://example.test',highlights:['Evidence']}]}), {status:200});
};`);
		for (const cli of ["brave-search.mjs", "exa-search.mjs"]) {
			const process = Bun.spawn(["node", "--import", preload, join(root, cli), "example"], {
				env: { ...Bun.env, BRAVE_SEARCH_API_KEY: "fixture-secret", EXA_API_KEY: "fixture-secret" }, stdout: "pipe", stderr: "pipe" });
			const [output, errors, code] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
			expect(code).toBe(0); expect(output).toContain("Primary source"); expect(output).toContain("https://example.test");
			expect(output + errors).not.toContain("fixture-secret");
		}
	} finally { await rm(directory, { recursive: true, force: true }); }
});
