import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../src/sections/", import.meta.url);

test("Energy guidance is explicitly gated by the active editor tab", async () => {
  const source = await readFile(new URL("energy-guidance-section.js", root), "utf8");
  assert.match(source, /energyEditorActive\(\)/);
  assert.match(source, /removeEnergyGuidance\(\)/);
  assert.match(source, /tab === "sez1" \|\| tab === "energy"/);
});

test("editor observer ignores unrelated dashboard DOM churn", async () => {
  const source = await readFile(new URL("editor-contracts-section.js", root), "utf8");
  assert.match(source, /mutationTouchesEditor/);
  assert.match(source, /#editor-modal,\.dm-section-modal/);
  assert.doesNotMatch(source, /new root\.MutationObserver\(schedule\)/);
});
