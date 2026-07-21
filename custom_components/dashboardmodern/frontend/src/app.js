import { createDashboardModernClient } from "./ws-client.js";
import { DashboardModernStore, EMPTY_DASHBOARD } from "./state.js";
import { renderDashboard } from "./render/dashboard-renderer.js";
import { EditorController } from "./editor/editor-controller.js";

export function createDashboardModernShell(root, entryIds = []) {
  root.innerHTML = `
    <link rel="stylesheet" href="/dashboardmodern_static/styles.css" />
    <main class="dashboardmodern-shell" data-dashboardmodern-app>
      <header class="dashboardmodern-header">
        <div>
          <h1>DashboardModern</h1>
          <p>Visual renderer for custom DashboardModern dashboards.</p>
        </div>
        <div class="dashboardmodern-actions">
          <button type="button" data-action="mode-visual">Dashboard</button>
          <button type="button" data-action="mode-edit">Edit</button>
          <button type="button" data-action="mode-debug">Debug JSON</button>
          <button type="button" data-action="create" data-debug-action>Create</button>
          <button type="button" data-action="save" data-debug-action>Save</button>
          <button type="button" data-action="delete">Delete</button>
        </div>
      </header>
      <section class="dashboardmodern-entry" data-entry-selector></section>
      <section class="dashboardmodern-status" data-status hidden></section>
      <section class="dashboardmodern-status" data-render-status hidden></section>
      <section class="dashboardmodern-layout">
        <aside class="dashboardmodern-sidebar">
          <h2>Dashboards</h2>
          <div data-dashboard-list></div>
        </aside>
        <section class="dashboardmodern-visual" aria-label="Dashboard renderer" data-dashboard-visual></section>
        <section class="dashboardmodern-editor" aria-label="Visual dashboard editor" data-visual-editor hidden></section>
        <section class="dashboardmodern-editor" aria-label="Debug dashboard JSON configuration" data-debug-panel hidden>
          <label for="dashboardmodern-json">Configuration/debug JSON</label>
          <p>Development view for raw DashboardModern configuration. The visual dashboard remains the primary experience.</p>
          <textarea id="dashboardmodern-json" data-dashboard-editor spellcheck="false"></textarea>
        </section>
      </section>
    </main>`;
  renderEntrySelector(root, entryIds);
  return root.querySelector("[data-dashboardmodern-app]");
}

function renderEntrySelector(root, entryIds) {
  const container = root.querySelector("[data-entry-selector]");
  if (!container || entryIds.length < 2) return;
  const params = new URLSearchParams(window.location.search);
  const selected = params.get("entry_id") || "";
  const label = document.createElement("label");
  label.textContent = "Config entry ";
  const select = document.createElement("select");
  for (const entryId of entryIds) {
    const option = document.createElement("option");
    option.value = entryId;
    option.textContent = entryId;
    option.selected = entryId === selected;
    select.append(option);
  }
  select.addEventListener("change", () => {
    const url = new URL(window.location.href);
    url.searchParams.set("entry_id", select.value);
    window.location.assign(url.toString());
  });
  label.append(select);
  container.append(label);
}

function renderStatus(container, state) {
  const status = container.querySelector("[data-status]");
  const message = state.error?.message || (state.loading && "Loading…") || (state.saving && "Saving…") || (state.deleting && "Deleting…") || "";
  status.hidden = !message;
  status.textContent = message;
  status.dataset.kind = state.error ? "error" : "info";
  const renderStatus = container.querySelector("[data-render-status]");
  renderStatus.hidden = !state.renderError;
  renderStatus.textContent = state.renderError?.message || "";
  renderStatus.dataset.kind = "error";
}

function renderDashboardList(container, state, controller) {
  const list = container.querySelector("[data-dashboard-list]");
  list.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "dashboardmodern-list";
  for (const dashboard of state.dashboards) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = dashboard.title || dashboard.id;
    button.setAttribute("aria-current", String(dashboard.id === state.activeDashboardId));
    button.addEventListener("click", () => controller.loadDashboard(dashboard.id));
    wrapper.append(button);
  }
  if (!state.dashboards.length) wrapper.textContent = "No dashboards available.";
  list.append(wrapper);
}

export function renderEditor(container, state) {
  const panel = container.querySelector("[data-debug-panel]");
  const visual = container.querySelector("[data-dashboard-visual]");
  const visualEditor = container.querySelector("[data-visual-editor]");
  panel.hidden = state.mode !== "debug";
  if (visualEditor) visualEditor.hidden = state.mode !== "edit";
  visual.hidden = state.mode === "debug";
  for (const action of container.querySelectorAll?.("[data-debug-action]") || []) {
    action.hidden = state.mode !== "debug";
    action.disabled = state.mode !== "debug" || Boolean(state.editor?.saving);
  }
  const editor = container.querySelector("[data-dashboard-editor]");
  if (document.activeElement !== editor) {
    editor.value = state.editor?.editing ? state.editor.debugText : state.activeDashboard ? JSON.stringify(state.activeDashboard, null, 2) : "";
  }
}

function parseEditorDashboard(container, store) {
  const editor = container.querySelector("[data-dashboard-editor]");
  try {
    return JSON.parse(editor.value || JSON.stringify(EMPTY_DASHBOARD));
  } catch (error) {
    store.setRenderError("invalid_format", `Dashboard JSON could not be parsed: ${error.message}`);
    return null;
  }
}

function dashboardFromEditor(container, store, action) {
  const dashboard = parseEditorDashboard(container, store);
  if (dashboard) action(dashboard).then(() => store.setMode("visual"));
}

export function renderVisualDashboard(container, state, store, { hass = null, renderer = renderDashboard } = {}) {
  try {
    const renderState = state.editor?.editing ? { ...state, activeDashboard: state.editor.draftDashboard, activeViewId: state.editor.selectedNode.viewId || state.activeViewId } : state;
    renderer(container.querySelector("[data-dashboard-visual]"), renderState, { hass: state.hass || hass });
    if (state.renderError) store.setState({ renderError: null });
  } catch (error) {
    const renderError = { code: "render_error", message: `${error.message} (render_error)` };
    if (state.renderError?.code !== renderError.code || state.renderError?.message !== renderError.message) {
      store.setState({ renderError });
    }
  }
}

export function bindDashboardModernApp(container, store, { initialize = true, hass = null, confirmUnsaved = async () => true } = {}) {
  const editorController = new EditorController(store, { confirmUnsaved });
  store.subscribe((state) => {
    renderStatus(container, state);
    renderDashboardList(container, state, editorController);
    renderEditor(container, state);
    renderVisualEditor(container, state, editorController);
    renderVisualDashboard(container, state, store, { hass });
  });
  container.querySelector('[data-action="mode-visual"]').addEventListener("click", () => editorController.setMode("visual"));
  container.querySelector('[data-action="mode-edit"]').addEventListener("click", () => editorController.setMode("edit"));
  container.querySelector('[data-action="mode-debug"]').addEventListener("click", () => editorController.setMode("debug"));
  container.querySelector('[data-action="create"]').addEventListener("click", () => dashboardFromEditor(container, store, (dashboard) => store.createDashboard(dashboard)));
  container.querySelector('[data-action="save"]').addEventListener("click", () => store.state.editor?.editing ? editorController.save() : dashboardFromEditor(container, store, (dashboard) => store.replaceDashboard(dashboard)));
  container.querySelector("[data-dashboard-editor]").addEventListener("input", (event) => { if (store.state.editor?.editing) editorController.updateDebugJson(event.target.value); });
  container.querySelector('[data-action="delete"]').addEventListener("click", () => editorController.deleteDashboard());
  container.querySelector("[data-dashboard-visual]").addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-view-id]");
    if (button?.dataset?.viewId) store.setActiveView(button.dataset.viewId);
  });
  if (initialize) return store.initialize();
  return Promise.resolve();
}

export function bootstrapDashboardModern(root, { connection, entryId, entryIds = [], hass = null } = {}) {
  const container = createDashboardModernShell(root, entryIds);
  const store = new DashboardModernStore(createDashboardModernClient(connection), {
    entryIdResolver: async () => {
      if (!entryId) throw new Error("Missing DashboardModern config entry id.");
      return entryId;
    },
  });
  bindDashboardModernApp(container, store, { hass });
  return store;
}

export function renderVisualEditor(container, state, editorController) {
  const panel = container.querySelector("[data-visual-editor]");
  if (!panel) return;
  panel.replaceChildren();
  if (state.mode !== "edit" || !state.editor?.editing) return;
  const draft = state.editor.draftDashboard;
  const doc = panel.ownerDocument || document;
  const heading = doc.createElement("h2"); heading.textContent = "Visual editor"; panel.append(heading);
  for (const error of state.editor.validationErrors || []) { const p = doc.createElement("p"); p.dataset.kind="error"; p.textContent = error.message; panel.append(p); }
  const title = doc.createElement("input"); title.value = draft.title || ""; title.setAttribute("aria-label", "Dashboard title"); title.addEventListener("input", () => editorController.updateDashboard({ title: title.value })); panel.append(title);
  const desc = doc.createElement("input"); desc.value = draft.description || ""; desc.setAttribute("aria-label", "Dashboard description"); desc.addEventListener("input", () => editorController.updateDashboard({ description: desc.value })); panel.append(desc);
  const addView = doc.createElement("button"); addView.type="button"; addView.textContent="Add view"; addView.addEventListener("click", () => editorController.addView()); panel.append(addView);
  const save = doc.createElement("button"); save.type="button"; save.textContent="Save"; save.disabled = Boolean(state.editor.saving); save.addEventListener("click", () => editorController.save()); panel.append(save);
  const cancel = doc.createElement("button"); cancel.type="button"; cancel.textContent="Cancel"; cancel.addEventListener("click", () => editorController.cancel()); panel.append(cancel);
  const list = doc.createElement("div"); list.className="dashboardmodern-editor-tree"; panel.append(list);
  for (const view of draft.views || []) {
    const vb = doc.createElement("button"); vb.type="button"; vb.textContent = `View: ${view.title || view.id}`; vb.addEventListener("click", () => editorController.select({viewId:view.id,sectionId:null,cardId:null})); list.append(vb);
    const row = doc.createElement("div");
    for (const [label, fn] of [["Up",()=>editorController.moveView(view.id,-1)],["Down",()=>editorController.moveView(view.id,1)],["Delete",()=>editorController.removeView(view.id)],["Add section",()=>editorController.addSection(view.id)]]) { const b=doc.createElement("button"); b.type="button"; b.textContent=label; b.addEventListener("click",fn); row.append(b); }
    list.append(row);
    const sections = (view.section_ids||[]).map(id => (draft.sections||[]).find(s=>s.id===id)).filter(Boolean);
    if (!sections.length) { const e=doc.createElement("p"); e.textContent="No sections in this view."; list.append(e); }
    for (const section of sections) {
      const sb=doc.createElement("button"); sb.type="button"; sb.textContent=`Section: ${section.title||section.id}`; sb.addEventListener("click",()=>editorController.select({viewId:view.id,sectionId:section.id,cardId:null})); list.append(sb);
      const sr=doc.createElement("div"); for (const [label,fn] of [["Up",()=>editorController.moveSection(view.id,section.id,-1)],["Down",()=>editorController.moveSection(view.id,section.id,1)],["Delete",()=>editorController.removeSection(section.id)],["Add card",()=>editorController.addCard(section.id)]]) { const b=doc.createElement("button"); b.type="button"; b.textContent=label; b.addEventListener("click",fn); sr.append(b); } list.append(sr);
      for (const card of (section.card_ids||[]).map(id=>(draft.cards||[]).find(c=>c.id===id)).filter(Boolean)) { const cb=doc.createElement("button"); cb.type="button"; cb.textContent=`Card: ${card.title||card.id} (${card.type||"unknown"})`; cb.addEventListener("click",()=>editorController.select({viewId:view.id,sectionId:section.id,cardId:card.id})); list.append(cb); }
    }
  }
}
