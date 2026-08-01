import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixesUrl = new URL("../legacy/release-0152-fixes.js", import.meta.url);

test("fridge and boiler are no longer rendered by the old generic line icons", async () => {
  const source = await readFile(fixesUrl, "utf8");
  assert.match(source, /data-dm-art=\\?"fridge/);
  assert.match(source, /data-dm-art=\\?"boiler/);
  assert.match(source, /fill=\\?"#0f2942/);
});
