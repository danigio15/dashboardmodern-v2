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
  /* Il cambio di linguetta non e' l'unico modo in cui la scheda viene rifatta:
   * la ridisegna anche il modello, a ogni salvataggio, e li' la decorazione se
   * ne andava. `onEditorRedraw` e' l'uno e l'altro insieme. */
  assert.match(source, /onEditorRedraw\("__dmEditorSlots_editorSwitch", schedule\)/);

  /* Attached when the module loads AND on the ready events. Attaching only in
   * the ready handlers meant never attaching at all when the bundle finished
   * loading after the runtime had already announced itself — the handler never
   * ran, and the editor printed rows nothing decorated. */
  const install = source.slice(source.indexOf("export function installEditorSlotsSection"));
  assert.equal((install.match(/bindLegacyEntryPoints\(\)/g) || []).length, 2);
  assert.match(install, /addEventListener\?\.\(eventName, \(\) => \{\s*bindLegacyEntryPoints\(\);/);
});


function fakeInput(id, placeholder) {
  return {
    id,
    attributes: { placeholder },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
}

test("no field asks for a dm.core code any more", async () => {
  const { clarifyEntityPlaceholders } = await loadSection();
  const action = fakeInput("ed-qa-ent", "dm.core_054 / dm.core_023 / scene.x (non serve per i popup)");
  const wizardAction = fakeInput("wz-qa-ent", "dm.core_054 — l'entità da comandare");
  const slot = fakeInput("", "es. dm.core_039");
  const meter = fakeInput("ed-rep2-ent", "dm.core_028");
  const untouched = fakeInput("ed-other", "sensor.qualcosa");
  const inputs = [action, wizardAction, slot, meter, untouched];
  const scope = { querySelectorAll: () => inputs };

  assert.equal(clarifyEntityPlaceholders(scope), 4);
  for (const input of [action, wizardAction, slot, meter]) {
    assert.doesNotMatch(input.attributes.placeholder, /dm\.core/, input.id || "slot");
    assert.ok(input.attributes.placeholder.length > 0);
  }
  // A named field says what it wants, with an example someone can actually have.
  assert.match(meter.attributes.placeholder, /kWh/);
  assert.match(wizardAction.attributes.placeholder, /switch\./);
  // An unnamed slot falls back to the shape of a Home Assistant id.
  assert.match(slot.attributes.placeholder, /dominio\.nome|domain\.name/);
  // Everything else is left alone, and a second pass changes nothing.
  assert.equal(untouched.attributes.placeholder, "sensor.qualcosa");
  assert.equal(clarifyEntityPlaceholders(scope), 0);
  assert.equal(clarifyEntityPlaceholders(null), 0);
});

test("the placeholders are rewritten whenever the editor is decorated", () => {
  assert.match(source, /clarifyEntityPlaceholders\(\);\n\s*dropRetiredSlots\(scope\)/);
  // The row caption prefers the named caption over the placeholder text, so a
  // field with a long example still prints a short name.
  assert.match(source, /"ed-qa-ent": \["Entità da comandare"/);
});
