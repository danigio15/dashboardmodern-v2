import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixesUrl = new URL("../legacy/release-0152-temperature-dom.js", import.meta.url);

test("0.14.12 removes the duplicate Temperature icon row and keeps its saved value canonical", async () => {
  const source = await readFile(fixesUrl, "utf8");
  assert.match(source, /iconInput\.type = "hidden"/);
  assert.match(source, /iconInput\.remove\(\)/);
  assert.match(source, /field\.remove\(\)/);
  assert.match(source, /syncCanonicalIcon/);
  assert.match(source, /min-height: 44px/);
});
