/* DashboardModern 0.15.0 — classic bridge for the vendored runtime and final UI contracts. */
(function installLegacyPeriodBridge0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__";
  if (root[KEY]?.installed) return;
  const doc = root.document;
  if (!doc) return;

  const MONTH_SLOTS = Object.freeze({
    "dm.energy_consumo_casa_mese": "house",
    "dm.energy_produzione_solare_mese": "solar",
    "dm.energy_rete_acquistata_mese": "gridImport",
    "dm.energy_rete_venduta_mese": "gridExport",
    "dm.energy_batteria_caricata_mese": "batteryCharged",
    "dm.energy_batteria_usata_mese": "batteryDischarged",
  });
  const state = {
    installed: true,
    version: "0.15.0",
    attempts: 0,
    ownerInstalled: false,
    brokerWrapped: false,
    editorGateInstalled: false,
    values: Object.create(null),
  };
  const clean = (value) => String(value ?? "").trim();
  const finite = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const english = () =>
    clean(doc.documentElement.lang).toLowerCase().startsWith("en") ||
    /dashboard-en\.html/i.test(root.location?.pathname || "");

  function registry() {
    try {
      if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
    } catch (_error) {}
    return (root.CD_PERIOD ||= {});
  }

  function currentDate(value = new Date()) {
    const date = new Date(value);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  function installPeriodOwner() {
    if (state.ownerInstalled) return true;
    const target = registry();
    Object.keys(MONTH_SLOTS).forEach((slot) => {
      const initial = finite(target[slot]);
      state.values[slot] = { value: initial == null ? 0 : Math.max(0, initial), owned: false };
      try {
        Object.defineProperty(target, slot, {
          configurable: true,
          enumerable: true,
          get() {
            return state.values[slot].value;
          },
          set(raw) {
            const value = finite(raw);
            if (value == null || state.values[slot].owned) return;
            state.values[slot].value = Math.max(0, value);
          },
        });
      } catch (_error) {}
    });
    state.ownerInstalled = true;
    return true;
  }

  const api = {
    installed: true,
    version: "0.15.0",
    get(slot) {
      installPeriodOwner();
      return registry()[slot];
    },
    set(slot, raw) {
      const value = finite(raw);
      if (!slot || value == null) return false;
      installPeriodOwner();
      if (state.values[slot]) {
        state.values[slot].value = Math.max(0, value);
        state.values[slot].owned = true;
      } else {
        registry()[slot] = Math.max(0, value);
      }
      return true;
    },
    merge(values) {
      Object.entries(values || {}).forEach(([slot, value]) => api.set(slot, value));
      return registry();
    },
  };
  root[KEY] = api;

  function projectBundle(bundle = root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle) {
    if (!bundle?.period || !bundle?.month) return false;
    const selected = new Date(Number(bundle.period.year), Number(bundle.period.month) - 1, 1);
    if (!currentDate(selected)) return false;
    Object.entries(MONTH_SLOTS).forEach(([slot, key]) => api.set(slot, bundle.month[key]));
    return true;
  }

  function projectDerivedStates() {
    const states = { ...(root._RAW_STATES || {}), ...(root.STATES || {}) };
    Object.keys(MONTH_SLOTS).forEach((slot) => {
      const item = states[slot];
      if (!item?.attributes?.dashboardmodern_derived) return;
      const selected = item.attributes.dashboardmodern_selected;
      if (selected && !currentDate(selected)) return;
      api.set(slot, item.state);
    });
  }

  function installBrokerOwner() {
    const broker = root.DashboardModernRuntime0150?.broker;
    const current = broker?.ingestState;
    if (typeof current !== "function") return false;
    if (current.__dmLegacyPeriodBridge) {
      state.brokerWrapped = true;
      return true;
    }
    function ingestLegacyPeriodBridge0150(item) {
      const result = current.call(this, item);
      const slot = clean(item?.entity_id);
      if (
        MONTH_SLOTS[slot] &&
        item?.attributes?.dashboardmodern_derived === true &&
        item?.attributes?.dashboardmodern_period === "month" &&
        (!item.attributes.dashboardmodern_selected || currentDate(item.attributes.dashboardmodern_selected))
      ) {
        api.set(slot, item.state);
      }
      return result;
    }
    ingestLegacyPeriodBridge0150.__dmLegacyPeriodBridge = true;
    ingestLegacyPeriodBridge0150.__dmPrevious = current;
    broker.ingestState = ingestLegacyPeriodBridge0150;
    state.brokerWrapped = true;
    return true;
  }

  function applyTemperatureEditor() {
    const input = doc.getElementById("dm-temperature-icon");
    const form = doc.querySelector("[data-temperature-form]");
    if (!input && !form) return false;
    if (input) {
      input.type = "hidden";
      input.tabIndex = -1;
      if (!clean(input.value)) input.value = "mdi:home";
      const label = input.closest("label");
      if (label) {
        label.replaceChildren(input);
        label.hidden = true;
        label.style.setProperty("display", "none", "important");
        label.setAttribute("aria-hidden", "true");
      }
    }
    form?.querySelectorAll("label,[data-icon-field]").forEach((node) => {
      if (!/(Simbolo|Icon\b)/i.test(node.textContent || "")) return;
      if (input && node.contains(input)) node.replaceChildren(input);
      else node.replaceChildren();
      node.hidden = true;
      node.style.setProperty("display", "none", "important");
    });
    const submit = doc.querySelector("[data-temperature-submit]");
    if (submit) submit.textContent = english() ? "ASSOCIATE" : "ASSOCIA";
    return true;
  }

  function decorateIrrigationEditor() {
    const body = doc.getElementById("ed-body");
    if (!body || doc.querySelector(".ed-tab.active")?.dataset?.tab !== "irr") return false;
    body.classList.add("dm-irrigation-form");
    const placeholders = {
      "ed-irr-ent": "switch.irrigazione_zona1",
      "ed-irr-rain": "sensor.prob_pioggia_oggi",
      "ed-irr-weather": "weather.casa",
    };
    Object.entries(placeholders).forEach(([id, placeholder]) => {
      const input = doc.getElementById(id);
      if (!input) return;
      input.placeholder = placeholder;
      input.value = clean(input.value).replace(/[\\"]/g, "");
      const holder = input.closest("label,.ed-slot") || input.parentElement;
      if (holder) holder.dataset.entityField = "";
      let button = input.nextElementSibling;
      if (!button?.matches?.("button")) button = holder?.querySelector?.("button");
      if (!button) {
        button = doc.createElement("button");
        input.insertAdjacentElement("afterend", button);
      }
      button.type = "button";
      button.classList.add("dm-entity-picker");
      button.dataset.entityTarget = id;
      if (!clean(button.textContent)) button.textContent = "🔍";
    });
    return true;
  }

  function normalizeApplianceCards() {
    doc.querySelectorAll("#page-appliances-main .appl-wide-card").forEach((card) => {
      const mini = card.querySelector(".appl-mini");
      if (mini) {
        const amount = (mini.textContent.match(/[\d.,]+\s*kWh/i) || [""])[0].trim();
        mini.textContent = `${english() ? "Total" : "Totale"}${amount ? ` ${amount}` : ""}`;
      }
    });
  }

  function applyUi() {
    applyTemperatureEditor();
    decorateIrrigationEditor();
    normalizeApplianceCards();
    projectBundle();
    projectDerivedStates();
  }

  function installStableEditorSwitchGate() {
    const descriptor = Object.getOwnPropertyDescriptor(root, "editorSwitch");
    if (descriptor?.get?.__dmLegacyEditorSwitchGate) {
      state.editorGateInstalled = true;
      return true;
    }
    let current = root.editorSwitch;
    if (typeof current !== "function") return false;

    const decorate = (fn) => {
      if (typeof fn !== "function" || fn.__dmLegacyEditorSwitchGateWrapper) return fn;
      function legacyEditorSwitchGate0150(...args) {
        const result = fn.apply(this, args);
        const finish = () => root.queueMicrotask?.(applyUi);
        if (result && typeof result.finally === "function") return result.finally(finish);
        finish();
        return result;
      }
      legacyEditorSwitchGate0150.__dmLegacyEditorSwitchGateWrapper = true;
      legacyEditorSwitchGate0150.__dmResidualAfter = true;
      legacyEditorSwitchGate0150.__dmFinalOwner = true;
      legacyEditorSwitchGate0150.__dmRealFix = Boolean(fn.__dmRealFix);
      legacyEditorSwitchGate0150.__dmPrevious = fn;
      return legacyEditorSwitchGate0150;
    };

    current = decorate(current);
    function getLegacyEditorSwitch0150() {
      return current;
    }
    getLegacyEditorSwitch0150.__dmLegacyEditorSwitchGate = true;
    Object.defineProperty(root, "editorSwitch", {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      get: getLegacyEditorSwitch0150,
      set(next) {
        if (typeof next === "function") current = decorate(next);
      },
    });
    state.editorGateInstalled = true;
    return true;
  }

  function installStyles() {
    if (doc.getElementById("dm-legacy-period-bridge-style")) return;
    const style = doc.createElement("style");
    style.id = "dm-legacy-period-bridge-style";
    style.textContent = `
      label:has(#dm-temperature-icon){display:none!important}
      html body #page-appliances-main .appl-wide-card.dm-control-device{
        box-sizing:border-box!important;
        width:min(100%,408px)!important;
        max-width:408px!important;
        flex-basis:408px!important;
      }
    `;
    doc.head.append(style);
  }

  function scheduleApply() {
    [0, 40, 120, 260, 520, 900, 1500].forEach((delay) =>
      root.setTimeout?.(() => {
        installBrokerOwner();
        applyUi();
      }, delay),
    );
  }

  function settle() {
    state.attempts += 1;
    installPeriodOwner();
    installBrokerOwner();
    installStableEditorSwitchGate();
    installStyles();
    applyUi();
    const ready = Boolean(root.DashboardModernRuntime0150 && typeof root.editorSwitch === "function");
    if (!ready && state.attempts < 180) root.requestAnimationFrame?.(settle);
  }

  api.merge(root.__DASHBOARDMODERN_LEGACY_PERIOD_PENDING__ || {});
  root.__DASHBOARDMODERN_LEGACY_PERIOD_PENDING__ = {};
  installStyles();
  doc.addEventListener("click", () => root.queueMicrotask?.(applyUi), true);
  doc.addEventListener("change", () => root.queueMicrotask?.(applyUi), true);
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleApply);
  root.addEventListener?.("dashboardmodern:period-bundle", scheduleApply);
  root.addEventListener?.("dashboardmodern:energy-statistics", scheduleApply);
  root.addEventListener?.("pageshow", scheduleApply);
  root.dispatchEvent?.(new CustomEvent("dashboardmodern:legacy-period-bridge-ready"));
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", settle, { once: true });
  else settle();
})(globalThis);
