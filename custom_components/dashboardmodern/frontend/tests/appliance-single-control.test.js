import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/sections/appliance-layout-section.js", import.meta.url), "utf8");

test("legacy icon-only power button is hidden when the modern text toggle exists", () => {
  assert.match(source, /:has\(\[data-dm-power-toggle=\\?"true\\?"\]\)/);
  assert.match(source, />\.appl-action-btn:first-child/);
});
