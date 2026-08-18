// DM-FIX-20260817E
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/sections/editor-slots-section.js", import.meta.url),
  "utf8",
);

async function loadSection() {
  return import(`../src/sections/editor-slots-section.js?fix=${Date.now()}`);
}

test("a slot shows the name Home Assistant knows, not the raw id", async () => {
  const { entityLabel } = await loadSection();
  const states = {
    "sensor.b10_soc": { attributes: { friendly_name: "B10 Stato di carica" } },
    "sensor.no_name": { attributes: {} },
    // Home Assistant falls back to the id as friendly_name; that is not a name.
    "sensor.same": { attributes: { friendly_name: "sensor.same" } },
  };
  assert.equal(entityLabel("sensor.b10_soc", states), "B10 Stato di carica");
  assert.equal(entityLabel("sensor.no_name", states), "");
  assert.equal(entityLabel("sensor.same", states), "");
  assert.equal(entityLabel("sensor.missing", states), "");
  assert.equal(entityLabel("", states), "");
});

test("the accordion header counts how many slots are actually mapped", async () => {
  const { slotCounts } = await loadSection();
  const inputs = [{ value: "sensor.a" }, { value: "" }, { value: "  " }, { value: "sensor.b" }];
  const scope = { querySelectorAll: () => inputs };
  assert.deepEqual(slotCounts(scope), { total: 4, mapped: 2 });
  assert.deepEqual(slotCounts({ querySelectorAll: () => [] }), { total: 0, mapped: 0 });
  assert.deepEqual(slotCounts(null), { total: 0, mapped: 0 });
});

test("the row keeps the contracts the editor saves through", () => {
  // edSetSlot fires on the input's change event and edSaveSezione re-reads the
  // same inputs from .ed-acc-body, so the field must stay in the DOM.
  assert.match(source, /\.ed-slot-in\[data-ref\]/);
  assert.match(source, /wzPickEntity\?\.\(input\)/);
  // Hidden, never removed: the picker guard reconciles the input/lens pair.
  assert.match(source, /\.dm-slots:not\(\.dm-slots-raw\) \.dm-slot>div:has\(>\.ed-slot-in\)\{display:none!important\}/);
  assert.doesNotMatch(source, /\.remove\(\)/);
  // The chip is appended last so the lens stays the input's next sibling.
  assert.match(source, /slot\.append\(chip\)/);
});

test("the loads editor keeps its own layout", () => {
  // energy-loads-editor reuses .ed-slot for a different form; decorating it
  // would fight its owner.
  assert.match(source, /slot\.closest\("\[data-load-form\]"\)/);
});

test("the section owns presentation only", () => {
  const body = source.slice(source.indexOf("\nimport {"));
  for (const owned of ["edSetSlot", "edSaveSezione", "localStorage", "ENTITY_OVERRIDES"])
    assert.doesNotMatch(body, new RegExp(owned), owned);
  assert.doesNotMatch(body, /setInterval\s*\(/);
  assert.doesNotMatch(body, /MutationObserver/);
});
