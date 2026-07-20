import { createDashboardModernClient } from "./ws-client.js";
import { DashboardModernStore, EMPTY_DASHBOARD } from "./state.js";

export function resolveHaConnection(root = document) {
  return root.querySelector("home-assistant")?.hass?.connection || window.hassConnection || window.hass?.connection;
}

export async function resolveConfigEntryId(root = document) {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("entry_id") || params.get("config_entry_id");
  if (fromUrl) return fromUrl;
  const fromDataset = root.querySelector("[data-dashboardmodern-entry-id]")?.dataset.dashboardmodernEntryId;
  if (fromDataset) return fromDataset;
  const hass = root.querySelector("home-assistant")?.hass || window.hass;
  const entries = hass?.configEntries?.dashboardmodern;
  if (Array.isArray(entries) && entries.length === 1) return entries[0].entry_id;
  throw new Error("Unable to resolve DashboardModern config entry id.");
}

function renderStatus(container, state) {
  const status = container.querySelector("[data-status]");
  const message = state.error?.message || (state.loading && "Loading…") || (state.saving && "Saving…") || (state.deleting && "Deleting…") || "";
  status.hidden = !message;
  status.textContent = message;
  status.dataset.kind = state.error ? "error" : "info";
}

function renderDashboardList(container, state, store) {
  const list = container.querySelector("[data-dashboard-list]");
  list.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "dashboardmodern-list";
  for (const dashboard of state.dashboards) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = dashboard.title || dashboard.id;
    button.setAttribute("aria-current", String(dashboard.id === state.activeDashboardId));
    button.addEventListener("click", () => store.loadDashboard(dashboard.id));
    wrapper.append(button);
  }
  list.append(wrapper);
}

function renderEditor(container, state) {
  const editor = container.querySelector("[data-dashboard-editor]");
  if (document.activeElement !== editor) {
    editor.value = state.activeDashboard ? JSON.stringify(state.activeDashboard, null, 2) : "";
  }
}

function parseEditorDashboard(container, store) {
  const editor = container.querySelector("[data-dashboard-editor]");
  try {
    return JSON.parse(editor.value || JSON.stringify(EMPTY_DASHBOARD));
  } catch (error) {
    store.setError("invalid_format", `Dashboard JSON could not be parsed: ${error.message}`);
    return null;
  }
}

function dashboardFromEditor(container, store, action) {
  const dashboard = parseEditorDashboard(container, store);
  if (dashboard) action(dashboard);
}

export function bindDashboardModernApp(container, store) {
  store.subscribe((state) => {
    renderStatus(container, state);
    renderDashboardList(container, state, store);
    renderEditor(container, state);
  });
  container
    .querySelector('[data-action="create"]')
    .addEventListener("click", () =>
      dashboardFromEditor(container, store, (dashboard) => store.createDashboard(dashboard)),
    );
  container
    .querySelector('[data-action="save"]')
    .addEventListener("click", () =>
      dashboardFromEditor(container, store, (dashboard) => store.replaceDashboard(dashboard)),
    );
  container.querySelector('[data-action="delete"]').addEventListener("click", () => store.deleteDashboard());
  return store.initialize();
}

export function bootstrapDashboardModern(root = document) {
  const container = root.querySelector("[data-dashboardmodern-app]");
  if (!container) return null;
  const connection = resolveHaConnection(root);
  const api = createDashboardModernClient(connection);
  const store = new DashboardModernStore(api, { entryIdResolver: () => resolveConfigEntryId(root) });
  bindDashboardModernApp(container, store);
  return store;
}

if (typeof document !== "undefined") {
  bootstrapDashboardModern(document);
}
