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

import { CardReorderController, finalIndexToInsertionIndex, insertionIndexToFinalIndex } from "../src/editor/reorder.js";
import { EditorController } from "../src/editor/editor-controller.js";
import { DashboardModernStore } from "../src/state.js";

function baseMany() { const dash = dashboard(); dash.sections[0].card_ids = ["a", "b", "c", "d"]; return dash; }
function storeAndController({ fail = false } = {}) {
  let saves = 0; let persisted = baseMany();
  const api = { replaceDashboard: async (_entry, dash) => { saves += 1; if (fail) throw new Error("boom"); persisted = dash; return dash; }, listDashboards: async () => [persisted], getDashboard: async () => persisted };
  const store = new DashboardModernStore(api, { entryIdResolver: async () => "entry" });
  store.setState({ entryId: "entry", activeDashboard: baseMany(), activeDashboardId: "dash", dashboards: [baseMany()], mode: "edit" });
  const editor = new EditorController(store); return { store, editor, saves: () => saves };
}

class Target {
  constructor({ dataset = {}, parent = null, name = "node" } = {}) { this.dataset = dataset; this.parent = parent; this.name = name; this.attributes = {}; this.focused = false; }
  closest(selector) { if (selector === "[data-reorder-handle]") return this.dataset.reorderHandle !== undefined ? this : this.parent?.closest(selector); if (selector === "[data-section-id]") return this.dataset.sectionId ? this : this.parent?.closest(selector); if (selector === "[data-reorder-index]") return this.dataset.reorderIndex !== undefined ? this : this.parent?.closest(selector); return null; }
  setPointerCapture(id) { this.captured = id; }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  focus() { this.focused = true; }
  remove() {}
}
class Root {
  constructor(handle) { this.listeners = {}; this.handle = handle; this.live = { textContent: "" }; this.error = { hidden: true, textContent: "" }; this.activeCard = new Target({ dataset: { cardId: "b" } }); this.marker = new Target({ dataset: { reorderIndex: "3" } }); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  querySelector(selector) { if (selector === "[data-reorder-live]") return this.live; if (selector === "[data-reorder-error]") return this.error; if (selector.includes("data-reorder-handle")) return this.handle; if (selector.includes('data-card-id="b"')) return this.activeCard; return null; }
  querySelectorAll(selector) { if (selector === "[data-reorder-target]") return [this.marker]; if (selector.includes("data-reorder-active")) return [this.activeCard, this.handle, this.marker]; return []; }
}
function keyEvent(key, target) { return { key, target, prevented: false, preventDefault() { this.prevented = true; } }; }
function pointerEvent(type, target, pointerId = 1, x = 0, y = 0) { return { type, target, pointerId, clientX: x, clientY: y, prevented: false, preventDefault() { this.prevented = true; } }; }
async function setupReorder(options) {
  const { store, editor, saves } = storeAndController(options); await editor.enter(); store.setMode("edit");
  const section = new Target({ dataset: { sectionId: "s1" } }); const handle = new Target({ dataset: { reorderHandle: "", cardId: "b" }, parent: section }); const root = new Root(handle);
  const reorder = new CardReorderController(store, editor, root); return { store, editor, saves, section, handle, root, reorder };
}
function order(store) { return store.state.editor.draftDashboard.sections[0].card_ids; }

test("keyboard final indexes convert to insertion slots deterministically", () => {
  assert.equal(finalIndexToInsertionIndex(2, 1), 3);
  assert.equal(finalIndexToInsertionIndex(3, 1), 4);
  assert.equal(finalIndexToInsertionIndex(0, 3), 0);
  assert.equal(insertionIndexToFinalIndex(3, 1), 2);
  assert.equal(insertionIndexToFinalIndex(4, 1), 3);
  assert.equal(insertionIndexToFinalIndex(0, 3), 0);
});

test("keyboard move mode supports entry movement commit focus and remains editing", async () => {
  const t = await setupReorder();
  t.reorder.onKeyDown(keyEvent(" ", t.handle)); assert.equal(t.reorder.keyboard.finalIndex, 1); assert.match(t.root.live.textContent, /Picked up B, position 2 of 4/);
  t.reorder.onKeyDown(keyEvent("ArrowDown", t.handle)); assert.equal(t.reorder.keyboard.finalIndex, 2);
  t.reorder.onKeyDown(keyEvent("ArrowRight", t.handle)); assert.equal(t.reorder.keyboard.finalIndex, 3);
  t.reorder.onKeyDown(keyEvent("ArrowDown", t.handle)); assert.equal(t.reorder.keyboard.finalIndex, 3);
  await t.reorder.onKeyDown(keyEvent("Enter", t.handle)); await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(order(t.store), ["a", "c", "d", "b"]); assert.equal(t.saves(), 1); assert.equal(t.store.state.mode, "edit"); assert.equal(t.store.state.editor.editing, true); assert.equal(t.store.state.editor.dirty, false); assert.equal(t.handle.focused, true); assert.match(t.root.live.textContent, /B placed at position 4 of 4/);
});

test("keyboard Enter startup arrows home end escape and space commit", async () => {
  const t = await setupReorder();
  t.reorder.onKeyDown(keyEvent("Enter", t.handle)); assert.equal(t.reorder.keyboard.finalIndex, 1);
  t.reorder.onKeyDown(keyEvent("ArrowUp", t.handle)); assert.equal(t.reorder.keyboard.finalIndex, 0);
  t.reorder.onKeyDown(keyEvent("ArrowLeft", t.handle)); assert.equal(t.reorder.keyboard.finalIndex, 0);
  t.reorder.onKeyDown(keyEvent("End", t.handle)); assert.equal(t.reorder.keyboard.finalIndex, 3);
  t.reorder.onKeyDown(keyEvent("Home", t.handle)); assert.equal(t.reorder.keyboard.finalIndex, 0);
  t.reorder.onKeyDown(keyEvent("Escape", t.handle)); assert.equal(t.saves(), 0);
  t.reorder.onKeyDown(keyEvent("Enter", t.handle)); t.reorder.onKeyDown(keyEvent("ArrowDown", t.handle)); await t.reorder.onKeyDown(keyEvent(" ", t.handle));
  assert.deepEqual(order(t.store), ["a", "c", "b", "d"]); assert.equal(t.saves(), 1);
});

test("pointer interaction threshold hover valid drop cancel lost capture no-op and invalid destination", async () => {
  const t = await setupReorder(); const body = new Target();
  t.reorder.onPointerDown(pointerEvent("pointerdown", body)); assert.equal(t.reorder.drag, null);
  t.reorder.onPointerDown(pointerEvent("pointerdown", t.handle, 7, 0, 0)); assert.equal(t.reorder.drag.status, "pending");
  t.reorder.onPointerMove(pointerEvent("pointermove", t.handle, 7, 2, 2)); assert.equal(t.reorder.drag.status, "pending");
  const marker = new Target({ dataset: { reorderIndex: "3" } });
  t.reorder.onPointerMove(pointerEvent("pointermove", marker, 7, 10, 0)); assert.equal(t.reorder.drag.status, "dragging"); assert.equal(t.reorder.drag.proposedIndex, 3); assert.equal(t.saves(), 0);
  await t.reorder.onPointerUp(pointerEvent("pointerup", marker, 7, 10, 0)); assert.deepEqual(order(t.store), ["a", "c", "b", "d"]); assert.equal(t.saves(), 1);
  const c = await setupReorder(); c.reorder.onPointerDown(pointerEvent("pointerdown", c.handle, 1, 0, 0)); c.reorder.onPointerMove(pointerEvent("pointermove", c.handle, 1, 9, 0)); c.reorder.cancel(); assert.equal(c.saves(), 0);
  const l = await setupReorder(); l.reorder.onPointerDown(pointerEvent("pointerdown", l.handle, 1, 0, 0)); l.reorder.onPointerMove(pointerEvent("pointermove", l.handle, 1, 9, 0)); l.root.listeners.lostpointercapture({}); assert.equal(l.saves(), 0);
  const n = await setupReorder(); n.reorder.onPointerDown(pointerEvent("pointerdown", n.handle, 1, 0, 0)); n.reorder.onPointerMove(pointerEvent("pointermove", n.handle, 1, 9, 0)); await n.reorder.onPointerUp(pointerEvent("pointerup", n.handle, 1, 9, 0)); assert.equal(n.saves(), 0);
  const i = await setupReorder(); i.reorder.onPointerDown(pointerEvent("pointerdown", i.handle, 1, 0, 0)); i.reorder.onPointerMove(pointerEvent("pointermove", new Target({ dataset: { reorderIndex: "99" } }), 1, 9, 0)); assert.equal(i.saves(), 0);
});

test("persistence failure restores previous order remains editable clears ui announces and retry works", async () => {
  const fail = await setupReorder({ fail: true });
  fail.reorder.onKeyDown(keyEvent("Enter", fail.handle)); fail.reorder.onKeyDown(keyEvent("End", fail.handle)); await fail.reorder.onKeyDown(keyEvent("Enter", fail.handle));
  assert.deepEqual(order(fail.store), ["a", "b", "c", "d"]); assert.equal(fail.store.state.mode, "edit"); assert.equal(fail.reorder.keyboard, null); assert.equal(fail.root.live.textContent, "Unable to move card.");
  const retry = await setupReorder(); retry.reorder.onKeyDown(keyEvent("Enter", retry.handle)); retry.reorder.onKeyDown(keyEvent("End", retry.handle)); await retry.reorder.onKeyDown(keyEvent("Enter", retry.handle)); assert.deepEqual(order(retry.store), ["a", "c", "d", "b"]);
});

test("stale state at commit aborts missing card missing section duplicate and re-evaluates latest order", async () => {
  for (const mutate of [
    (s) => { s.state.editor.draftDashboard.sections[0].card_ids = ["a", "c", "d"]; },
    (s) => { s.state.editor.draftDashboard.sections = []; },
    (s) => { s.state.editor.draftDashboard.sections[0].card_ids = ["a", "b", "b", "d"]; },
  ]) { const t = await setupReorder(); t.reorder.onKeyDown(keyEvent("Enter", t.handle)); mutate(t.store); await t.reorder.commit("s1", "b", 3); assert.equal(t.saves(), 0); assert.equal(t.root.live.textContent, "Unable to move card."); }
  const latest = await setupReorder(); latest.reorder.onKeyDown(keyEvent("Enter", latest.handle)); latest.store.state.editor.draftDashboard.sections[0].card_ids = ["a", "c", "b", "d"]; await latest.reorder.commit("s1", "b", 4); assert.deepEqual(order(latest.store), ["a", "c", "d", "b"]);
});

test("ordinary save exits edit but reorder save remains in edit", async () => {
  const normal = storeAndController(); await normal.editor.enter(); normal.editor.updateDashboard({ title: "changed" }); await normal.editor.save(); assert.equal(normal.store.state.mode, "visual");
  const remain = await setupReorder(); remain.reorder.onKeyDown(keyEvent("Enter", remain.handle)); remain.reorder.onKeyDown(keyEvent("End", remain.handle)); await remain.reorder.onKeyDown(keyEvent("Enter", remain.handle)); assert.equal(remain.store.state.mode, "edit");
});
