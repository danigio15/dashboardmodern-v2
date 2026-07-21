import assert from "node:assert/strict";
import test from "node:test";
import { reorderCard } from "../src/editor/commands.js";
import { renderDashboard } from "../src/render/dashboard-renderer.js";

class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.hidden = false; this._text = ""; this.className = ""; this.style = { setProperty() {} }; }
  append(...items) { this.children.push(...items); }
  prepend(...items) { this.children.unshift(...items); }
  replaceChildren(...items) { this.children = items; this._text = ""; }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k.startsWith("data-")) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
  set textContent(v) { this._text = String(v); this.children = []; }
  querySelectorAll(selector) {
    const out = [];
    const match = (n) => selector === ".dashboardmodern-card" ? n.className?.split?.(" ").includes("dashboardmodern-card") : selector === "[data-reorder-handle]" ? Object.hasOwn(n.dataset, "reorderHandle") : selector === "[data-reorder-live]" ? Object.hasOwn(n.dataset, "reorderLive") : selector === "[aria-grabbed]" ? Object.hasOwn(n.attributes, "aria-grabbed") : selector.includes("[data-reorder-index]") ? Object.hasOwn(n.dataset, "reorderIndex") : false;
    const walk = (n) => { if (match(n)) out.push(n); for (const c of n.children) walk(c); };
    walk(this); return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
globalThis.document = { createElement: (tag) => new Node(tag) };

const dashboard = () => ({
  id: "dash", title: "Dash",
  views: [{ id: "v1", title: "View", section_ids: ["s1", "s2"] }],
  sections: [{ id: "s1", title: "One", card_ids: ["a", "b", "c", "d"] }, { id: "s2", title: "Two", card_ids: [] }],
  cards: [
    { id: "a", title: "A", type: "x", config: { a: 1 }, layout: { desktop: { columns: 2, rows: 1 } }, extra: { keep: true } },
    { id: "b", title: "B", type: "x", config: { nested: { ok: true } }, layout: { mobile: { columns: 4, rows: 2 } }, unknown: [1] },
    { id: "c", title: "C", type: "x", config: {} },
    { id: "d", title: "D", type: "x", config: {} },
  ],
});

function ids(result) { return result.sections.find((s) => s.id === "s1").card_ids; }

test("pure reorder handles first last earlier later and deterministic no-op", () => {
  assert.deepEqual(ids(reorderCard(dashboard(), "s1", "a", 4)), ["b", "c", "d", "a"]);
  assert.deepEqual(ids(reorderCard(dashboard(), "s1", "d", 0)), ["d", "a", "b", "c"]);
  assert.deepEqual(ids(reorderCard(dashboard(), "s1", "c", 1)), ["a", "c", "b", "d"]);
  assert.deepEqual(ids(reorderCard(dashboard(), "s1", "b", 3)), ["a", "c", "b", "d"]);
  assert.deepEqual(ids(reorderCard(dashboard(), "s1", "b", 1)), ["a", "b", "c", "d"]);
  assert.deepEqual(reorderCard(dashboard(), "s1", "b", 1), reorderCard(dashboard(), "s1", "b", 1));
});

test("pure reorder rejects invalid target indexes and malformed state", () => {
  for (const bad of [-1, 99, 1.5, NaN]) assert.throws(() => reorderCard(dashboard(), "s1", "b", bad));
  assert.throws(() => reorderCard(dashboard(), "s1", "missing", 0), /card/);
  assert.throws(() => reorderCard(dashboard(), "missing", "b", 0), /section/);
  const dup = dashboard(); dup.sections[0].card_ids = ["a", "b", "b"];
  assert.throws(() => reorderCard(dup, "s1", "b", 0), /duplicate/);
});

test("pure reorder preserves cards layout config unknown data and unrelated sections immutably", () => {
  const source = dashboard(); const before = JSON.stringify(source);
  const result = reorderCard(source, "s1", "b", 4);
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(result.cards.find((c) => c.id === "b").config, { nested: { ok: true } });
  assert.deepEqual(result.cards.find((c) => c.id === "b").layout, { mobile: { columns: 4, rows: 2 } });
  assert.deepEqual(result.cards.find((c) => c.id === "b").unknown, [1]);
  assert.notEqual(result.sections[0], source.sections[0]);
  assert.deepEqual(result.sections[1], source.sections[1]);
});

test("edit mode renders explicit accessible handles and insertion targets only without changing DOM card order", () => {
  const container = document.createElement("div");
  renderDashboard(container, { mode: "visual", activeDashboard: dashboard(), activeViewId: "v1" });
  assert.equal(container.querySelector("[data-reorder-handle]"), null);
  renderDashboard(container, { mode: "edit", editor: { editing: true }, activeDashboard: dashboard(), activeViewId: "v1" });
  const handles = [...container.querySelectorAll("[data-reorder-handle]")];
  assert.equal(handles.length, 4);
  assert.equal(handles[1].getAttribute("aria-label"), "Move card: B");
  assert.ok(container.querySelector("[data-reorder-live]"));
  assert.equal(container.querySelector("[aria-grabbed]"), null);
  assert.deepEqual([...container.querySelectorAll(".dashboardmodern-card")].map((n) => n.dataset.cardId), ["a", "b", "c", "d"]);
  assert.deepEqual([...container.querySelectorAll('[data-section-id="s1"] [data-reorder-index]')].map((n) => n.dataset.reorderIndex).slice(0, 5), ["0", "1", "2", "3", "4"]);
});
