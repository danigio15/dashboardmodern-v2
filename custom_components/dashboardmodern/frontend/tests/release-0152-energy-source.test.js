import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixesUrl = new URL("../legacy/release-0152-fixes.js", import.meta.url);

test("0.14.12 updates CD_PERIOD and does not request change as a type", async () => {
  const source = await readFile(fixesUrl, "utf8");
  assert.match(source, /periodRegistry\(\)\[slot\] = rounded/);
  assert.doesNotMatch(source, /types:\s*\[[^\]]*"change"/);
  assert.match(source, /units:\s*\{ energy: "kWh" \}/);
});
