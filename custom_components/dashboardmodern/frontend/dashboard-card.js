/* Full-screen Lovelace wrapper used by the generated DashboardModern dashboard. */
import { legacyVariantForLocale, mountLegacyHost } from "./src/legacy/host.js";

export function canAccess(config = {}, user = {}) {
  const allowed = Array.isArray(config.allowed_user_ids)
    ? config.allowed_user_ids.filter(Boolean)
    : [];
  return allowed.length === 0 || allowed.includes(user?.id);
}

export class DashboardModernCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.host = null;
    this.mountedKey = "";
  }

  setConfig(config) {
    if (!config?.entry_id || !config?.static_base) {
      throw new Error("DashboardModern requires entry_id and static_base.");
    }
    const previous = JSON.stringify(this._config || {});
    this._config = { ...config };
    if (previous !== JSON.stringify(this._config)) this.resetHost();
    this.render();
  }

  set hass(value) {
    this._hass = value;
    this.render();
  }

  resetHost() {
    this.host?.destroy();
    this.host = null;
    this.mountedKey = "";
  }

  renderDenied() {
    this.resetHost();
    const style = document.createElement("style");
    style.textContent = `:host{display:grid;min-height:calc(100dvh - var(--header-height,56px));place-items:center;background:var(--primary-background-color)}section{display:grid;gap:12px;max-width:420px;margin:24px;padding:28px;border-radius:22px;background:var(--card-background-color);box-shadow:var(--ha-card-box-shadow);color:var(--primary-text-color);text-align:center}strong{font-size:1.4rem}span{color:var(--secondary-text-color)}`;
    const section = document.createElement("section");
    section.setAttribute("role", "alert");
    section.innerHTML = `<strong>DashboardModern</strong><span>${
      this._hass?.locale?.language?.startsWith("it")
        ? "Questa plancia non è abilitata per il tuo utente."
        : "This dashboard is not enabled for your user."
    }</span>`;
    this.shadowRoot.replaceChildren(style, section);
  }

  render() {
    if (!this._config || !this._hass?.connection?.sendMessagePromise) return;
    if (!canAccess(this._config, this._hass.user)) {
      this.renderDenied();
      return;
    }
    const variant = legacyVariantForLocale(this._hass?.locale?.language);
    const key = `${this._config.entry_id}|${this._config.static_base}|${variant}`;
    if (this.host && this.mountedKey === key) return;
    this.resetHost();

    const style = document.createElement("style");
    style.textContent = `:host{display:block;width:100%;height:calc(100dvh - var(--header-height,56px));min-height:420px;overflow:hidden;background:var(--primary-background-color)}.surface{width:100%;height:100%;min-width:0;min-height:0}@media(max-width:600px){:host{height:calc(100dvh - var(--header-height,56px));min-height:320px}}`;
    const surface = document.createElement("div");
    surface.className = "surface";
    this.shadowRoot.replaceChildren(style, surface);
    this.host = mountLegacyHost(surface, {
      hass: this._hass,
      connection: this._hass.connection,
      staticBase: this._config.static_base,
      variant,
      instanceId: this._config.entry_id,
      primary: this._config.primary !== false,
    });
    this.mountedKey = key;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: "full", rows: "full" };
  }

  disconnectedCallback() {
    this.resetHost();
  }
}

if (!customElements.get("dashboardmodern-card")) {
  customElements.define("dashboardmodern-card", DashboardModernCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "dashboardmodern-card")) {
  window.customCards.push({
    type: "dashboardmodern-card",
    name: "DashboardModern",
    description: "Full-screen DashboardModern integration view",
    preview: false,
  });
}
