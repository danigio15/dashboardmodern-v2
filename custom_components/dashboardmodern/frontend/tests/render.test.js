import assert from "node:assert/strict";
import test from "node:test";
import { renderDashboard, selectActiveViewId } from "../src/render/dashboard-renderer.js";
import { renderCard } from "../src/render/card-renderer.js";

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

test("malformed card and entity state update render locally", () => {
  assert.match(renderCard(null).textContent, /Malformed card/);
  const card = { id: "e", title: "Temp", type: "entity", config: { entity_id: "sensor.temp" } };
  assert.match(renderCard(card, { hass: { states: { "sensor.temp": { state: "72", attributes: { unit_of_measurement: "°F" } } } } }).textContent, /72 °F/);
  assert.match(renderCard(card, { hass: { states: { "sensor.temp": { state: "73", attributes: { unit_of_measurement: "°F" } } } } }).textContent, /73 °F/);
});
