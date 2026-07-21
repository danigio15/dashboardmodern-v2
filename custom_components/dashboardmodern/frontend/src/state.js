import { DashboardModernApiError } from "./ws-client.js";
import { selectActiveViewId } from "./presentation/view-selection.js";
import { createEditorState, clearEditorState } from "./editor/editor-state.js";

export const EMPTY_DASHBOARD = Object.freeze({
  id: "new-dashboard",
  title: "New dashboard",
  views: [],
  sections: [],
  cards: [],
});

export function createInitialState() {
  return {
    entryId: null,
    dashboards: [],
    activeDashboardId: null,
    activeDashboard: null,
    activeViewId: null,
    mode: "visual",
    editor: createEditorState(),
    renderError: null,
    hass: null,
    loading: false,
    saving: false,
    deleting: false,
    error: null,
  };
}

function friendlyError(error) {
  if (error instanceof DashboardModernApiError) {
    return { code: error.code, message: `${error.message} (${error.code})` };
  }
  const code = error?.code || "dashboardmodern_error";
  return { code, message: `${error?.message || "Unexpected error"} (${code})` };
}

export class DashboardModernStore {
  constructor(api, { entryIdResolver, developmentFallback } = {}) {
    this.api = api;
    this.entryIdResolver = entryIdResolver;
    this.developmentFallback = developmentFallback;
    this.state = createInitialState();
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  setError(code, message) {
    this.setState({ error: { code, message: `${message} (${code})` } });
  }

  setRenderError(code, message) {
    this.setState({ renderError: { code, message: `${message} (${code})` } });
  }

  setActiveView(activeViewId) {
    const selected = selectActiveViewId(this.state.activeDashboard, activeViewId);
    this.setState({ activeViewId: selected, renderError: null });
  }

  setMode(mode) {
    this.setState({ mode: ["debug", "edit"].includes(mode) ? mode : "visual", renderError: null });
  }

  async initialize() {
    this.setState({ loading: true, error: null });
    try {
      const entryId = await this.entryIdResolver();
      this.setState({ entryId });
      await this.refreshDashboards();
    } catch (error) {
      if (this.developmentFallback) {
        const fallback = await this.developmentFallback(error);
        this.setState({ ...fallback, loading: false, error: null });
        return;
      }
      this.setState({ loading: false, error: friendlyError(error) });
    }
  }

  async refreshDashboards(preferredDashboardId = this.state.activeDashboardId) {
    const dashboards = await this.api.listDashboards(this.state.entryId);
    const preferredAvailable = dashboards.some((item) => item.id === preferredDashboardId);
    const activeDashboardId = preferredAvailable ? preferredDashboardId : dashboards[0]?.id || null;
    this.setState({ dashboards, loading: false });
    if (activeDashboardId) {
      await this.loadDashboard(activeDashboardId);
      return;
    }
    this.setState({ activeDashboardId: null, activeDashboard: null, activeViewId: null, editor: clearEditorState(this.state.editor) });
  }

  async loadDashboard(dashboardId) {
    this.setState({ loading: true, error: null });
    try {
      const activeDashboard = await this.api.getDashboard(this.state.entryId, dashboardId);
      this.setState({
        activeDashboardId: activeDashboard.id,
        activeDashboard,
        activeViewId: selectActiveViewId(activeDashboard, this.state.activeViewId),
        loading: false,
        renderError: null,
        editor: clearEditorState(this.state.editor),
      });
    } catch (error) {
      this.setState({ loading: false, error: friendlyError(error) });
    }
  }

  async createDashboard(dashboard = EMPTY_DASHBOARD) {
    this.setState({ saving: true, error: null });
    try {
      const createdDashboard = await this.api.createDashboard(this.state.entryId, dashboard);
      this.setState({ saving: false });
      await this.refreshDashboards(createdDashboard.id);
      return this.state.activeDashboardId === createdDashboard.id && Boolean(this.state.activeDashboard);
    } catch (error) {
      this.setState({ saving: false, error: friendlyError(error) });
      return false;
    }
  }

  async replaceDashboard(dashboard) {
    this.setState({ saving: true, error: null });
    try {
      const activeDashboard = await this.api.replaceDashboard(this.state.entryId, dashboard);
      this.setState({ activeDashboardId: activeDashboard.id, activeDashboard, activeViewId: selectActiveViewId(activeDashboard, this.state.activeViewId), saving: false });
      await this.refreshDashboards();
    } catch (error) {
      this.setState({ saving: false, error: friendlyError(error) });
    }
  }

  async deleteDashboard(dashboardId = this.state.activeDashboardId) {
    if (!dashboardId) return;
    this.setState({ deleting: true, error: null });
    try {
      await this.api.deleteDashboard(this.state.entryId, dashboardId);
      this.setState({ activeDashboardId: null, activeDashboard: null, activeViewId: null, deleting: false, editor: clearEditorState(this.state.editor) });
      await this.refreshDashboards();
    } catch (error) {
      this.setState({ deleting: false, error: friendlyError(error) });
    }
  }
}
