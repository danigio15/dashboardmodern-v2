/*
 * DashboardModern panel.
 *
 * One job: serve the dashboardmodern HTML dashboard, hosted by the integration
 * so there is no file for the user to save and extract. The panel mounts the
 * vendored HTML in a same-origin iframe and gives it an authenticated
 * connection through a WebSocket shim — no token is written anywhere, so the
 * user's own iframe plancia keeps its own token untouched.
 *
 * There is deliberately no native renderer here. New features are added inside
 * the HTML dashboard itself, applied as reproducible patches by
 * scripts/vendor_legacy.py.
 */

import { legacyVariantForLocale, mountLegacyHost } from "./src/legacy/host.js";

/** Choose which vendored HTML variant to serve, from what the backend reports. */
export function resolveLegacyVariant(panel, hass) {
  const variants = panel?.config?.legacy_variants;
  if (!Array.isArray(variants) || variants.length === 0) return null;
  const preferred = legacyVariantForLocale(hass?.locale?.language);
  return variants.includes(preferred) ? preferred : variants[0];
}

export class DashboardModernPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.host = null;
    this.mounted = false;
  }

  set hass(value) {
    this._hass = value;
    this.bootstrap();
  }

  set panel(value) {
    this._panel = value;
    this.bootstrap();
  }

  bootstrap() {
    if (!this._hass || !this._panel || this.mounted) return;
    const variant = resolveLegacyVariant(this._panel, this._hass);
    const staticBase = this._panel.config?.static_base;
    if (!variant || !staticBase || !this._hass.connection?.sendMessagePromise) return;

    this.mounted = true;
    this.style.display = "block";
    this.style.height = "100%";

    const surface = document.createElement("div");
    surface.style.width = "100%";
    surface.style.height = "100%";
    this.shadowRoot.replaceChildren(surface);

    this.host = mountLegacyHost(surface, {
      hass: this._hass,
      connection: this._hass.connection,
      staticBase,
      variant,
      // Each plancia (config entry) gets its own storage namespace, so
      // multiple panels never share cd_* keys; the historical fallback keeps
      // pre-multi installations on their existing namespace.
      instanceId:
        (this._panel.config?.entry_ids && this._panel.config.entry_ids[0]) ||
        "integration",
      // The primary plancia keeps the historical cloud-sync key.
      primary: this._panel.config?.primary !== false,
    });
  }

  disconnectedCallback() {
    this.host?.destroy();
    this.host = null;
    this.mounted = false;
  }
}

if (!customElements.get("dashboardmodern-panel")) {
  customElements.define("dashboardmodern-panel", DashboardModernPanel);
}
