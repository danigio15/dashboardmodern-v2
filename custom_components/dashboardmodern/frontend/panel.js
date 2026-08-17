/* DashboardModern custom panel and companion Lovelace dashboard registration. */
import { legacyVariantForLocale, mountLegacyHost } from "./src/legacy/host.js";

const dashboardJobs = new Map();

export function resolveLegacyVariant(panel, hass) {
  const variants = panel?.config?.legacy_variants;
  if (!Array.isArray(variants) || variants.length === 0) return null;
  const preferred = legacyVariantForLocale(hass?.locale?.language);
  return variants.includes(preferred) ? preferred : variants[0];
}

export function userCanAccess(config = {}, user = {}) {
  const allowed = Array.isArray(config.allowed_user_ids)
    ? config.allowed_user_ids.filter(Boolean)
    : [];
  return allowed.length === 0 || allowed.includes(user?.id);
}

function dashboardView(config) {
  const allowed = Array.isArray(config.allowed_user_ids)
    ? config.allowed_user_ids.filter(Boolean)
    : [];
  const visible = allowed.length ? allowed.map((user) => ({ user })) : true;
  return {
    title: config.title || "DashboardModern",
    path: "home",
    type: "panel",
    panel: true,
    visible,
    cards: [
      {
        type: "custom:dashboardmodern-card",
        entry_id: config.entry_ids?.[0] || config.instance_id,
        title: config.title || "DashboardModern",
        primary: config.primary !== false,
        // The card hosts the same plancia, so it must read and write the same
        // shared configuration profile the panel uses.
        config_profile: config.config_profile || "",
        // Do not persist config.static_base here. It contains the current asset
        // digest and becomes stale after an update/restart. dashboard-card.js
        // derives the live base from its own import.meta.url instead.
        allowed_user_ids: allowed,
      },
    ],
  };
}

async function listDashboards(hass) {
  return hass.connection.sendMessagePromise({ type: "lovelace/dashboards/list" });
}

export async function ensureCompanionDashboard(hass, panel) {
  const config = panel?.config || {};
  if (
    !config.register_lovelace_dashboard ||
    !config.lovelace_url_path ||
    !config.static_base ||
    !hass?.user?.is_admin ||
    !hass.connection?.sendMessagePromise
  ) {
    return null;
  }

  const entryId = config.entry_ids?.[0] || config.instance_id || config.lovelace_url_path;
  const signature = JSON.stringify([
    entryId,
    config.title,
    config.primary,
    config.allowed_user_ids,
    config.admin_only,
  ]);
  const key = `${entryId}:${signature}`;
  if (dashboardJobs.has(key)) return dashboardJobs.get(key);

  const job = (async () => {
    let dashboards = await listDashboards(hass);
    let dashboard = dashboards.find((item) => item.url_path === config.lovelace_url_path);
    if (!dashboard) {
      try {
        dashboard = await hass.connection.sendMessagePromise({
          type: "lovelace/dashboards/create",
          title: config.title || "DashboardModern",
          icon: "mdi:view-dashboard-edit",
          url_path: config.lovelace_url_path,
          show_in_sidebar: false,
          require_admin: Boolean(config.admin_only),
        });
      } catch (error) {
        dashboards = await listDashboards(hass);
        dashboard = dashboards.find((item) => item.url_path === config.lovelace_url_path);
        if (!dashboard) throw error;
      }
    } else if (dashboard.title !== config.title) {
      dashboard = await hass.connection.sendMessagePromise({
        type: "lovelace/dashboards/update",
        dashboard_id: dashboard.id,
        title: config.title || "DashboardModern",
        require_admin: Boolean(config.admin_only),
      });
    }

    await hass.connection.sendMessagePromise({
      type: "lovelace/config/save",
      url_path: config.lovelace_url_path,
      config: { views: [dashboardView(config)] },
    });
    return dashboard;
  })().catch((error) => {
    console.warn("[DashboardModern] companion dashboard registration failed", error);
    return null;
  });
  dashboardJobs.set(key, job);
  return job;
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
    const prevEntry = this._panel?.config?.entry_ids?.[0];
    this._panel = value;
    const nextEntry = value?.config?.entry_ids?.[0];
    if (this.mounted && nextEntry && prevEntry !== nextEntry) this.resetHost();
    this.bootstrap();
  }

  resetHost() {
    this.host?.destroy();
    this.host = null;
    this.mounted = false;
  }

  renderDenied() {
    this.resetHost();
    const denied = document.createElement("section");
    denied.setAttribute("role", "alert");
    denied.innerHTML = `<strong>DashboardModern</strong><span>${
      this._hass?.locale?.language?.startsWith("it")
        ? "Questa plancia non è abilitata per il tuo utente."
        : "This dashboard is not enabled for your user."
    }</span>`;
    const style = document.createElement("style");
    style.textContent = `:host{display:grid;min-height:100%;place-items:center;background:var(--primary-background-color)}section{display:grid;gap:12px;max-width:420px;margin:24px;padding:28px;border-radius:22px;background:var(--card-background-color);box-shadow:var(--ha-card-box-shadow);color:var(--primary-text-color);text-align:center}strong{font-size:1.4rem}span{color:var(--secondary-text-color)}`;
    this.shadowRoot.replaceChildren(style, denied);
  }

  bootstrap() {
    if (!this._hass || !this._panel) return;
    ensureCompanionDashboard(this._hass, this._panel);
    if (!userCanAccess(this._panel.config, this._hass.user)) {
      this.renderDenied();
      return;
    }
    if (this.mounted) return;
    const variant = resolveLegacyVariant(this._panel, this._hass);
    const staticBase = this._panel.config?.static_base;
    if (!variant || !staticBase || !this._hass.connection?.sendMessagePromise) return;

    this.mounted = true;
    this.style.display = "block";
    this.style.height = "100%";
    const surface = document.createElement("div");
    surface.style.cssText = "width:100%;height:100%;min-height:0";
    this.shadowRoot.replaceChildren(surface);
    this.host = mountLegacyHost(surface, {
      hass: this._hass,
      connection: this._hass.connection,
      staticBase,
      variant,
      instanceId:
        (this._panel.config?.entry_ids && this._panel.config.entry_ids[0]) ||
        "integration",
      // Storage profile of the shared configuration. Unlike the instance id it
      // does not contain the entry_id, so removing and re-adding the
      // integration keeps the plancia configured.
      configProfile: this._panel.config?.config_profile || "",
      primary: this._panel.config?.primary !== false,
    });
  }

  disconnectedCallback() {
    this.resetHost();
  }
}

const PANEL_TAG = (() => {
  try {
    const m = /dashboardmodern_static\/([a-z0-9]+)\//.exec(import.meta.url);
    if (m?.[1]) return `dashboardmodern-panel-${m[1].slice(0, 8)}`;
  } catch (_error) {}
  return "dashboardmodern-panel";
})();

if (!customElements.get(PANEL_TAG)) customElements.define(PANEL_TAG, DashboardModernPanel);
