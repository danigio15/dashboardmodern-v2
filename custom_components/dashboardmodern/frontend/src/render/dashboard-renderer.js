import { validViews } from "../presentation/view-selection.js";
import { renderView } from "./view-renderer.js";
import { DEFAULT_CARD_REGISTRY } from "../cards/registry.js";
import { createCardRuntimeContext } from "../runtime/context.js";
import { el, emptyState } from "./dom.js";

export function renderDashboard(container, state, { hass, runtime, registry = DEFAULT_CARD_REGISTRY } = {}) {
  container.replaceChildren();
  if (state.loading && !state.activeDashboard) {
    container.append(emptyState("Loading DashboardModern configuration…"));
    return;
  }
  if (!state.dashboards?.length && !state.activeDashboard) {
    container.append(emptyState("No dashboards have been created yet."));
    return;
  }
  const dashboard = state.activeDashboard;
  if (!dashboard) {
    container.append(emptyState("Select a dashboard to render."));
    return;
  }
  const runtimeContext = { ...(runtime || createCardRuntimeContext({ hass, connectionStatus: state.connectionStatus || (state.loading ? "loading" : state.error ? "error" : "connected") })), cardRegistry: registry, editMode: state.mode === "edit" && Boolean(state.editor?.editing) };
  const header = el("header", { className: "dashboardmodern-dashboard-header legacy-hero" });
  header.append(el("h2", { text: dashboard.title || "Untitled dashboard" }));
  if (dashboard.description) header.append(el("p", { text: dashboard.description }));
  header.append(el("p", { className: "dashboardmodern-dashboard-meta", text: `${validViews(dashboard).length} views` }));
  container.append(header);
  if (runtimeContext.editMode) container.append(el("p", { className: "dashboardmodern-reorder-instructions", text: "Card reordering is enabled. Use each card move handle to drag, or press Space/Enter and arrow keys to reorder.", attrs: { id: "dashboardmodern-reorder-instructions" } }));

  const views = validViews(dashboard);
  if (!views.length) {
    container.append(emptyState("This dashboard has no views yet."));
    return;
  }
  const nav = el("nav", { className: "dashboardmodern-view-nav legacy-tabs", attrs: { "aria-label": "Dashboard views", role: "tablist" } });
  for (const view of views) {
    const selected = view.id === state.activeViewId;
    const button = el("button", { text: view.title || view.id, attrs: { type: "button", role: "tab", "aria-selected": String(selected), "aria-current": selected ? "page" : "false", tabindex: selected ? "0" : "-1" }, dataset: { viewId: view.id } });
    nav.append(button);
  }
  container.append(nav);
  const activeView = views.find((view) => view.id === state.activeViewId) || views[0];
  container.append(renderView(activeView, dashboard, runtimeContext));
}
