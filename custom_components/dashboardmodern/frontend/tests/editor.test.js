import assert from "node:assert/strict";
import test from "node:test";
import * as c from "../src/editor/commands.js";
import { EditorController } from "../src/editor/editor-controller.js";
import { DashboardModernStore } from "../src/state.js";

const base = () => ({
  id: "dash",
  title: "Dash",
  description: "D",
  views: [{ id: "v1", title: "V1", section_ids: ["s1"] }, { id: "v2", title: "V2", section_ids: [] }],
  sections: [{ id: "s1", title: "S1", card_ids: ["c1"] }],
  cards: [{ id: "c1", title: "C1", type: "unknown", config: { a: 1 } }],
});

function storeWithApi(api = {}) {
  const store = new DashboardModernStore(api, { entryIdResolver: async () => "e" });
  store.setState({ entryId: "e", activeDashboard: base(), activeDashboardId: "dash", dashboards: [base()] });
  return store;
}

test("entering edit mode creates an independent draft and cancel discards changes", async () => {
  const store = storeWithApi();
  const controller = new EditorController(store);
  await controller.enter();
  controller.updateDashboard({ title: "Draft" });
  assert.equal(store.state.activeDashboard.title, "Dash");
  assert.equal(store.state.editor.dirty, true);
  await controller.cancel();
  assert.equal(store.state.editor.draftDashboard, null);
  assert.equal(store.state.activeDashboard.title, "Dash");
});

test("successful save commits backend response and failed save preserves dirty draft", async () => {
  let fail = false;
  const api = {
    replaceDashboard: async (_entryId, dashboard) => {
      if (fail) throw new Error("nope");
      return { ...dashboard, title: "Backend" };
    },
    listDashboards: async () => [{ id: "dash", title: "Backend" }],
    getDashboard: async () => ({ ...base(), title: "Backend" }),
  };
  const store = storeWithApi(api);
  const controller = new EditorController(store);
  await controller.enter();
  controller.updateDashboard({ title: "Draft" });
  await controller.save();
  assert.equal(store.state.activeDashboard.title, "Backend");
  assert.equal(store.state.editor.dirty, false);

  fail = true;
  await controller.enter();
  controller.updateDashboard({ title: "Dirty" });
  await controller.save();
  assert.equal(store.state.editor.dirty, true);
  assert.equal(store.state.editor.saving, false);
  assert.equal(store.state.editor.draftDashboard.title, "Dirty");
  assert.equal(store.state.editor.saveError.code, "dashboardmodern_error");
});

test("editor saving state prevents double saves and transitions around backend calls", async () => {
  let calls = 0;
  let resolveSave;
  const api = {
    replaceDashboard: async (_entryId, dashboard) => {
      calls += 1;
      await new Promise((resolve) => { resolveSave = resolve; });
      return dashboard;
    },
    listDashboards: async () => [base()],
    getDashboard: async () => base(),
  };
  const store = storeWithApi(api);
  const controller = new EditorController(store);
  await controller.enter();
  controller.updateDashboard({ title: "Dirty" });
  const first = controller.save();
  assert.equal(store.state.editor.saving, true);
  assert.equal(store.state.editor.dirty, true);
  assert.equal(await controller.save(), false);
  assert.equal(calls, 1);
  resolveSave();
  assert.equal(await first, true);
  assert.equal(store.state.editor.saving, false);
  assert.equal(store.state.editor.dirty, false);
});

test("add update remove move view section card and cascade integrity", () => {
  const generator = c.createIdGenerator("id", [1]);
  let draft = base();
  draft = c.addView(draft, { title: "New" }, generator);
  assert.equal(draft.views.at(-1).id, "id-1");
  draft = c.updateView(draft, "id-1", { title: "Renamed" });
  assert.equal(draft.views.at(-1).title, "Renamed");
  draft = c.moveView(draft, "id-1", -1);
  assert.equal(draft.views[1].id, "id-1");
  draft = c.addSection(draft, "id-1", {}, generator);
  assert.equal(draft.views[1].section_ids[0], "id-2");
  draft = c.updateSection(draft, "id-2", { title: "Sec" });
  draft = c.moveSection(draft, "id-1", "id-2", -1);
  assert.equal(draft.sections.find((section) => section.id === "id-2").title, "Sec");
  draft = c.addCard(draft, "id-2", { type: "mystery", config: { x: 1 } }, generator);
  assert.equal(draft.cards.at(-1).type, "mystery");
  draft = c.updateCard(draft, "id-3", { title: "Card" });
  draft = c.moveCard(draft, "id-2", "id-3", -1);
  assert.equal(draft.cards.find((card) => card.id === "id-3").title, "Card");
  draft = c.removeView(draft, "id-1");
  assert.equal(draft.sections.some((section) => section.id === "id-2"), false);
  assert.equal(draft.cards.some((card) => card.id === "id-3"), false);
  draft = c.removeSection(draft, "s1");
  assert.equal(draft.cards.some((card) => card.id === "c1"), false);
});

test("commands reject missing parents and explicit duplicate ids without changing input", () => {
  const original = base();
  const before = JSON.stringify(original);
  assert.throws(() => c.addSection(original, "missing"), /view does not exist/);
  assert.throws(() => c.addCard(original, "missing"), /section does not exist/);
  assert.throws(() => c.addView(original, { id: "s1" }), /Duplicate editor node id/);
  assert.throws(() => c.addSection(original, "v1", { id: "c1" }), /Duplicate editor node id/);
  assert.throws(() => c.addCard(original, "s1", { id: "v2" }), /Duplicate editor node id/);
  assert.equal(JSON.stringify(original), before);
});

test("duplicate id prevention and deterministic id generation", () => {
  const generator = () => "v1";
  assert.throws(() => c.addView(base(), {}, generator), /Duplicate editor node id/);
  const sequence = c.createIdGenerator("safe", [7]);
  assert.equal(sequence(new Set()), "safe-7");
});

test("card config rejects invalid JSON arrays primitives but unknown types remain editable", () => {
  assert.throws(() => c.parseCardConfig("[1]"), /object/);
  assert.throws(() => c.parseCardConfig("1"), /object/);
  assert.deepEqual(c.parseCardConfig('{"ok":true}'), { ok: true });
  const draft = c.updateCard(base(), "c1", { type: "whatever" });
  assert.equal(draft.cards[0].type, "whatever");
});

test("controller-owned unsaved guard protects dashboard switch deletion and leaving edit", async () => {
  const api = { getDashboard: async () => ({ ...base(), id: "other" }), deleteDashboard: async () => undefined };
  const store = storeWithApi(api);
  let asked = 0;
  const controller = new EditorController(store, { confirmUnsaved: async () => { asked += 1; return false; } });
  await controller.enter();
  controller.updateDashboard({ title: "Dirty" });
  assert.equal(await controller.loadDashboard("other"), false);
  assert.equal(store.state.activeDashboardId, "dash");
  assert.equal(await controller.deleteDashboard(), false);
  assert.equal(store.state.activeDashboardId, "dash");
  assert.equal(await controller.cancel(), false);
  assert.equal(store.state.editor.dirty, true);
  assert.equal(asked, 3);
});

test("replacing a draft with a fresh backend load is guarded through controller", async () => {
  const api = { getDashboard: async () => ({ ...base(), id: "other", title: "Other" }) };
  const store = storeWithApi(api);
  const controller = new EditorController(store, { confirmUnsaved: async () => true });
  await controller.enter();
  controller.updateDashboard({ title: "Dirty" });
  assert.equal(await controller.loadDashboard("other"), true);
  assert.equal(store.state.activeDashboardId, "other");
  assert.equal(store.state.editor.draftDashboard, null);
});

test("pressing Edit repeatedly with a dirty draft is idempotent", async () => {
  const store = storeWithApi();
  let asked = 0;
  const controller = new EditorController(store, { confirmUnsaved: async () => { asked += 1; return true; } });
  await controller.setMode("edit");
  controller.updateDashboard({ title: "Dirty" });
  const draft = store.state.editor.draftDashboard;
  await controller.setMode("edit");
  assert.equal(store.state.editor.draftDashboard, draft);
  assert.equal(store.state.editor.draftDashboard.title, "Dirty");
  assert.equal(asked, 0);
});

test("Edit and Debug JSON share draft and invalid debug JSON does not corrupt it", async () => {
  const store = storeWithApi();
  const controller = new EditorController(store);
  await controller.enter();
  assert.equal(controller.updateDebugJson('{"id":"dash","title":"Json","views":[],"sections":[],"cards":[]}'), true);
  assert.equal(store.state.editor.draftDashboard.title, "Json");
  controller.updateDebugJson("{bad");
  assert.equal(store.state.editor.draftDashboard.title, "Json");
  assert.ok(store.state.editor.debugError);
});

test("Debug JSON structural validation keeps previous draft for invalid structures", async () => {
  const invalidDrafts = [
    "null",
    "[]",
    "1",
    '{"id":"dash","views":{},"sections":[],"cards":[]}',
    '{"id":"dash","views":[{"id":"dup","section_ids":[]}],"sections":[{"id":"dup","card_ids":[]}],"cards":[]}',
    '{"id":"dash","views":[{"id":"v","section_ids":["missing"]}],"sections":[],"cards":[]}',
    '{"id":"dash","views":[],"sections":[{"id":"s","card_ids":["missing"]}],"cards":[]}',
    '{"id":"dash","views":[],"sections":[],"cards":[{"id":"c","title":"C","type":"x","config":[]}]}'
  ];
  for (const text of invalidDrafts) {
    const store = storeWithApi();
    const controller = new EditorController(store);
    await controller.enter();
    const before = store.state.editor.draftDashboard;
    assert.equal(controller.updateDebugJson(text), false, text);
    assert.equal(store.state.editor.draftDashboard, before, text);
    assert.ok(store.state.editor.debugError || store.state.editor.validationErrors.length, text);
  }
});

test("Debug JSON validation rejects sections and cards referenced by multiple parents", async () => {
  const invalidOwnership = [
    '{"id":"dash","views":[{"id":"v1","section_ids":["s1"]},{"id":"v2","section_ids":["s1"]}],"sections":[{"id":"s1","card_ids":[]}],"cards":[]}',
    '{"id":"dash","views":[{"id":"v1","section_ids":["s1","s2"]}],"sections":[{"id":"s1","card_ids":["c1"]},{"id":"s2","card_ids":["c1"]}],"cards":[{"id":"c1","title":"C","type":"x","config":{}}]}'
  ];
  for (const text of invalidOwnership) {
    const store = storeWithApi();
    const controller = new EditorController(store);
    await controller.enter();
    const before = store.state.editor.draftDashboard;
    assert.equal(controller.updateDebugJson(text), false, text);
    assert.equal(store.state.editor.draftDashboard, before, text);
    assert.match(store.state.editor.debugError, /multiple/);
  }
});

test("removing a card clears stale local field text and validation errors for that card", async () => {
  const store = storeWithApi();
  const controller = new EditorController(store);
  await controller.enter();
  controller.updateCardConfig("c1", "[");
  assert.equal(store.state.editor.fieldText["card:c1:config"], "[");
  assert.equal(store.state.editor.validationErrors.some((error) => error.field === "card:c1:config"), true);
  controller.removeCard("c1");
  assert.equal(store.state.editor.fieldText["card:c1:config"], undefined);
  assert.equal(store.state.editor.validationErrors.some((error) => error.field === "card:c1:config"), false);
});
