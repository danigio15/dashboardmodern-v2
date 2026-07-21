import assert from "node:assert/strict";
import test from "node:test";
import { bindDashboardModernApp, renderEditor, renderVisualDashboard } from "../src/app.js";
import { DashboardModernStore } from "../src/state.js";
import { renderDashboard } from "../src/render/dashboard-renderer.js";

class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.hidden = false; this.disabled = false; this._text = ""; this.listeners = {}; this.value = ""; this.selectionStart = 0; this.selectionEnd = 0; this.ownerDocument = globalThis.document; }
  append(...items) { this.children.push(...items); }
  set innerHTML(_v) { this.children = []; this._text = ""; }
  replaceChildren(...items) { this.children = items; this._text = ""; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  click() { if (this.disabled) return undefined; return this.listeners.click?.({ target: this, preventDefault() {} }); }
  keydown(key) { return this.listeners.keydown?.({ key, target: this, preventDefault() { this.defaultPrevented = true; } }); }
  focus() { globalThis.document.activeElement = this; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
  set textContent(v) { this._text = String(v); this.children = []; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const out = [];
    const match = (n) => selector === "[data-debug-action]" ? Object.hasOwn(n.dataset, "debugAction") : selector === "[data-create-dashboard-action]" ? Object.hasOwn(n.dataset, "createDashboardAction") : selector === '[data-create-field="id"]' ? n.dataset.createField === "id" : selector.startsWith("[data-view-id]") ? Object.hasOwn(n.dataset, "viewId") : n.tagName === selector;
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

function fieldById(panel, fieldId) {
  return descendants(panel).find((node) => node.dataset?.editorField === fieldId);
}

function buttonByText(panel, text) {
  return descendants(panel).find((node) => node.tagName === "button" && node.textContent === text);
}

function typeCharacters(container, fieldId, text) {
  let field = fieldById(container.visualEditor, fieldId);
  field.focus();
  for (const char of text) {
    const start = field.selectionStart ?? field.value.length;
    field.value = `${field.value.slice(0, start)}${char}${field.value.slice(field.selectionEnd ?? start)}`;
    field.setSelectionRange(start + 1, start + 1);
    field.listeners.input();
    field = globalThis.document.activeElement;
    assert.equal(field.dataset.editorField, fieldId);
    assert.equal(field.selectionStart, start + 1);
    assert.equal(field.selectionEnd, start + 1);
  }
  return field;
}

function createFields(container) {
  return Object.fromEntries(descendants(container.list).filter((node) => node.dataset?.createField).map((node) => [node.dataset.createField, node]));
}

function submitCreate(container) {
  const form = descendants(container.list).find((node) => node.tagName === "form");
  return form.listeners.submit({ preventDefault() {} });
}

test("empty dashboard state exposes accessible first-dashboard creation flow", async () => {
  const calls = [];
  const created = { id: "first", title: "First", views: [{ id: "first-view", title: "Main", section_ids: ["first-section"] }], sections: [{ id: "first-section", title: "Main", card_ids: ["first-card"] }], cards: [{ id: "first-card", title: "Welcome", type: "dashboardmodern-placeholder", config: {} }] };
  const api = {
    listDashboards: async () => calls.filter((call) => call[0] === "create").length ? [created] : [],
    getDashboard: async (_entry, id) => { calls.push(["get", id]); return created; },
    createDashboard: async (_entry, dash) => { calls.push(["create", dash]); return created; },
  };
  const store = new DashboardModernStore(api, { entryIdResolver: async () => "entry" });
  const container = makeBoundContainer();
  await bindDashboardModernApp(container, store, { initialize: true, confirmUnsaved: async () => true });
  assert.match(container.list.textContent, /No dashboards available/);
  assert.match(container.list.textContent, /Create dashboard/);

  buttonByText(container.list, "Create dashboard").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(globalThis.document.activeElement.dataset.createField, "id");
  submitCreate(container);
  assert.match(container.list.textContent, /Dashboard ID is required/);
  assert.match(container.list.textContent, /Dashboard title is required/);

  let fields = createFields(container);
  fields.id.value = " first "; fields.id.listeners.input();
  fields.title.value = " First "; fields.title.listeners.input();
  const firstSubmit = submitCreate(container);
  const secondSubmit = submitCreate(container);
  await Promise.all([firstSubmit, secondSubmit]);
  assert.deepEqual(calls.filter((call) => call[0] === "create"), [["create", { id: "first", title: "First", views: [{ id: "first-view", title: "Main", section_ids: ["first-section"] }], sections: [{ id: "first-section", title: "Main", card_ids: ["first-card"] }], cards: [{ id: "first-card", title: "Welcome", type: "dashboardmodern-placeholder", config: {} }] }]]);
  assert.deepEqual(calls.filter((call) => call[0] === "get"), [["get", "first"]]);
  assert.equal(store.state.activeDashboardId, "first");
  assert.equal(store.state.activeDashboard, created);
  assert.equal(store.state.mode, "edit");
});

test("non-empty dashboard state omits empty-state creation prompt", async () => {
  const store = new DashboardModernStore({ listDashboards: async () => [dashboard], getDashboard: async () => dashboard }, { entryIdResolver: async () => "entry" });
  const container = makeBoundContainer();
  await bindDashboardModernApp(container, store, { initialize: true });
  assert.equal(Boolean(buttonByText(container.list, "Create dashboard")), false);
});

test("create dashboard cancellation and Escape restore focus without state changes", async () => {
  const store = new DashboardModernStore({ listDashboards: async () => [], getDashboard: async () => null }, { entryIdResolver: async () => "entry" });
  const container = makeBoundContainer();
  await bindDashboardModernApp(container, store, { initialize: true });
  const trigger = buttonByText(container.list, "Create dashboard");
  trigger.click(); await new Promise((resolve) => setTimeout(resolve, 0));
  createFields(container).id.value = "draft";
  buttonByText(container.list, "Cancel").click();
  assert.equal(globalThis.document.activeElement, trigger);
  assert.equal(store.state.activeDashboardId, null);
  trigger.click(); await new Promise((resolve) => setTimeout(resolve, 0));
  descendants(container.list).find((node) => node.tagName === "form").keydown("Escape");
  assert.equal(globalThis.document.activeElement, trigger);
});

test("create dashboard backend failures preserve form and avoid partial local state", async () => {
  let attempts = 0;
  const api = { listDashboards: async () => [], getDashboard: async () => { throw new Error("should not load"); }, createDashboard: async () => { attempts += 1; const error = new Error("duplicate"); error.code = attempts === 1 ? "dashboard_already_exists" : "dashboard_persistence_error"; throw error; } };
  const store = new DashboardModernStore(api, { entryIdResolver: async () => "entry" });
  const container = makeBoundContainer();
  await bindDashboardModernApp(container, store, { initialize: true });
  buttonByText(container.list, "Create dashboard").click();
  let fields = createFields(container); fields.id.value = "first"; fields.id.listeners.input(); fields.title.value = "First"; fields.title.listeners.input();
  await submitCreate(container);
  assert.match(container.list.textContent, /dashboard_already_exists/);
  fields = createFields(container);
  assert.equal(fields.id.value, "first");
  assert.equal(fields.title.value, "First");
  assert.equal(store.state.activeDashboardId, null);
  assert.equal(store.state.activeDashboard, null);
  await submitCreate(container);
  assert.match(container.list.textContent, /dashboard_persistence_error/);
  assert.equal(store.state.mode, "visual");
});

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

test("accepted production confirmation performs active dashboard deletion", async () => {
  let deleteCalls = 0;
  const api = {
    listDashboards: async () => [dashboard],
    getDashboard: async () => dashboard,
    deleteDashboard: async () => { deleteCalls += 1; },
  };
  const originalWindow = globalThis.window;
  let confirmations = 0;
  globalThis.window = { confirm: () => { confirmations += 1; return true; } };
  const store = new DashboardModernStore(api, { entryIdResolver: async () => "entry" });
  const container = makeBoundContainer();
  await bindDashboardModernApp(container, store, { initialize: true });
  container.actions.edit.click();
  const titleInput = controlsByLabel(container.visualEditor)[0];
  titleInput.value = "Dirty";
  titleInput.listeners.input();

  await container.actions.delete.click();
  assert.equal(confirmations, 1);
  assert.equal(deleteCalls, 1);
  assert.equal(store.state.editor.draftDashboard, null);
  globalThis.window = originalWindow;
});

test("sequential typing preserves focus caret and draft-only updates across selected-node forms", async () => {
  const editable = {
    ...dashboard,
    title: "",
    views: [{ id: "one", title: "", description: "", section_ids: ["s1"] }],
    sections: [{ id: "s1", title: "", description: "", card_ids: ["c1"] }],
    cards: [{ id: "c1", title: "", type: "", config: {} }],
  };
  const store = new DashboardModernStore({ listDashboards: async () => [editable], getDashboard: async () => editable }, { entryIdResolver: async () => "entry" });
  const container = makeBoundContainer();
  await bindDashboardModernApp(container, store, { initialize: true, confirmUnsaved: async () => true });
  container.actions.edit.click();
  store.setState({ editor: { ...store.state.editor, selectedNode: { dashboardId: "dash", viewId: "one", sectionId: "s1", cardId: "c1" } } });
  const persistedBefore = JSON.stringify(store.state.activeDashboard);

  typeCharacters(container, "dashboard.title", "Dash");
  typeCharacters(container, "view:one:title", "View");
  typeCharacters(container, "section:s1:title", "Section");
  typeCharacters(container, "card:c1:title", "Card");
  typeCharacters(container, "card:c1:type", "unknown");

  assert.equal(store.state.editor.draftDashboard.title, "Dash");
  assert.equal(store.state.editor.draftDashboard.views[0].title, "View");
  assert.equal(store.state.editor.draftDashboard.sections[0].title, "Section");
  assert.equal(store.state.editor.draftDashboard.cards[0].title, "Card");
  assert.equal(store.state.editor.draftDashboard.cards[0].type, "unknown");
  assert.equal(JSON.stringify(store.state.activeDashboard), persistedBefore);
});

test("invalid Card config text survives rerenders and corrected config updates draft", async () => {
  const editable = {
    ...dashboard,
    views: [{ id: "one", title: "One", section_ids: ["s1"] }],
    sections: [{ id: "s1", title: "Section", card_ids: ["c1"] }],
    cards: [{ id: "c1", title: "Card", type: "unknown", config: { ok: true } }],
  };
  const store = new DashboardModernStore({ listDashboards: async () => [editable], getDashboard: async () => editable }, { entryIdResolver: async () => "entry" });
  const container = makeBoundContainer();
  await bindDashboardModernApp(container, store, { initialize: true, confirmUnsaved: async () => true });
  container.actions.edit.click();
  store.setState({ editor: { ...store.state.editor, selectedNode: { dashboardId: "dash", viewId: "one", sectionId: "s1", cardId: "c1" } } });
  const persistedBefore = JSON.stringify(store.state.activeDashboard);
  const previousConfig = store.state.editor.draftDashboard.cards[0].config;

  let configField = fieldById(container.visualEditor, "card:c1:config");
  configField.focus();
  configField.value = "{";
  configField.setSelectionRange(1, 1);
  configField.listeners.input();
  configField = globalThis.document.activeElement;
  assert.equal(configField.dataset.editorField, "card:c1:config");
  assert.equal(configField.value, "{");
  assert.equal(configField.selectionStart, 1);
  assert.equal(store.state.editor.draftDashboard.cards[0].config, previousConfig);

  configField.value = '{"fixed":true}';
  configField.setSelectionRange(configField.value.length, configField.value.length);
  configField.listeners.input();
  configField = globalThis.document.activeElement;
  assert.equal(configField.value, '{\n  "fixed": true\n}');
  assert.deepEqual(store.state.editor.draftDashboard.cards[0].config, { fixed: true });
  assert.equal(JSON.stringify(store.state.activeDashboard), persistedBefore);
});

test("invalid Card config field state survives unrelated form edits until corrected", async () => {
  const editable = {
    ...dashboard,
    title: "Base",
    views: [{ id: "one", title: "View", description: "", section_ids: ["s1"] }],
    sections: [{ id: "s1", title: "Section", description: "", card_ids: ["c1"] }],
    cards: [{ id: "c1", title: "Card", type: "unknown", config: { stable: true } }],
  };
  const store = new DashboardModernStore({ listDashboards: async () => [editable], getDashboard: async () => editable }, { entryIdResolver: async () => "entry" });
  const container = makeBoundContainer();
  await bindDashboardModernApp(container, store, { initialize: true, confirmUnsaved: async () => true });
  container.actions.edit.click();
  store.setState({ editor: { ...store.state.editor, selectedNode: { dashboardId: "dash", viewId: "one", sectionId: "s1", cardId: "c1" } } });
  const persistedBefore = JSON.stringify(store.state.activeDashboard);
  const previousConfig = store.state.editor.draftDashboard.cards[0].config;

  let configField = fieldById(container.visualEditor, "card:c1:config");
  configField.focus();
  configField.value = "[invalid";
  configField.setSelectionRange(configField.value.length, configField.value.length);
  configField.listeners.input();

  for (const [fieldId, text] of [["dashboard.title", "D"], ["view:one:title", "V"], ["section:s1:title", "S"], ["card:c1:title", "C"], ["card:c1:type", "T"]]) {
    typeCharacters(container, fieldId, text);
    configField = fieldById(container.visualEditor, "card:c1:config");
    assert.equal(configField.value, "[invalid", fieldId);
    assert.match(store.state.editor.validationErrors.find((error) => error.field === "card:c1:config")?.message || "", /JSON|object/i, fieldId);
    assert.deepEqual(store.state.editor.draftDashboard.cards[0].config, previousConfig, fieldId);
  }

  configField = fieldById(container.visualEditor, "card:c1:config");
  configField.value = '{"stable":false}';
  configField.setSelectionRange(configField.value.length, configField.value.length);
  configField.listeners.input();
  assert.deepEqual(store.state.editor.draftDashboard.cards[0].config, { stable: false });
  assert.equal(store.state.editor.fieldText["card:c1:config"], undefined);
  assert.equal(store.state.editor.validationErrors.some((error) => error.field === "card:c1:config"), false);
  assert.equal(JSON.stringify(store.state.activeDashboard), persistedBefore);
});

test("Save is blocked while invalid Card config text is visible and succeeds after correction", async () => {
  let replaceCalls = 0;
  const editable = {
    ...dashboard,
    views: [{ id: "one", title: "One", section_ids: ["s1"] }],
    sections: [{ id: "s1", title: "Section", card_ids: ["c1"] }],
    cards: [{ id: "c1", title: "Card", type: "unknown", config: { old: true } }],
  };
  const api = {
    listDashboards: async () => [editable],
    getDashboard: async () => editable,
    replaceDashboard: async (_entryId, draft) => { replaceCalls += 1; return draft; },
  };
  const store = new DashboardModernStore(api, { entryIdResolver: async () => "entry" });
  const container = makeBoundContainer();
  await bindDashboardModernApp(container, store, { initialize: true, confirmUnsaved: async () => true });
  container.actions.edit.click();
  store.setState({ editor: { ...store.state.editor, selectedNode: { dashboardId: "dash", viewId: "one", sectionId: "s1", cardId: "c1" } } });
  const previousConfig = store.state.editor.draftDashboard.cards[0].config;

  let configField = fieldById(container.visualEditor, "card:c1:config");
  configField.value = "[";
  configField.setSelectionRange(1, 1);
  configField.listeners.input();

  let save = buttonByText(container.visualEditor, "Save");
  assert.equal(save.disabled, true);
  await save.click();
  assert.equal(replaceCalls, 0);
  assert.equal(store.state.mode, "edit");
  assert.equal(store.state.editor.dirty, true);
  assert.equal(fieldById(container.visualEditor, "card:c1:config").value, "[");
  assert.equal(store.state.editor.draftDashboard.cards[0].config, previousConfig);
  assert.equal(store.state.editor.validationErrors.some((error) => error.field === "card:c1:config"), true);

  configField = fieldById(container.visualEditor, "card:c1:config");
  configField.value = '{"new":true}';
  configField.setSelectionRange(configField.value.length, configField.value.length);
  configField.listeners.input();
  save = buttonByText(container.visualEditor, "Save");
  assert.equal(save.disabled, false);
  await save.click();
  assert.equal(replaceCalls, 1);
  assert.equal(store.state.mode, "visual");
  assert.equal(store.state.editor.draftDashboard, null);
  assert.deepEqual(store.state.editor.fieldText, {});
  assert.deepEqual(store.state.editor.validationErrors, []);
});
