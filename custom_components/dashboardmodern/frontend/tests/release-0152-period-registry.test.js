import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixesUrl = new URL("../legacy/release-0152-fixes.js", import.meta.url);

test("derived periods target the legacy registry used by the visible Energy map", async () => {
  const source = await readFile(fixesUrl, "utf8");
  assert.match(source, /typeof CD_PERIOD !== "undefined"/);
  assert.match(source, /periodRegistry\(\)\[slot\] = rounded/);
});
