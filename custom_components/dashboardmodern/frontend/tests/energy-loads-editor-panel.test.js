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
  const input = cards()[0].querySelector(".dm-loads-identity").children[0];
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
