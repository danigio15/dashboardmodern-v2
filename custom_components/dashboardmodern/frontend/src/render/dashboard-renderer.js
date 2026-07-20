import { renderView } from "./view-renderer.js";
import { el, emptyState } from "./dom.js";

export function validViews(dashboard) {
  return Array.isArray(dashboard?.views) ? dashboard.views.filter((view) => view?.id) : [];
}

export function selectActiveViewId(dashboard, previousActiveViewId = null) {
  const views = validViews(dashboard);
  if (previousActiveViewId && views.some((view) => view.id === previousActiveViewId)) return previousActiveViewId;
  return views[0]?.id || null;
}

export function renderDashboard(container, state, { hass } = {}) {
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
  const header = el("header", { className: "dashboardmodern-dashboard-header" });
  header.append(el("h2", { text: dashboard.title || "Untitled dashboard" }));
  if (dashboard.description) header.append(el("p", { text: dashboard.description }));
  header.append(el("p", { className: "dashboardmodern-dashboard-meta", text: `${validViews(dashboard).length} views` }));
  container.append(header);

  const views = validViews(dashboard);
  if (!views.length) {
    container.append(emptyState("This dashboard has no views yet."));
    return;
  }
  const nav = el("nav", { className: "dashboardmodern-view-nav", attrs: { "aria-label": "Dashboard views" } });
  for (const view of views) {
    const button = el("button", { text: view.title || view.id, attrs: { type: "button", "aria-current": String(view.id === state.activeViewId) }, dataset: { viewId: view.id } });
    nav.append(button);
  }
  container.append(nav);
  const activeView = views.find((view) => view.id === state.activeViewId) || views[0];
  container.append(renderView(activeView, dashboard, { hass }));
}
