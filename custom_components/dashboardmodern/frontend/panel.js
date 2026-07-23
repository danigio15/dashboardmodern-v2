const LEGACY_DASHBOARD_PATH = "./legacy/dashboard.html";

export function legacyDashboardUrl(moduleUrl = import.meta.url) {
  const url = new URL(LEGACY_DASHBOARD_PATH, moduleUrl);
  url.searchParams.set("embedded", "1");
  return url.toString();
}

export function entryIdsFromPanel(panel) {
  const entryIds = panel?.config?.entry_ids;
  return Array.isArray(entryIds)
    ? entryIds.filter((entryId) => typeof entryId === "string" && entryId)
    : [];
}

export function createLegacyFrame(documentRef, src) {
  const iframe = documentRef.createElement("iframe");
  iframe.className = "dashboardmodern-legacy-frame";
  iframe.title = "Dashboard Modern";
  iframe.src = src;
  iframe.loading = "eager";
  iframe.referrerPolicy = "same-origin";
  iframe.allow = "autoplay; camera; microphone; fullscreen";
  iframe.setAttribute("allowfullscreen", "");
  return iframe;
}

export class DashboardModernPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._frame = null;
    this._loaded = false;
  }

  set hass(value) {
    this._hass = value;
    this.bootstrap();
    this.syncHostBridge();
  }

  set panel(value) {
    this._panel = value;
    this.bootstrap();
    this.syncHostBridge();
  }

  bootstrap() {
    if (!this._hass || !this._panel || this._frame) return;

    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 100vh;
        overflow: hidden;
        background: #f0f4f8;
      }
      .dashboardmodern-loading {
        position: absolute;
        inset: 0;
        z-index: 1;
        display: grid;
        place-items: center;
        font: 700 14px/1.4 system-ui, sans-serif;
        color: #475569;
        background: #f0f4f8;
      }
      .dashboardmodern-legacy-frame {
        position: absolute;
        inset: 0;
        display: block;
        width: 100%;
        height: 100%;
        min-height: 100vh;
        border: 0;
        background: #f0f4f8;
      }
    `;

    const loading = document.createElement("div");
    loading.className = "dashboardmodern-loading";
    loading.textContent = "Caricamento Dashboard Modern…";

    const frame = createLegacyFrame(document, legacyDashboardUrl());
    frame.addEventListener("load", () => {
      this._loaded = true;
      loading.remove();
      this.syncHostBridge();
    });
    frame.addEventListener("error", () => {
      loading.textContent = "Impossibile caricare la dashboard originale.";
    });

    this.shadowRoot.replaceChildren(style, loading, frame);
    this._frame = frame;
  }

  syncHostBridge() {
    const frameWindow = this._frame?.contentWindow;
    if (!frameWindow || !this._hass) return;

    // The original dashboard is served from the same Home Assistant origin.  Keep a
    // non-serialised bridge available for its gradual migration away from the legacy
    // token/WebSocket code, without cloning credentials through postMessage.
    try {
      frameWindow.__DASHBOARDMODERN_HOST__ = {
        hass: this._hass,
        panel: this._panel,
        entryIds: entryIdsFromPanel(this._panel),
        integrationVersion: "0.2.0",
      };
      frameWindow.dispatchEvent(new frameWindow.CustomEvent("dashboardmodern-host-ready"));
    } catch (error) {
      // The legacy page still works through its existing same-origin Home Assistant
      // connection and localStorage configuration when a browser blocks bridge access.
      console.debug("[DashboardModern] host bridge unavailable", error);
    }
  }
}

if (!customElements.get("dashboardmodern-panel")) {
  customElements.define("dashboardmodern-panel", DashboardModernPanel);
}
