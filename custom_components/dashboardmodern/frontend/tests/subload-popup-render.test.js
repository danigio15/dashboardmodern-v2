// DM-FIX-20260817D
/* The popup renderer against a minimal DOM shim: the heading names the circle
 * that was clicked, as the stage resolved it, and `mdi:` tokens are drawn as
 * glyphs rather than printed as text. */
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

class Element {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.dataset = {};
    this.className = "";
    this.classList = new ClassList(this);
    this.style = { values: new Map(), setProperty(k, v) { this.values.set(k, String(v)); }, getPropertyValue(k) { return this.values.get(k) || ""; }, getPropertyPriority() { return ""; }, removeProperty(k) { this.values.delete(k); } };
    this.id = "";
    this.hidden = false;
    this.textContent = "";
    this._html = "";
    this.listeners = new Map();
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
  addEventListener(name, handler) {
    this.listeners.set(name, handler);
  }
  set innerHTML(value) {
    this._html = value;
  }
  get innerHTML() {
    return this._html;
  }
  descendants(out = []) {
    for (const child of this.children) {
      out.push(child);
      child.descendants(out);
    }
    return out;
  }
  querySelector(selector) {
    const wanted = selector.replace(/^\./, "");
    return this.descendants().find((node) => node.classList.contains(wanted)) || null;
  }
  querySelectorAll(selector) {
    const wanted = selector.replace(/^\./, "");
    return this.descendants().filter((node) => node.classList.contains(wanted));
  }
}

const body = new Element("body");
const list = new Element("div");
list.id = "subloads-list";
const title = new Element("h3");
title.id = "subloads-title";
title.textContent = "CARICHI";
body.append(title, list);

globalThis.document = {
  documentElement: Object.assign(new Element("html"), { lang: "it" }),
  head: new Element("head"),
  body,
  createElement: (tag) => new Element(tag),
  getElementById: (id) => body.descendants().find((node) => node.id === id) || null,
  querySelector: () => null,
  addEventListener() {},
};

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

// The dashboard's canonical mdi renderer; the popup must go through it.
globalThis.cdIconMarkup = (icon, size) => `<svg data-icon="${icon}" data-size="${size}"></svg>`;

const sections = { loads: [], appliances: [] };
globalThis.DashboardModernModules = { store: { getSection: (name) => sections[name] } };
globalThis.__HASS__ = { states: {} };

const popup = await import("../src/sections/subload-popup-section.js");

function configure({ loads = [], appliances = [], states = {}, flowNodes = null } = {}) {
  sections.loads = loads;
  sections.appliances = appliances;
  globalThis.__HASS__ = { states };
  storage.clear();
  if (flowNodes) storage.set("cd_flow_nodes", JSON.stringify(flowNodes));
}

const KITCHEN = [
  { id: "cucina", name: "Cucina", icon: "🍳", order: 0 },
  {
    id: "forno",
    name: "Forno",
    power_entity: "sensor.forno_power",
    metadata: { beta27_subload_group: "cucina" },
  },
];

test("the heading names the circle that was clicked, with its period", () => {
  configure({ loads: KITCHEN, states: { "sensor.forno_power": { state: "1800" } } });
  assert.equal(popup.renderSubloadPopup("cucina"), true);

  assert.equal(title.dataset.dmSubloadTitle, "cucina");
  const name = title.querySelector(".dm-subload-title-name");
  assert.equal(name.textContent, "CUCINA");
  assert.equal(title.querySelector(".dm-subload-title-period").textContent, "ISTANTANEO");

  // The period views open the same circle with a suffixed group.
  popup.renderSubloadPopup("cucina_month");
  assert.equal(title.querySelector(".dm-subload-title-period").textContent, "MESE");
});

test("a circle renamed by a saved flow-node customization keeps that name in the popup", () => {
  // The stage shows `override.name` before the customization has been folded
  // into the load; the popup must not head with the canonical name instead.
  configure({
    loads: KITCHEN,
    flowNodes: { boiler: { name: "Cucina di sotto", icon: "🔥" } },
    states: {},
  });
  popup.renderSubloadPopup("cucina");
  assert.equal(title.querySelector(".dm-subload-title-name").textContent, "CUCINA DI SOTTO");
  assert.equal(title.querySelector(".dm-subload-title-icon").textContent, "🔥");
});

test("an mdi token is drawn as a glyph, in the title and in every card", () => {
  configure({
    loads: [
      { id: "cucina", name: "Cucina", icon: "mdi:stove", order: 0 },
      {
        id: "forno",
        name: "Forno",
        icon: "mdi:toaster-oven",
        power_entity: "sensor.forno_power",
        metadata: { beta27_subload_group: "cucina" },
      },
    ],
    states: { "sensor.forno_power": { state: "1800" } },
  });
  popup.renderSubloadPopup("cucina");

  const titleIcon = title.querySelector(".dm-subload-title-icon");
  assert.equal(titleIcon.textContent, "", "the token is not printed as text");
  assert.match(titleIcon.innerHTML, /data-icon="mdi:stove"/);
  assert.match(list.querySelector(".dm-subload-summary-icon").innerHTML, /mdi:stove/);
  assert.match(list.querySelector(".dm-subload-icon").innerHTML, /mdi:toaster-oven/);
});

test("an emoji is still written as text, not through the mdi renderer", () => {
  configure({ loads: KITCHEN, states: {} });
  popup.renderSubloadPopup("cucina");
  const icon = title.querySelector(".dm-subload-title-icon");
  assert.equal(icon.textContent, "🍳");
  assert.equal(icon.innerHTML, "");
});
