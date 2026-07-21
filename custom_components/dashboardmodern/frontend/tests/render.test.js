import assert from "node:assert/strict";
import test from "node:test";
import { renderDashboard } from "../src/render/dashboard-renderer.js";
import { renderCard } from "../src/render/card-renderer.js";
import { selectActiveViewId } from "../src/presentation/view-selection.js";

class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.hidden = false; this._text = ""; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; this._text = ""; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  addEventListener(type, fn) { this[`on${type}`] = fn; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
  set textContent(v) { this._text = String(v); this.children = []; }
  querySelectorAll(selector) {
    const out = [];
    const match = (n) => selector.startsWith(".") ? n.className?.split?.(" ").includes(selector.slice(1)) : n.tagName === selector;
    const walk = (n) => { if (match(n)) out.push(n); for (const c of n.children) walk(c); };
    walk(this); return out;
  }
}
globalThis.document = { createElement: (tag) => new Node(tag) };

const dashboard = {
  id: "dash", title: "Main <safe>", description: "Desc & safe",
  views: [{ id: "v2", title: "Second", section_ids: ["s2"] }, { id: "v1", title: "First", section_ids: ["s1"] }],
  sections: [{ id: "s1", title: "Section 1", card_ids: ["c2", "c1"] }, { id: "s2", title: "Section 2", card_ids: [] }],
  cards: [{ id: "c1", title: "Info", type: "text", config: { text: "Hello" } }, { id: "c2", title: "Mystery", type: "future", config: { z: 1 } }],
};

test("dashboard title and ordered views render safely", () => {
  const root = new Node("div");
  renderDashboard(root, { dashboards: [dashboard], activeDashboard: dashboard, activeViewId: "v1" }, {});
  assert.match(root.textContent, /Main <safe>/);
  const buttons = root.querySelectorAll("button");
  assert.deepEqual(buttons.map((b) => b.textContent), ["Second", "First"]);
});

test("active-view selection preserves and deterministically falls back", () => {
  assert.equal(selectActiveViewId(dashboard, "v1"), "v1");
  assert.equal(selectActiveViewId(dashboard, "missing"), "v2");
  assert.equal(selectActiveViewId({ views: [] }, "v1"), null);
});

test("view switching uses presentation state without backend mutation", () => {
  const root = new Node("div");
  renderDashboard(root, { dashboards: [dashboard], activeDashboard: dashboard, activeViewId: "v2" }, {});
  assert.deepEqual(dashboard.views.map((v) => v.id), ["v2", "v1"]);
});

test("ordered sections and cards render with fallback isolation", () => {
  const root = new Node("div");
  renderDashboard(root, { dashboards: [dashboard], activeDashboard: dashboard, activeViewId: "v1" }, {});
  assert.match(root.textContent, /Section 1/);
  assert.match(root.textContent, /Mystery/);
  assert.match(root.textContent, /Info/);
  assert.match(root.textContent, /Card type: future/);
});

test("empty dashboard view and section states render", () => {
  for (const activeDashboard of [null, { id: "d", title: "Empty", views: [], sections: [], cards: [] }, { id: "d", title: "View", views: [{ id: "v", title: "V", section_ids: [] }], sections: [], cards: [] }]) {
    const root = new Node("div");
    renderDashboard(root, { dashboards: activeDashboard ? [activeDashboard] : [], activeDashboard, activeViewId: "v" }, {});
    assert.match(root.textContent, /No dashboards|no views|no sections/i);
  }
  const root = new Node("div");
  renderDashboard(root, { dashboards: [dashboard], activeDashboard: dashboard, activeViewId: "v2" }, {});
  assert.match(root.textContent, /no cards/i);
});

test("malformed cards are isolated and open config displays only keys", () => {
  assert.match(renderCard(null).textContent, /Malformed card/);
  const card = { id: "e", title: "Open", type: "entity", config: { entity_id: "sensor.temp", message: "Hi" } };
  const rendered = renderCard(card);
  assert.match(rendered.textContent, /Card type: entity/);
  assert.match(rendered.textContent, /Configuration keys: entity_id, message/);
  assert.doesNotMatch(rendered.textContent, /sensor.temp|Hi/);
});

test("legacy shell foundation uses accessible scrollable view tabs and injected runtime", () => {
  const root = new Node("div");
  const dash = { ...dashboard, views: [{ id: "v1", title: "Home", section_ids: ["s1"] }], sections: [{ id: "s1", title: "Panels", card_ids: ["lp"] }], cards: [{ id: "lp", title: "Legacy", type: "legacy-panel", config: { subtitle: "Sub", status: "OK", accent: "energy", body: "<img onerror=alert(1)>" } }] };
  renderDashboard(root, { dashboards: [dash], activeDashboard: dash, activeViewId: "v1" }, { runtime: { connectionStatus: "connected" } });
  const nav = root.querySelectorAll("nav")[0];
  const tab = root.querySelectorAll("button")[0];
  assert.equal(nav.attributes.role, "tablist");
  assert.equal(tab.attributes.role, "tab");
  assert.equal(tab.attributes["aria-selected"], "true");
  assert.match(root.textContent, /Legacy/);
  assert.match(root.textContent, /<img onerror=alert\(1\)>/);
});


import { cardRendererTypes, registerCardRenderer, renderCard as renderCardWithRegistry } from "../src/render/card-renderer.js";
import { createCardRegistry, createDefaultCardRegistry, registerBuiltInCardTypes } from "../src/cards/registry.js";

test("built-in registries are deterministic and compatibility renderer APIs report real types", () => {
  const first = createDefaultCardRegistry();
  const second = createCardRegistry();
  registerBuiltInCardTypes(second);
  assert.deepEqual(first.types(), ["battery-status", "climate-control", "cover-control", "energy-flows", "energy-overview", "grid-status", "home-summary", "legacy-panel", "light-control", "sensor-status", "solar-production", "switch-control", "weather-current", "weather-forecast"]);
  assert.deepEqual(second.types(), ["battery-status", "climate-control", "cover-control", "energy-flows", "energy-overview", "grid-status", "home-summary", "legacy-panel", "light-control", "sensor-status", "solar-production", "switch-control", "weather-current", "weather-forecast"]);
  assert.throws(() => second.register({ type: "legacy-panel", displayName: "Duplicate", renderer: () => new Node("article") }), /already registered/);
  registerCardRenderer("compat-card", () => new Node("article"), second);
  assert.deepEqual(cardRendererTypes(second), ["battery-status", "climate-control", "compat-card", "cover-control", "energy-flows", "energy-overview", "grid-status", "home-summary", "legacy-panel", "light-control", "sensor-status", "solar-production", "switch-control", "weather-current", "weather-forecast"]);
  assert.equal(renderCardWithRegistry({ id: "x", title: "X", type: "compat-card", config: {} }, {}, { registry: second }).tagName, "article");
});
