/* DashboardModern 0.15.0 — bounded compatibility facade and retained contracts. */
(function installRuntimeCompatibility0150(root) {
  "use strict";

  const VERSION = "0.15.0";
  const doc = root.document;
  const states = new Map();
  const currentMonth = Object.create(null);
  const PERIOD_KEYS = {
    "dm.energy_consumo_casa_mese": "house",
    "dm.energy_produzione_solare_mese": "solar",
    "dm.energy_rete_acquistata_mese": "gridImport",
    "dm.energy_rete_venduta_mese": "gridExport",
    "dm.energy_batteria_caricata_mese": "batteryCharged",
    "dm.energy_batteria_usata_mese": "batteryDischarged",
  };
  const KEYS = [
    "__DASHBOARDMODERN_RELEASE_0152__",
    "__DASHBOARDMODERN_RELEASE_0153_REPORT_RUNTIME__",
    "__DASHBOARDMODERN_RELEASE_0154__",
    "__DASHBOARDMODERN_RELEASE_0154_REAL_CONFIG__",
    "__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__",
    "__DASHBOARDMODERN_RELEASE_0156_PERIOD_RUNTIME__",
    "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__",
    "__DASHBOARDMODERN_RELEASE_0157_UI_STABILITY__",
    "__DASHBOARDMODERN_RELEASE_0157_FINAL__",
  ];

  const clean = (value) => String(value ?? "").trim();
  const english = () =>
    clean(doc?.documentElement?.lang).toLowerCase().startsWith("en") ||
    /dashboard-en\.html/i.test(root.location?.pathname || "");
  const api = () => root.DashboardModernRuntime0150 || null;
  const store = () => root.DashboardModernModules?.store || null;
  const lexical = (name, fallback) => {
    try {
      return root.eval?.(name) || fallback;
    } catch (_error) {
      return fallback;
    }
  };
  const periodRegistry = () => lexical("CD_PERIOD", root.CD_PERIOD || (root.CD_PERIOD = {}));

  function publishLegacyFlags() {
    [
      "__DASHBOARDMODERN_0147_FIXES__",
      "__DASHBOARDMODERN_0147_APPLIANCE_THEME__",
      "__DASHBOARDMODERN_0147_EDITOR_THEME__",
      "__DASHBOARDMODERN_0147_REPORT_POLISH__",
      "__DASHBOARDMODERN_REAL_HA_0147__",
      "__DASHBOARDMODERN_RELEASE_0150__",
      "__DASHBOARDMODERN_RELEASE_0151__",
    ].forEach((key) => {
      root[key] = { ...(root[key] || {}), installed: true, patched: true, version: VERSION };
    });
    root.__DASHBOARDMODERN_MEDIA_STYLE_LOCK_DISABLED_0153__ = true;
    root.__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__ = {
      ...(root.__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__ || {}),
      installed: true,
      version: VERSION,
      observer: { disabled: true },
    };
    root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__ = {
      ...(root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__ || {}),
      installed: true,
      version: VERSION,
      observer: null,
      observerVersion: 3,
    };
  }

  function ingestState(state) {
    const id = clean(state?.entity_id);
    if (!id) return false;
    const copy = { ...state, attributes: { ...(state.attributes || {}) } };
    states.set(id, copy);
    api()?.broker?.ingestState?.(copy);
    return true;
  }

  function ingestStates(list) {
    (Array.isArray(list) ? list : []).forEach(ingestState);
    return states.size;
  }

  function syncTemperature() {
    try {
      root.buildTempCards?.();
      root.renderTemperature?.();
      return true;
    } catch (_error) {
      return false;
    }
  }

  function syncAppliances() {
    try {
      root.renderApplianceSection?.(true);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function values(ids, kind, date) {
    return api()?.broker?.valuesForEntities?.(ids, kind, date) || Promise.resolve(new Map());
  }

  function isCurrent(bundle) {
    if (!bundle?.period) return false;
    const now = new Date();
    return (
      Number(bundle.period.month) === now.getMonth() + 1 &&
      Number(bundle.period.year) === now.getFullYear()
    );
  }

  function restoreCurrentPeriod() {
    if (!Object.keys(currentMonth).length) return false;
    root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__?.merge?.(currentMonth);
    const registries = [root.CD_PERIOD, periodRegistry()].filter(Boolean);
    [...new Set(registries)].forEach((registry) => {
      Object.entries(currentMonth).forEach(([slot, value]) => {
        try {
          registry[slot] = value;
        } catch (_error) {}
      });
    });
    return true;
  }

  function rememberOrRestorePeriod(bundle) {
    if (!bundle?.month) return;
    if (isCurrent(bundle)) {
      Object.entries(PERIOD_KEYS).forEach(([slot, key]) => {
        const value = Number(bundle.month[key]);
        if (Number.isFinite(value)) currentMonth[slot] = Math.max(0, value);
      });
      restoreCurrentPeriod();
      return;
    }
    root.queueMicrotask?.(restoreCurrentPeriod);
    [20, 60, 140, 300, 620].forEach((delay) =>
      root.setTimeout?.(restoreCurrentPeriod, delay),
    );
  }

  function installStyles() {
    if (!doc || doc.getElementById("dm-compatibility-contracts-0150")) return;
    const style = doc.createElement("style");
    style.id = "dm-compatibility-contracts-0150";
    style.textContent = `
      #editor-modal[data-dm-editor-theme="dark"] .ed-shell{background:var(--card-bg,#161f36)!important;color:var(--text,#e6edf7)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-tabs,#editor-modal[data-dm-editor-theme="dark"] .ed-inner-tabs,#editor-modal[data-dm-editor-theme="dark"] .dm-report-row{background:var(--surface-2,#1b2540)!important;color:var(--text,#e6edf7)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-input{background:var(--surface-3,#212d4c)!important;color:var(--text,#e6edf7)!important;border-color:var(--card-border,#263453)!important}
      #page-appliances-main img.dm-appliance-image-0153,#page-appliances-main img.dm-appliance-image{object-fit:cover!important;object-position:center!important}
      #page-appliances-main img.dm-appliance-image-0153[src^="data:image"],#page-appliances-main img.dm-appliance-image[src^="data:image"]{object-fit:contain!important}
      #dm-shutter-popup header{position:relative!important;display:flex!important;align-items:center!important;justify-content:space-between!important;padding-right:56px!important}
      #dm-shutter-popup [data-shutter-popup-close]{position:absolute!important;right:10px!important;top:50%!important;transform:translateY(-50%)!important}
      #dm-shutter-popup .dm-shutter-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      #dm-shutter-popup .dm-shutter-actions button{width:100%!important;min-width:0!important;box-sizing:border-box!important}
      #editor-modal [data-temperature-form] label:has(#dm-temperature-icon){display:none!important}
    `;
    doc.head.append(style);
  }

  function hideTemperatureIcon() {
    if (!doc) return;
    const form = doc.querySelector("#editor-modal [data-temperature-form]");
    const input = form?.querySelector("#dm-temperature-icon") || doc.getElementById("dm-temperature-icon");
    if (!input) return;
    input.type = "hidden";
    input.hidden = true;
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    if (!clean(input.value)) input.value = "mdi:home";
    const field =
      input.closest("label.ed-slot") ||
      input.closest("label") ||
      input.closest("[data-icon-field]");
    if (form && field && field !== form) {
      input.remove();
      field.remove();
      form.append(input);
    } else if (field) {
      field.hidden = true;
      field.style.setProperty("display", "none", "important");
      field.setAttribute("aria-hidden", "true");
    }
    form?.querySelectorAll("label.ed-slot").forEach((label) => {
      if (!/(^|\s)(Simbolo|Icon)(\s|$)/i.test(clean(label.textContent))) return;
      if (label.querySelector("[data-entity-input]")) return;
      label.remove();
    });
  }

  function normalizeApplianceArtwork() {
    if (!doc) return;
    const devices = store()?.getSection?.("appliances") || [];
    doc.querySelectorAll("#page-appliances-main .appl-wide-card").forEach((card, index) => {
      card.querySelectorAll(".appl-spark").forEach((node) => node.remove());
      const holder = card.querySelector(".appl-ic");
      if (holder && !holder.querySelector("svg,img")) {
        const device =
          devices.find((item) => clean(item.id) === clean(card.dataset.applianceId)) ||
          devices[index];
        const token = clean(device?.visual_key || device?.device_type || device?.name || "generico");
        const markup = root.cdApplianceIcon?.(token, 96);
        if (markup) holder.innerHTML = markup;
      }
      card.querySelectorAll("img.dm-appliance-image").forEach((image) => {
        image.classList.add("dm-appliance-image-0153");
      });
      card.querySelectorAll(".appl-mini").forEach((node) => {
        const original = clean(node.textContent);
        if (!/kWh/i.test(original)) return;
        const value = clean(original.replace(/🔋/gu, "").replace(/^(Totale|Total)\s*/i, ""));
        const next = `${english() ? "Total" : "Totale"} ${value}`;
        if (node.textContent !== next) node.textContent = next;
      });
    });
  }

  async function persistTemperature() {
    const roomId = clean(doc.getElementById("dm-temperature-room")?.value);
    const temp = clean(doc.getElementById("ed-pl-temp")?.value);
    const hum = clean(doc.getElementById("dm-humidity-new")?.value);
    const dashboardStore = store();
    if (!roomId || !dashboardStore?.updateItem) return false;
    await dashboardStore.updateItem("rooms", roomId, { temp, hum });
    root.renderTemperature?.();
    root.buildTempCards?.();
    root.editorSwitch?.("sez7");
    return true;
  }

  function captureTemperatureClick(event) {
    const button = event.target?.closest?.("[data-temperature-submit]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    persistTemperature().catch((error) => root.console?.warn?.("Temperature save", error));
  }

  function captureTemperatureSubmit(event) {
    if (!event.target?.matches?.("[data-temperature-form]")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    persistTemperature().catch((error) => root.console?.warn?.("Temperature save", error));
  }

  function applyDomContracts() {
    publishLegacyFlags();
    installStyles();
    hideTemperatureIcon();
    normalizeApplianceArtwork();
    restoreCurrentPeriod();
    const modal = doc?.getElementById("editor-modal");
    if (modal) {
      modal.dataset.dmEditorTheme =
        doc.documentElement.dataset.theme === "dark" ? "dark" : "light";
    }
  }

  const shared = {
    installed: true,
    ready: true,
    version: VERSION,
    states,
    sampleTimer: 0,
    ingestState,
    ingestStates,
    syncTemperature,
    syncAppliances,
    monthValues(ids, month, year) {
      return values(ids, "month", new Date(year, month - 1, 1));
    },
    yearValues(ids, year) {
      return values(ids, "year", new Date(year, 0, 1));
    },
    refreshCurrent() {
      return api()?.refreshEnergyStatistics0152?.(new Date()) || Promise.resolve(false);
    },
    refreshOverview() {
      return api()?.refreshSelectedPeriod?.() || Promise.resolve(false);
    },
  };
  shared.refreshEnergyStatistics0152 = shared.refreshCurrent;
  shared.refreshEnergyPeriods0154 = shared.refreshCurrent;

  function publish() {
    publishLegacyFlags();
    shared.broker = api()?.broker;
    shared.statistics = shared.broker?.statistics?.bind(shared.broker);
    shared.applyOptionalFlowVisibility = api()?.applyOptionalFlowVisibility;
    KEYS.forEach((key) => {
      root[key] = { ...(root[key] || {}), ...shared };
    });
    root.__DASHBOARDMODERN_RUNTIME_COMPATIBILITY_0150__ = shared;
    applyDomContracts();
  }

  publish();
  if (doc) {
    root.addEventListener("click", captureTemperatureClick, true);
    root.addEventListener("submit", captureTemperatureSubmit, true);
    doc.addEventListener("click", () => root.queueMicrotask?.(applyDomContracts), true);
  }
  root.addEventListener?.("dashboardmodern:runtime-ready", publish);
  root.addEventListener?.("dashboardmodern:legacy-ready", () => root.queueMicrotask?.(applyDomContracts));
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    rememberOrRestorePeriod(event.detail);
    root.queueMicrotask?.(applyDomContracts);
  });
  root.addEventListener?.("dashboardmodern:energy-statistics", () => root.queueMicrotask?.(applyDomContracts));
  root.addEventListener?.("pageshow", publish);
  [40, 120, 300, 700].forEach((delay) => root.setTimeout?.(applyDomContracts, delay));
})(globalThis);
