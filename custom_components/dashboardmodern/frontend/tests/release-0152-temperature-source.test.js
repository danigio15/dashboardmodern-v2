import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixesUrl = new URL("../legacy/release-0152-fixes.js", import.meta.url);

test("0.14.12 makes the duplicate Temperature icon control non-interactive", async () => {
  const source = await readFile(fixesUrl, "utf8");
  assert.match(source, /iconInput\.type = "hidden"/);
  assert.match(source, /style\.setProperty\("display", "none", "important"\)/);
  assert.match(source, /syncTemperatureIcon/);
});
