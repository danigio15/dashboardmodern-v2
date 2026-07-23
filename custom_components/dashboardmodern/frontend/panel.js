import { createDashboardModernClient } from "./src/ws-client.js";
import { DashboardModernStore } from "./src/state.js";
import { bindDashboardModernApp, createDashboardModernShell } from "./src/app.js";

function createConnectionAdapter(hass) {
  if (!hass?.connection?.sendMessagePromise) {
    throw new Error("Authenticated Home Assistant frontend connection is unavailable.");
  }
  return hass.connection;
}

function entryIdsFromPanel(panel) {
  const entryIds = panel?.config?.entry_ids;
  return Array.isArray(entryIds) ? entryIds.filter((entryId) => typeof entryId === "string" && entryId) : [];
}

export class DashboardModernPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.store = null;
  }

  set hass(value) {
    this._hass = value;
    if (this.store) {
      const createFormOpen = Boolean(this.shadowRoot?.querySelector(".dashboardmodern-create-form"));
      if (createFormOpen) {
        // Home Assistant replaces `hass` frequently as entity states change. Updating
        // the store without notifying subscribers while this form is open prevents the
        // form DOM (and the focused input) from being destroyed on every state update.
        this.store.state = { ...this.store.state, hass: value };
      } else {
        this.store.setState({ hass: value });
      }
    }
    this.bootstrap();
  }

  set panel(value) {
    this._panel = value;
    this.bootstrap();
  }

  bootstrap() {
    if (!this._hass || !this._panel || this.store) return;
    const entryIds = entryIdsFromPanel(this._panel);
    const selectedEntryId = entryIds.length === 1 ? entryIds[0] : new URLSearchParams(window.location.search).get("entry_id");
    const container = createDashboardModernShell(this.shadowRoot, entryIds);
    try {
      const api = createDashboardModernClient(createConnectionAdapter(this._hass));
      this.store = new DashboardModernStore(api, {
        entryIdResolver: async () => {
          if (!selectedEntryId || !entryIds.includes(selectedEntryId)) {
            throw new Error("Select a DashboardModern config entry to continue.");
          }
          return selectedEntryId;
        },
      });
      bindDashboardModernApp(container, this.store, { hass: this._hass });
    } catch (error) {
      const fallback = new DashboardModernStore({}, { entryIdResolver: async () => null });
      fallback.setError("dashboardmodern_error", error.message);
      bindDashboardModernApp(container, fallback, { initialize: false });
    }
  }
}

if (!customElements.get("dashboardmodern-panel")) {
  customElements.define("dashboardmodern-panel", DashboardModernPanel);
}

export { createConnectionAdapter, entryIdsFromPanel };
