import assert from "node:assert/strict";
import test from "node:test";
import { defaultCardLayout, isPlainObject, normalizeCardLayout, parseInteger, validateCardLayout } from "../src/layout.js";
import { updateCard } from "../src/editor/commands.js";
import { validateRegisteredCardConfigs } from "../src/editor/card-validation.js";
import { createCardRegistry } from "../src/cards/registry.js";

const d = defaultCardLayout();

test("layout helpers identify plain objects and parse only actual integers", () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject([]), false);
  assert.deepEqual(parseInteger(null), { ok: false, missing: true });
  assert.deepEqual(parseInteger(""), { ok: false, missing: true });
  assert.equal(parseInteger("1").ok, false);
  assert.equal(parseInteger(1.5).ok, false);
  assert.deepEqual(parseInteger(2), { ok: true, value: 2 });
});

test("normalization covers legacy, complete, partial, and immutable behavior", () => {
  const card = { id: "c", config: {}, layout: { desktop: { columns: 7, rows: 2 }, tablet: { columns: 5 }, mobile: {} } };
  const before = JSON.stringify(card);
  assert.deepEqual(normalizeCardLayout({}).layout, d);
  assert.equal(normalizeCardLayout({}).status, "legacy");
  assert.equal(normalizeCardLayout(card).status, "partial");
  assert.deepEqual(normalizeCardLayout(card).layout, { desktop: { columns: 7, rows: 2 }, tablet: { columns: 5, rows: 1 }, mobile: { columns: 4, rows: 1 } });
  assert.equal(JSON.stringify(card), before);
  assert.equal(normalizeCardLayout({ layout: { desktop: { columns: 1, rows: 1 }, tablet: { columns: 1, rows: 1 }, mobile: { columns: 1, rows: 1 } } }).status, "valid");
});

test("malformed layout values are rejected and fall back safely", () => {
  for (const layout of [[], { desktop: [] }, { desktop: { columns: 0 } }, { desktop: { columns: -1 } }, { desktop: { columns: 1.2 } }, { desktop: { columns: "1" } }, { desktop: { columns: {} } }, { desktop: { columns: 13 } }, { tablet: { columns: 9 } }, { mobile: { columns: 5 } }, { mobile: { rows: 13 } }]) {
    const result = normalizeCardLayout({ layout });
    assert.equal(result.status, "malformed", JSON.stringify(layout));
    assert.deepEqual(result.layout, d);
    assert.ok(result.errors.length);
  }
  assert.equal(validateCardLayout({ desktop: { columns: null, rows: null } }).length, 0);
});

test("validation combines deterministic layout and config errors", () => {
  const registry = createCardRegistry();
  registry.register({ type: "x", displayName: "X", renderer: () => ({}), validateConfig: () => [{ field: "name", message: "Name required." }] });
  const errors = validateRegisteredCardConfigs({ cards: [{ id: "c", type: "x", config: {}, layout: { mobile: { columns: 5 } } }] }, registry);
  assert.deepEqual(errors.map((e) => e.field), ["card:c:config.name", "card:c:layout.mobile.columns"]);
  assert.equal(validateRegisteredCardConfigs({ cards: [{ id: "old", type: "none", config: {} }] }, registry).length, 0);
});

test("card serialization compatibility preserves layout and config independently", () => {
  const dashboard = { cards: [{ id: "c", title: "T", type: "future", config: { a: 1 }, layout: { desktop: { columns: 6, rows: 2 } } }] };
  assert.deepEqual(updateCard(dashboard, "c", { config: { b: 2 } }).cards[0].layout, dashboard.cards[0].layout);
  const edited = updateCard(dashboard, "c", { layout: { tablet: { columns: 4, rows: 1 } } }).cards[0];
  assert.deepEqual(edited.config, { a: 1 });
  assert.equal(edited.title, "T");
  assert.equal(edited.type, "future");
});

class EditorNode { constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.className="";this._text="";this.value="";this.type="";this.min="";this.max="";this.step="";this.id="";this.listeners={};} append(...i){this.children.push(...i)} setAttribute(k,v){this.attributes[k]=String(v); if(k==="for")this.htmlFor=String(v);} addEventListener(t,f){this.listeners[t]=f;this[`on${t}`]=f} get textContent(){return this._text+this.children.map(c=>c.textContent).join("")} set textContent(v){this._text=String(v);this.children=[]} querySelectorAll(sel){const out=[];const m=n=>sel.startsWith("[")?Boolean(n.dataset?.editorField):n.tagName===sel;const w=n=>{if(m(n))out.push(n);n.children.forEach(w)};w(this);return out;} }
const doc = { createElement: (tag) => new EditorNode(tag) };

test("layout editor exposes six associated numeric inputs and immutable layout patches", async () => {
  const { renderCardForm } = await import("../src/editor/card-form.js");
  const patches = [];
  const card = { id: "c", title: "Title", type: "future", config: { keep: true }, layout: { desktop: { columns: 6, rows: 2 }, tablet: { columns: 4, rows: 1 }, mobile: { columns: 4, rows: 1 } } };
  const controller = { updateCard: () => {}, changeCardType: () => {}, updateCardConfig: () => {}, updateCardLayoutValue: (id, bp, field, value) => patches.push({ id, bp, field, value }) };
  const form = renderCardForm(doc, card, controller, [], {}, undefined);
  const layoutInputs = form.querySelectorAll("input").filter((input) => input.dataset.editorField?.includes(":layout."));
  assert.equal(layoutInputs.length, 6);
  assert.equal(form.querySelectorAll("textarea").length, 1);
  assert.doesNotMatch(form.textContent, /custom css|template|html field/i);
  for (const input of layoutInputs) {
    assert.equal(input.type, "number");
    assert.equal(input.min, "1");
    assert.equal(input.step, "1");
    assert.ok(form.querySelectorAll("label").some((label) => label.attributes.for === input.id));
  }
  assert.equal(layoutInputs.find((i) => i.dataset.editorField === "card:c:layout.desktop.columns").max, "12");
  assert.equal(layoutInputs.find((i) => i.dataset.editorField === "card:c:layout.tablet.columns").max, "8");
  assert.equal(layoutInputs.find((i) => i.dataset.editorField === "card:c:layout.mobile.columns").max, "4");
  const desktopColumns = layoutInputs.find((i) => i.dataset.editorField === "card:c:layout.desktop.columns");
  desktopColumns.value = "7"; desktopColumns.oninput();
  assert.deepEqual(patches.at(-1), { id: "c", bp: "desktop", field: "columns", value: "7" });
});
