import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readLegacyState } from "../src/core/migrations.js";
import { loadPopupMetrics, renderEnergyEditor } from "../src/core/renderers.js";

class ClassList {
  constructor(node) {
    this.node = node;
  }
  add(...names) {
    const set = new Set(this.node.className.split(/\s+/).filter(Boolean));
    names.forEach((n) => set.add(n));
    this.node.className = [...set].join(" ");
  }
  toggle(name, force) {
    const set = new Set(this.node.className.split(/\s+/).filter(Boolean));
    force ? set.add(name) : set.delete(name);
    this.node.className = [...set].join(" ");
  }
  contains(name) {
    return this.node.className.split(/\s+/).includes(name);
  }
}
class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.className = "";
    this.classList = new ClassList(this);
    this.listeners = {};
    this.hidden = false;
  }
  append(...nodes) {
    this.children.push(...nodes);
    nodes.forEach((n) => {
      n.parentElement = this;
    });
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  setAttribute(name, value) {
    this[name] = value;
  }
  addEventListener(name, fn) {
    this.listeners[name] = fn;
  }
  click() {
    this.listeners.click?.();
  }
  set innerHTML(value) {
    this._html = value;
  }
  get innerHTML() {
    return this._html || "";
  }
  queryAll(predicate, out = []) {
    if (predicate(this)) out.push(this);
    this.children.forEach((c) => c.queryAll?.(predicate, out));
    return out;
  }
}
const document = { createElement: (tag) => new Element(tag) };
const storage = (seed) => ({ getItem: (key) => (key in seed ? JSON.stringify(seed[key]) : null) });

test("Energy real DOM opens Flussi by default, switches settings and reuses the shared picker", () => {
  const root = new Element("div");
  let picked;
  renderEnergyEditor(
    document,
    root,
    { house: { power: "sensor.house" } },
    [],
    { "sensor.house": { state: "432" } },
    "it",
    {
      onPick: (input) => {
        picked = input;
      },
      renderSettings: (node) => {
        node.textContent = "settings";
      },
    },
  );
  const panels = root.queryAll((node) => node.dataset.energyPanel);
  assert.equal(panels.find((node) => node.dataset.energyPanel === "flows").hidden, false);
  assert.equal(panels.find((node) => node.dataset.energyPanel === "settings").hidden, true);
  const tabs = root.queryAll((node) => node.classList.contains("ed-inner-tab"));
  assert.deepEqual(
    tabs.map((tab) => tab.textContent),
    ["FLUSSI ED ENTITÀ", "CARICHI", "IMPOSTAZIONI"],
  );
  tabs[2].click();
  assert.equal(panels.find((node) => node.dataset.energyPanel === "flows").hidden, true);
  assert.equal(panels.find((node) => node.dataset.energyPanel === "settings").hidden, false);
  const picker = root.queryAll((node) => node.classList.contains("dm-entity-picker"))[0];
  assert.ok(picker);
  picker.click();
  assert.equal(picked.value, "sensor.house");
  assert.match(root.queryAll((node) => node.tagName === "OUTPUT")[0].textContent, /432 W/);
});

test("empty Energy fields have no fixed Value placeholder and pickers survive 20 rerenders", () => {
  const root = new Element("div");
  let picks = 0;
  for (let pass = 0; pass < 20; pass++) {
    renderEnergyEditor(document, root, {}, [], {}, "it", { onPick: () => picks++ });
    const pickers = root.queryAll((node) => node.classList.contains("dm-entity-picker"));
    assert.ok(pickers.length > 0);
    assert.equal(root.queryAll((node) => node.tagName === "OUTPUT").length, 0);
    pickers.forEach((picker) => picker.click());
  }
  assert.ok(picks > 20);
  assert.doesNotMatch(root.innerHTML, /Valore:/);
});

test("editor navbar exposes Loads only inside Energy and has no standalone washer", async () => {
  for (const file of ["dashboard.html", "dashboard-en.html"]) {
    const source = await readFile(new URL(`../legacy/${file}`, import.meta.url), "utf8");
    const editor = source.slice(
      source.indexOf('<div class="ed-tabs">'),
      source.indexOf('<div class="ed-body"'),
    );
    assert.doesNotMatch(editor, /data-tab="load"/);
    assert.doesNotMatch(editor, /data-tab="sez5"/);
  }
});

test("legacy washer mappings migrate into the canonical appliance list", () => {
  const state = readLegacyState(
    storage({
      cd_entity_overrides: {
        "dm.lavatrice_presa_avvio_lavatrice": "switch.washer",
        "dm.lavatrice_potenza_presa_lavatrice_per_lavatrici_no": "sensor.washer_power",
      },
    }),
  );
  const washer = state.sections.appliances.find((item) => item.id === "appliance-lavatrice");
  assert.equal(washer.control_entity, "switch.washer");
  assert.equal(washer.power_entity, "sensor.washer_power");
});

test("legacy secondary loads and manual report rows migrate once without duplicates", () => {
  const state = readLegacyState(
    storage({
      cd_subloads_extra: { garage: [{ name: "Server", pwr: "sensor.server_power", icon: "🖥️" }] },
      cd_report_devices: [
        { name: "Server duplicate", entity: "sensor.server_power" },
        { name: "Piscina", entity: "sensor.pool_month" },
      ],
    }),
  );
  assert.equal(state.sections.loads.length, 2);
  assert.equal(state.sections.loads[0].id, "load-garage-1");
  assert.equal(state.sections.loads[1].category, "manual-report");
  assert.equal(state.sections.loads[1].show_in_dashboard, false);
});

test("load popup metrics include available values and omit missing rows", () => {
  const rows = loadPopupMetrics(
    { power_entity: "sensor.p", monthly_energy_entity: "sensor.m" },
    { "sensor.p": { state: "80" }, "sensor.m": { state: "10" } },
    0.3,
  );
  assert.deepEqual(
    rows.map((row) => row.key),
    ["power", "monthly", "cost"],
  );
  assert.equal(rows[2].value, 3);
  assert.ok(rows.every((row) => row.value !== undefined));
});

test("editor source has one entity picker class and mobile rows cannot require horizontal overflow", async () => {
  const [moduleSource, css, renderer] = await Promise.all([
    readFile(new URL("../legacy/modules-entry.js", import.meta.url), "utf8"),
    readFile(new URL("../legacy/dashboard-runtime.css", import.meta.url), "utf8"),
    readFile(new URL("../src/core/renderers.js", import.meta.url), "utf8"),
  ]);
  assert.equal((css.match(/\.dm-entity-picker\s*\{/g) || []).length, 1);
  assert.doesNotMatch(moduleSource + renderer, /dm-energy-editor__input|dm-energy-picker/);
  assert.match(moduleSource, /class=\"ed-form-row\"/);
  assert.match(renderer, /className = \"dm-entity-picker\"/);
});
