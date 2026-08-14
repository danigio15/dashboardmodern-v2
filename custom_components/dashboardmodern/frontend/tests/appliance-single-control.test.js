import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layout = await readFile(
  new URL("../src/sections/appliances-section.js", import.meta.url),
  "utf8",
);
const behavior = await readFile(
  new URL("../src/sections/appliances-section.js", import.meta.url),
  "utf8",
);

test("appliance layout never hides an action by DOM position", () => {
  assert.doesNotMatch(layout, /\.appl-action-btn:first-child/);
  assert.doesNotMatch(layout, /:has\(\[data-dm-power-toggle/);
});

test("appliance behavior hides only the legacy power action and preserves History", () => {
  assert.match(behavior, /hideLegacyPowerOnly/);
  assert.match(behavior, /storico\|history/i);
  assert.match(behavior, /restoreLegacyActions/);
});
