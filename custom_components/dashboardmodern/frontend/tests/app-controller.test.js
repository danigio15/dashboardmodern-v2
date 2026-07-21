import assert from "node:assert/strict";
import test from "node:test";
import { bindDashboardModernApp, renderEditor, renderVisualDashboard } from "../src/app.js";
import { DashboardModernStore } from "../src/state.js";
import { renderDashboard } from "../src/render/dashboard-renderer.js";

class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.hidden = false; this.disabled = false; this._text = ""; this.listeners = {}; this.value = ""; this.ownerDocument = globalThis.document; }
  append(...items) { this.children.push(...items); }
  set innerHTML(_v) { this.children = []; this._text = ""; }
  replaceChildren(...items) { this.children = items; this._text = ""; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  click() { return this.listeners.click?.({ target: this }); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
  set textContent(v) { this._text = String(v); this.children = []; }
  querySelectorAll(selector) {
    const out = [];
    const match = (n) => selector === "[data-debug-action]" ? Object.hasOwn(n.dataset, "debugAction") : selector.startsWith("[data-view-id]") ? Object.hasOwn(n.dataset, "viewId") : n.tagName === selector;
    const walk = (n) => { if (match(n)) out.push(n); for (const c of n.children) walk(c); };
    walk(this); return out;
  }
}

globalThis.document = { activeElement: null, createElement: (tag) => new Node(tag) };

function makeContainer() {
  const visual = new Node("section");
  const debug = new Node("section");
  const editor = new Node("textarea");
  const create = new Node("button"); create.dataset.debugAction = "";
  const save = new Node("button"); save.dataset.debugAction = "";
  const nodes = { "[data-dashboard-visual]": visual, "[data-debug-panel]": debug, "[data-dashboard-editor]": editor };
  return {
    visual, debug, editor, create, save,
    querySelector(selector) { return nodes[selector] || null; },
    querySelectorAll(selector) { return selector === "[data-debug-action]" ? [create, save] : []; },
  };
}

const dashboard = {
  id: "dash", title: "Dash",
  views: [{ id: "one", title: "One", section_ids: ["s1"] }, { id: "two", title: "Two", section_ids: ["s2"] }],
  sections: [{ id: "s1", title: "First section", card_ids: [] }, { id: "s2", title: "Second section", card_ids: [] }],
  cards: [],
};

test("controller view navigation changes presentation state without backend mutation or saves", () => {
  const before = JSON.stringify(dashboard);
  const apiCalls = [];
  const store = { setActiveView(id) { this.state.activeViewId = id; }, createDashboard() { apiCalls.push("create"); }, replaceDashboard() { apiCalls.push("replace"); }, state: { activeViewId: "one" } };
  const container = makeContainer();
  renderDashboard(container.visual, { dashboards: [dashboard], activeDashboard: dashboard, activeViewId: "one" }, {});
  const buttons = container.visual.querySelectorAll("button");
  assert.equal(buttons.length, 2);
  store.setActiveView(buttons[1].dataset.viewId);
  renderDashboard(container.visual, { dashboards: [dashboard], activeDashboard: dashboard, activeViewId: store.state.activeViewId }, {});
  assert.equal(store.state.activeViewId, "two");
  assert.match(container.visual.textContent, /Second section/);
  assert.equal(JSON.stringify(dashboard), before);
  assert.deepEqual(apiCalls, []);
});

test("mode switching controls debug action availability without backend reads", () => {
  const container = makeContainer();
  const state = { mode: "visual", activeDashboard: dashboard };
  renderEditor(container, state);
  assert.equal(container.debug.hidden, true);
  assert.equal(container.visual.hidden, false);
  assert.equal(container.create.hidden, true);
  assert.equal(container.save.disabled, true);
  renderEditor(container, { ...state, mode: "debug" });
  assert.equal(container.debug.hidden, false);
  assert.equal(container.visual.hidden, true);
  assert.equal(container.create.disabled, false);
  assert.equal(container.save.hidden, false);
});

test("top-level render failures are reentrancy safe and clear on success", () => {
  const container = makeContainer();
  const states = [];
  const store = new DashboardModernStore({}, { entryIdResolver: async () => "entry" });
  store.subscribe((state) => states.push(state.renderError?.message || null));
  const failing = () => { throw new Error("boom"); };
  renderVisualDashboard(container, store.state, store, { renderer: failing });
  renderVisualDashboard(container, store.state, store, { renderer: failing });
  assert.equal(store.state.renderError.message, "boom (render_error)");
  assert.equal(states.filter((message) => message === "boom (render_error)").length, 1);
  renderVisualDashboard(container, store.state, store, { renderer: renderDashboard });
  assert.equal(store.state.renderError, null);
});

function makeBoundContainer() {
  const visual = new Node("section");
  const debug = new Node("section");
  const editor = new Node("textarea");
  const visualEditor = new Node("section");
  const status = new Node("section");
  const renderStatus = new Node("section");
  const list = new Node("div");
  const actions = {
    visual: new Node("button"), edit: new Node("button"), debug: new Node("button"), create: new Node("button"), save: new Node("button"), delete: new Node("button"),
  };
  actions.create.dataset.debugAction = "";
  actions.save.dataset.debugAction = "";
  const nodes = {
    "[data-dashboard-visual]": visual,
    "[data-debug-panel]": debug,
    "[data-dashboard-editor]": editor,
    "[data-visual-editor]": visualEditor,
    "[data-status]": status,
    "[data-render-status]": renderStatus,
    "[data-dashboard-list]": list,
    '[data-action="mode-visual"]': actions.visual,
    '[data-action="mode-edit"]': actions.edit,
    '[data-action="mode-debug"]': actions.debug,
    '[data-action="create"]': actions.create,
    '[data-action="save"]': actions.save,
    '[data-action="delete"]': actions.delete,
  };
  return {
    visual, debug, editor, visualEditor, status, renderStatus, list, actions,
    querySelector(selector) { return nodes[selector] || null; },
    querySelectorAll(selector) { return selector === "[data-debug-action]" ? [actions.create, actions.save] : []; },
  };
}

test("application wiring routes dashboard selection delete and mode changes through editor guard", async () => {
  const other = { ...dashboard, id: "other", title: "Other" };
  let deleteCalls = 0;
  const api = {
    listDashboards: async () => [dashboard, other],
    getDashboard: async (_entryId, id) => id === "other" ? other : dashboard,
    deleteDashboard: async () => { deleteCalls += 1; },
  };
  const store = new DashboardModernStore(api, { entryIdResolver: async () => "entry" });
  const container = makeBoundContainer();
  let asks = 0;
  await bindDashboardModernApp(container, store, { initialize: true, confirmUnsaved: async () => { asks += 1; return false; } });
  container.actions.edit.click();
  const titleInput = controlsByLabel(container.visualEditor)[0];
  titleInput.value = "Dirty";
  titleInput.listeners.input();
  assert.equal(store.state.editor.dirty, true);

  const dashboardButtons = container.list.children[0].children;
  dashboardButtons[1].click();
  assert.equal(store.state.activeDashboardId, "dash");
  container.actions.delete.click();
  assert.equal(deleteCalls, 0);
  container.actions.visual.click();
  assert.equal(store.state.mode, "edit");
  assert.equal(asks, 3);
});

function descendants(node) {
  return [node, ...node.children.flatMap(descendants)];
}

function controlsByLabel(panel) {
  return descendants(panel).filter((node) => ["input", "textarea"].includes(node.tagName));
}

test("production default unsaved confirmation rejects and accepts guarded app actions", async () => {
  const other = { ...dashboard, id: "other", title: "Other" };
  let deleteCalls = 0;
  const api = {
    listDashboards: async () => [dashboard, other],
    getDashboard: async (_entryId, id) => id === "other" ? other : dashboard,
    deleteDashboard: async () => { deleteCalls += 1; },
  };
  const originalWindow = globalThis.window;
  const confirmations = [];
  globalThis.window = { confirm: () => confirmations.push("ask") && false };
  const store = new DashboardModernStore(api, { entryIdResolver: async () => "entry" });
  const container = makeBoundContainer();
  await bindDashboardModernApp(container, store, { initialize: true });
  container.actions.edit.click();
  const titleInput = controlsByLabel(container.visualEditor)[0];
  titleInput.value = "Dirty";
  titleInput.listeners.input();

  await container.list.children[0].children[1].click();
  assert.equal(confirmations.length, 1);
  assert.equal(store.state.activeDashboardId, "dash");
  assert.equal(store.state.editor.draftDashboard.title, "Dirty");
  await container.actions.delete.click();
  assert.equal(confirmations.length, 2);
  assert.equal(deleteCalls, 0);
  await container.actions.visual.click();
  assert.equal(confirmations.length, 3);
  assert.equal(store.state.mode, "edit");

  globalThis.window.confirm = () => confirmations.push("ask") && true;
  await container.list.children[0].children[1].click();
  assert.equal(confirmations.length, 4);
  assert.equal(store.state.activeDashboardId, "other");
  assert.equal(store.state.editor.draftDashboard, null);
  globalThis.window = originalWindow;
});

test("structured selected-node forms update draft only and keep unknown card types editable", async () => {
  const editable = {
    ...dashboard,
    views: [{ id: "one", title: "One", description: "View desc", section_ids: ["s1"] }],
    sections: [{ id: "s1", title: "Section", description: "Section desc", card_ids: ["c1"] }],
    cards: [{ id: "c1", title: "Card", type: "unknown-type", config: { ok: true } }],
  };
  const store = new DashboardModernStore({ listDashboards: async () => [editable], getDashboard: async () => editable }, { entryIdResolver: async () => "entry" });
  const container = makeBoundContainer();
  await bindDashboardModernApp(container, store, { initialize: true, confirmUnsaved: async () => true });
  container.actions.edit.click();
  store.setState({ editor: { ...store.state.editor, selectedNode: { dashboardId: "dash", viewId: "one", sectionId: "s1", cardId: "c1" } } });

  const before = JSON.stringify(store.state.activeDashboard);
  const controls = controlsByLabel(container.visualEditor);
  const [dashboardTitle, dashboardDescription, viewTitle, viewDescription, sectionTitle, sectionDescription, cardTitle, cardType, cardConfig] = controls;
  dashboardTitle.value = "Draft dashboard"; dashboardTitle.listeners.input();
  dashboardDescription.value = "Draft dashboard desc"; dashboardDescription.listeners.input();
  viewTitle.value = "Draft view"; viewTitle.listeners.input();
  viewDescription.value = "Draft view desc"; viewDescription.listeners.input();
  sectionTitle.value = "Draft section"; sectionTitle.listeners.input();
  sectionDescription.value = "Draft section desc"; sectionDescription.listeners.input();
  cardTitle.value = "Draft card"; cardTitle.listeners.input();
  cardType.value = "new-unknown-type"; cardType.listeners.input();
  cardConfig.value = '{"changed":true}'; cardConfig.listeners.input();

  const draft = store.state.editor.draftDashboard;
  assert.equal(draft.title, "Draft dashboard");
  assert.equal(draft.description, "Draft dashboard desc");
  assert.equal(draft.views[0].title, "Draft view");
  assert.equal(draft.views[0].description, "Draft view desc");
  assert.equal(draft.sections[0].title, "Draft section");
  assert.equal(draft.sections[0].description, "Draft section desc");
  assert.equal(draft.cards[0].title, "Draft card");
  assert.equal(draft.cards[0].type, "new-unknown-type");
  assert.deepEqual(draft.cards[0].config, { changed: true });
  assert.equal(JSON.stringify(store.state.activeDashboard), before);

  const previousConfig = draft.cards[0].config;
  cardConfig.value = "[]"; cardConfig.listeners.input();
  assert.equal(store.state.editor.draftDashboard.cards[0].config, previousConfig);
  assert.match(store.state.editor.validationErrors[0].message, /JSON object/);
});
