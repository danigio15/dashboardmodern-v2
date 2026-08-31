// DM-FIX-20260817B
/* The rebuilt Loads panel: one card per circle under Home, in stage order,
 * saving through the canonical section. Driven against a minimal DOM shim, the
 * same approach the flow renderer test uses. */
import assert from "node:assert/strict";
import test from "node:test";

class ClassList {
  constructor(node) {
    this.node = node;
  }
  #set() {
    return new Set(String(this.node.className || "").split(/\s+/).filter(Boolean));
  }
  add(...names) {
    const set = this.#set();
    names.forEach((name) => set.add(name));
    this.node.className = [...set].join(" ");
  }
  remove(...names) {
    const set = this.#set();
    names.forEach((name) => set.delete(name));
    this.node.className = [...set].join(" ");
  }
  toggle(name, force) {
    const set = this.#set();
    if (force) set.add(name);
    else set.delete(name);
    this.node.className = [...set].join(" ");
  }
  contains(name) {
    return this.#set().has(name);
  }
}

class Style {
  constructor() {
    this.values = new Map();
  }
  setProperty(name, value) {
    this.values.set(name, String(value));
  }
  removeProperty(name) {
    this.values.delete(name);
  }
  getPropertyValue(name) {
    return this.values.get(name) || "";
  }
  getPropertyPriority() {
    return "";
  }
}

const SIMPLE = /^([a-z]*)((?:[.#][\w-]+|\[[^\]]+\])*)$/i;
const PART = /([.#])([\w-]+)|\[([^\]=*^]+)(?:([*^]?=)\s*["']?([^"'\]]*)["']?)?\]/g;

function datasetKey(attribute) {
  return attribute.startsWith("data-")
    ? attribute.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    : "";
}

function matchesSimple(node, selector) {
  const parsed = SIMPLE.exec(selector.trim().replace(/^:scope\s*>\s*/, ""));
  if (!parsed) return false;
  const [, tag, rest] = parsed;
  if (tag && node.tagName.toLowerCase() !== tag.toLowerCase()) return false;
  PART.lastIndex = 0;
  let part;
  while ((part = PART.exec(rest || ""))) {
    const [, prefix, name, attribute, operator, expected] = part;
    if (prefix === ".") {
      if (!node.classList.contains(name)) return false;
      continue;
    }
    if (prefix === "#") {
      if (node.id !== name) return false;
      continue;
    }
    const key = datasetKey(attribute);
    const value = key ? node.dataset[key] : node.attributes[attribute];
    if (value === undefined || value === null) return false;
    if (operator === "=" && String(value) !== expected) return false;
  }
  return true;
}

const matches = (node, selector) => selector.split(",").some((part) => matchesSimple(node, part));

class Element {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.className = "";
    this.classList = new ClassList(this);
    this.style = new Style();
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.open = false;
    this.id = "";
    this.value = "";
    this.textContent = "";
    this.parentElement = null;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  remove() {
    const siblings = this.parentElement?.children;
    const index = siblings?.indexOf(this) ?? -1;
    if (index >= 0) siblings.splice(index, 1);
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
  addEventListener(name, handler) {
    const values = this.listeners.get(name) || [];
    values.push(handler);
    this.listeners.set(name, values);
  }
  dispatch(name, event = {}) {
    for (const handler of this.listeners.get(name) || [])
      handler({ preventDefault() {}, stopPropagation() {}, ...event });
  }
  click() {
    this.dispatch("click");
  }
  descendants(out = []) {
    for (const child of this.children) {
      out.push(child);
      child.descendants(out);
    }
    return out;
  }
  querySelectorAll(selector) {
    return this.descendants().filter((node) => matches(node, selector));
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  get innerHTML() {
    return this._html || "";
  }
  set innerHTML(value) {
    this._html = value;
  }
}

const panel = new Element("section");
panel.dataset.energyPanel = "loads";
const body = new Element("body");
body.append(panel);

globalThis.document = {
  documentElement: Object.assign(new Element("html"), { lang: "it" }),
  head: new Element("head"),
  body,
  createElement: (tag) => new Element(tag),
  createElementNS: (_ns, tag) => new Element(tag),
  getElementById: (id) => body.descendants().find((node) => node.id === id) || null,
  querySelector: (selector) => (matches(panel, selector) ? panel : body.querySelector(selector)),
  querySelectorAll: (selector) => body.querySelectorAll(selector),
  addEventListener() {},
};

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

let saved = null;
const sections = {
  loads: [
    { id: "boiler", name: "Boiler", order: 0, power_entity: "sensor.boiler_power" },
    { id: "wallbox", name: "Wallbox", order: 1, power_entity: "sensor.wb_power" },
  ],
};
globalThis.DashboardModernModules = {
  store: {
    getSection: (name) => sections[name],
    replaceSection: async (name, value) => {
      saved = value;
      sections[name] = value;
      return true;
    },
  },
};

const editor = await import("../src/sections/energy-loads-editor-section.js");

function render() {
  editor.renderEnergyLoadsEditor(panel);
  return panel;
}

const cards = () => panel.querySelectorAll("[data-dm-load]");
const previewName = (card) => card.querySelector(".dm-loads-preview-text").children[0].textContent;
const saveButton = () => panel.querySelector("[data-dm-loads-save]");

test("the panel lists one card per circle, in the order of the flow", () => {
  render();
  assert.equal(panel.dataset.dmLoadsEditor, "true");
  assert.deepEqual(
    cards().map((card) => card.dataset.dmLoad),
    ["boiler", "wallbox"],
  );
  assert.deepEqual(cards().map(previewName), ["Boiler", "Wallbox"]);
  // Nothing to save until something is edited.
  assert.equal(saveButton().disabled, true);
});

test("each card previews the bubble it draws, with its own colour and index", () => {
  render();
  const [first] = cards();
  const preview = first.querySelector(".dm-loads-preview");
  assert.equal(preview.style.getPropertyValue("--dm-loads-color"), "#ea580c");
  assert.equal(preview.dataset.dmLoadsVisible, "true");
  assert.equal(first.querySelector(".dm-loads-preview-index").textContent, "1");
  assert.equal(first.querySelector(".dm-loads-preview-bubble").textContent, "🔌");
});

test("renaming a load updates its preview before it is saved", () => {
  render();
  const input = cards()[0].querySelector("[data-dm-load-name]");
  input.value = "Pompa di calore";
  input.dispatch("change");
  assert.equal(previewName(cards()[0]), "Pompa di calore");
  assert.equal(saveButton().disabled, false);
});

test("a load can be moved, and the order is what the stage will draw", () => {
  render();
  const down = cards()[0].querySelector(".dm-loads-card-controls").children[1];
  down.click();
  assert.deepEqual(
    cards().map((card) => card.dataset.dmLoad),
    ["wallbox", "boiler"],
  );
});

test("saving writes the canonical section and the popup mirrors together", async () => {
  render();
  saveButton().click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(saved, "the canonical loads section was written");
  assert.deepEqual(
    saved.map(({ id, order, name }) => [id, order, name]),
    [
      ["wallbox", 0, "Wallbox"],
      ["boiler", 1, "Pompa di calore"],
    ],
  );
  assert.deepEqual(
    JSON.parse(storage.get("cd_subload_groups")).map(({ id }) => id),
    ["wallbox", "boiler"],
  );
  assert.equal(JSON.parse(storage.get("cd_flow_nodes")).boiler.name, "Wallbox");
  assert.equal(saveButton().disabled, true, "the panel is clean again after saving");
});

test("adding a load appends an empty circle, and the cap is the flow's eight", () => {
  render();
  panel.querySelector("[data-dm-load-add]").click();
  assert.equal(cards().length, 3);
  assert.equal(saveButton().disabled, false);

  for (let index = 0; index < 6; index += 1) panel.querySelector("[data-dm-load-add]").click();
  assert.equal(cards().length, 8);
  assert.equal(panel.querySelector("[data-dm-load-add]").disabled, true);
});

test("an unbound load says so instead of silently drawing nothing", () => {
  render();
  const added = cards().at(-1);
  const notes = added.querySelector(".dm-loads-warnings");
  assert.equal(notes.children.length, 1);
  assert.match(notes.children[0].textContent, /Nessuna entità collegata/);
});

test("name, icon and colour are labelled fields, with the canonical icon picker", () => {
  render();
  const [first] = cards();
  // Each field says what it is: squeezed side by side and unlabelled, nothing
  // told the user which box was the name and which the icon.
  const labels = first
    .querySelectorAll(".dm-loads-field")
    .map((field) => field.querySelector(".ed-slot-lbl").textContent);
  assert.deepEqual(labels, ["Nome del carico", "Icona", "Colore"]);

  const name = first.querySelector("[data-dm-load-name]");
  assert.equal(name.value, previewName(first), "the field shows the name it is editing");
  assert.ok(name.value, "and that name is not blank");

  // The picker button is drawn by this editor, not decorated by the legacy
  // `.dm-icon-picker` owner, which repainted it into an empty box.
  const icon = first.querySelector("[data-dm-load-icon]");
  const picker = first.querySelector("[data-dm-load-icon-pick]");
  assert.ok(icon.id, "the input is addressable, so the picker can write into it");
  assert.equal(picker.classList.contains("dm-icon-picker"), false);
  assert.equal(picker.textContent, icon.value, "the button previews the current icon");

  // The engine writes the glyph and fires change; the card must persist it.
  icon.value = "🔥";
  icon.dispatch("change");
  // The card is rebuilt on every edit, so the preview is read from the new one.
  assert.equal(cards()[0].querySelector(".dm-loads-preview-bubble").textContent, "🔥");
});

test("the panel is the only renderer: an older list is cleared, not stacked on", () => {
  const legacy = new Element("div");
  legacy.className = "ed-intro";
  legacy.textContent = "Carichi e Report condividono il modello canonico senza duplicati.";
  panel.append(legacy);
  assert.equal(panel.children.includes(legacy), true);

  render();
  assert.equal(panel.children.includes(legacy), false, "the legacy block is gone");
  assert.equal(panel.children.length, 1, "only the editor host is left");
  assert.ok(cards().length);
});

test("the labelled fields stay stacked on a phone, where they were unreadable", () => {
  render();
  const css = globalThis.document.head.descendants().map((node) => node.textContent).join("\n");
  const narrow = css.slice(css.indexOf("@media(max-width:640px)"));
  // The phone is exactly the case this change targets: no narrow variant may
  // put name, icon and colour back on one row.
  assert.doesNotMatch(narrow, /\.dm-loads-identity\s*\{[^}]*grid-template-columns/);
  assert.match(css, /\.dm-loads-identity\{display:grid;gap:12px/);
});

test("an mdi icon is drawn as a glyph, in the preview and in the picker button", () => {
  // The token was written as `<ha-icon>` markup, which paints nothing where
  // that element is undefined: the bubble and the button were empty boxes even
  // though the icon had been picked. The engine resolves the same token to the
  // glyph the picker shows while choosing it.
  const asked = [];
  globalThis.DashboardModernIconEngine = {
    render: (target, kind, value, options) => {
      asked.push([kind, value, options?.size]);
      target.innerHTML = '<span class="dm-icon-engine-glyph">🚘</span>';
      return true;
    },
  };
  globalThis.cdIconMarkup = () => "<ha-icon></ha-icon>";
  try {
    render();
    const input = cards()[0].querySelector("[data-dm-load-icon]");
    input.value = "mdi:car-electric";
    input.dispatch("input");
    input.dispatch("change");

    const card = cards()[0];
    const bubble = card.querySelector(".dm-loads-preview-bubble");
    const pick = card.querySelector("[data-dm-load-icon-pick]");
    assert.deepEqual(asked[0], ["load", "mdi:car-electric", 24]);
    assert.match(bubble.innerHTML, /🚘/);
    assert.match(pick.innerHTML, /🚘/);
    assert.equal(bubble.textContent, "", "the token is never printed as text");
    assert.equal(pick.textContent, "");
  } finally {
    delete globalThis.DashboardModernIconEngine;
    delete globalThis.cdIconMarkup;
  }
});

test("the panel stays hidden when another Energy tab is open", () => {
  render();
  const css = globalThis.document.head.descendants().map((node) => node.textContent).join("\n");
  // The editor set `display:block` unconditionally, which defeats the panel's
  // own `hidden` attribute: the section then showed under Flows & entities too.
  assert.match(css, /\[data-energy-panel="loads"\]\[data-dm-loads-editor="true"\]:not\(\[hidden\]\)/);
  assert.doesNotMatch(
    css,
    /\[data-dm-loads-editor="true"\]\{display:block/,
    "no unconditional display rule survives",
  );
});


/* ── «＋ Scegli da Elettrodomestici» ─────────────────────────────────────── */

// Lo stato del modulo vive sotto la chiave pubblicata: i test precedenti lo
// hanno sporcato apposta, questi ripartono da una maschera pulita.
const editorState = globalThis.__DASHBOARDMODERN_ENERGY_LOADS_EDITOR__;
function resetEditor() {
  editorState.model = null;
  editorState.dirty = false;
  editorState.picking = "";
  editorState.editing = "";
  editorState.open = new Set();
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("picking a configured appliance writes its subload metadata through the appliances store", async () => {
  resetEditor();
  sections.loads = [{ id: "cucina", name: "Cucina", order: 0, power_entity: "sensor.cucina" }];
  sections.appliances = [
    { id: "appl-forno", name: "Forno", power_entity: "sensor.forno_power" },
    {
      id: "appl-lavatrice",
      name: "Lavatrice",
      power_entity: "sensor.washer_power",
      metadata: { beta27_subload_group: "lavanderia" },
    },
  ];
  render();

  const pickButton = panel.querySelector("[data-dm-subload-pick]");
  assert.ok(pickButton, "the second button sits beside Add appliance");
  assert.equal(pickButton.disabled, false);
  assert.match(pickButton.textContent, /Scegli da Elettrodomestici/);

  pickButton.click();
  // Solo l'elettrodomestico libero è proposto: la lavatrice ha già un carico.
  const choices = panel.querySelectorAll("[data-dm-appliance-choice]");
  assert.equal(choices.length, 1);
  const written = choices[0].textContent + choices[0].descendants().map((node) => node.textContent).join("");
  assert.match(written, /Forno/);

  choices[0].click();
  await tick();

  // La scelta è passata dalla sezione `appliances`, come fa la modale.
  assert.equal(sections.appliances[0].metadata.beta27_subload_group, "cucina");
  assert.equal(
    sections.appliances[1].metadata.beta27_subload_group,
    "lavanderia",
    "the appliance already assigned elsewhere is untouched",
  );
  // I carichi non sono stati riscritti: la riga vive nella sezione di là.
  assert.equal(sections.loads.length, 1);

  // E al refresh dell'editor la riga «da Elettrodomestici» c'è, in sola lettura.
  const row = panel.querySelector('[data-dm-subload-source="appliance"]');
  assert.ok(row, "the assigned appliance shows up as a read-only row");
  assert.equal(row.dataset.dmSubload, "appl-forno");
  assert.equal(row.querySelector("[data-dm-subload-delete]"), null);
});

test("a full load says so on the picker button instead of truncating in silence", () => {
  resetEditor();
  sections.loads = [
    { id: "pieno", name: "Pieno", order: 0, power_entity: "sensor.pieno" },
    ...Array.from({ length: 12 }, (_, index) => ({
      id: `pieno-sub-${index + 1}`,
      name: `Dispositivo ${index + 1}`,
      power_entity: `sensor.sub${index + 1}`,
      metadata: { beta27_subload_group: "pieno" },
    })),
  ];
  sections.appliances = [{ id: "appl-forno", name: "Forno", power_entity: "sensor.forno_power" }];
  render();

  const pickButton = panel.querySelector("[data-dm-subload-pick]");
  assert.equal(pickButton.disabled, true);
  assert.match(pickButton.textContent, /Carico pieno: massimo 12 dispositivi/);

  // Anche forzando il click il picker non si apre: niente tredicesima riga.
  pickButton.click();
  assert.equal(panel.querySelector("[data-dm-appliance-picker]"), null);
});

test("a load of another plant explains why appliances cannot be picked for it", () => {
  resetEditor();
  storage.set("cd_energy_plant", "impianto-2");
  sections.energy = { plants: [{ id: "impianto-2", name: "Casa 2" }] };
  sections.loads = [
    { id: "altro", name: "Altro", order: 0, power_entity: "sensor.altro", plant: "impianto-2" },
  ];
  sections.appliances = [{ id: "appl-forno", name: "Forno", power_entity: "sensor.forno_power" }];
  render();

  assert.deepEqual(cards().map((card) => card.dataset.dmLoad), ["altro"]);
  // Gli elettrodomestici non hanno un campo impianto: niente pulsante qui,
  // e al suo posto la riga che spiega il perché.
  assert.equal(panel.querySelector("[data-dm-subload-pick]"), null);
  const spiegazione = panel.querySelector(".dm-loads-pick-foreign");
  assert.ok(spiegazione);
  assert.match(spiegazione.textContent, /impianto principale/);

  storage.delete("cd_energy_plant");
  delete sections.energy;
});
