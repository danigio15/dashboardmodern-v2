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
  // The only thing this section removes is a whole row the configuration has
  // retired. A decorated field is hidden behind "Modifica manuale" instead.
  assert.doesNotMatch(source, /input\.remove\(\)/);
  assert.match(source, /const row = input\.closest\("\.ed-slot"\);\n\s*if \(!row\) continue;\n\s*row\.remove\(\);/);
  // The chip is appended last so the lens stays the input's next sibling.
  assert.match(source, /slot\.append\(chip\)/);
});

test("the two retired Home rows never reach the form", async () => {
  const { dropRetiredSlots } = await loadSection();
  const { RETIRED_EDITOR_SLOTS, isRetiredEditorSlot } = await import(
    "../src/core/editor-slots.js"
  );
  assert.deepEqual(RETIRED_EDITOR_SLOTS, [
    "dm.home_interruttore_antifurto",
    "dm.home_script_apertura_cancello",
  ]);
  assert.equal(isRetiredEditorSlot("dm.home_meteo"), false);
  assert.equal(isRetiredEditorSlot(" dm.home_script_apertura_cancello "), true);

  const rows = new Map();
  const makeInput = (ref, hasRow = true) => {
    const row = { remove: () => rows.set(ref, "removed") };
    if (hasRow) rows.set(ref, "present");
    return { dataset: { ref }, closest: (selector) => (hasRow && selector === ".ed-slot" ? row : null) };
  };
  const inputs = [
    makeInput("dm.home_meteo"),
    makeInput("dm.home_interruttore_antifurto"),
    makeInput("dm.home_script_apertura_cancello"),
    // A retired ref with no row of its own belongs to another form: left alone.
    makeInput("dm.home_interruttore_antifurto", false),
  ];
  assert.equal(dropRetiredSlots({ querySelectorAll: () => inputs }), 2);
  assert.equal(rows.get("dm.home_meteo"), "present");
  assert.equal(rows.get("dm.home_interruttore_antifurto"), "removed");
  assert.equal(rows.get("dm.home_script_apertura_cancello"), "removed");
  assert.equal(dropRetiredSlots(null), 0);
});

test("the loads editor keeps its own layout", () => {
  // energy-loads-editor reuses .ed-slot for a different form; decorating it
  // would fight its owner.
  assert.match(source, /slot\.closest\("\[data-load-form\]"\)/);
});

test("the section owns presentation only", () => {
  const body = source.slice(source.lastIndexOf("\nimport {"));
  for (const owned of ["edSetSlot", "edSaveSezione", "localStorage", "ENTITY_OVERRIDES"])
    assert.doesNotMatch(body, new RegExp(owned), owned);
  assert.doesNotMatch(body, /setInterval\s*\(/);
  assert.doesNotMatch(body, /MutationObserver/);
});

test("opening the editor decorates it, whatever the order the runtime loads in", () => {
  /* The wrap used to be attached only inside the `legacy-ready`/`runtime-ready`
   * handlers, so an editor opened before that event kept raw entity fields
   * until the event finally landed. `wrapFunction` is a no-op while the legacy
   * global is still undefined, so binding early costs nothing and binding again
   * on the events covers the other order. */
  assert.match(source, /function bindLegacyEntryPoints\(\)/);
  assert.match(source, /wrapFunction\("apriConfigEntita", "__dmEditorSlots_apriConfigEntita", schedule\)/);
  assert.match(source, /wrapFunction\("editorSwitch", "__dmEditorSlots_editorSwitch", schedule\)/);

  /* Attached when the module loads AND on the ready events. Attaching only in
   * the ready handlers meant never attaching at all when the bundle finished
   * loading after the runtime had already announced itself — the handler never
   * ran, and the editor printed rows nothing decorated. */
  const install = source.slice(source.indexOf("export function installEditorSlotsSection"));
  assert.equal((install.match(/bindLegacyEntryPoints\(\)/g) || []).length, 2);
  assert.match(install, /addEventListener\?\.\(eventName, \(\) => \{\s*bindLegacyEntryPoints\(\);/);
});

