/* DashboardModern 0.15.0 — bounded hooks for the classic legacy bridge. */
(function installLegacyBridgeHooks0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_LEGACY_BRIDGE_HOOKS__";
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
  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    attempts: 0,
    brokerWrapped: false,
    temperatureSaving: false,
  });
  const clean = (value) => String(value ?? "").trim();
  const english = () =>
    clean(doc.documentElement.lang).toLowerCase().startsWith("en") ||
    /dashboard-en\.html/i.test(root.location?.pathname || "");
  const bridge = () => root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__ || null;
  const runtimeState = () => root.__DASHBOARDMODERN_RUNTIME_0150__ || null;
  const runtimeApi = () => root.DashboardModernRuntime0150 || null;
  const store = () => root.DashboardModernModules?.store || null;

  function isCurrent(value = new Date()) {
    const date = new Date(value);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  function projectBundle(bundle = runtimeState()?.bundle) {
    if (!bridge()?.set || !bundle?.period || !bundle?.month) return false;
    const selected = new Date(Number(bundle.period.year), Number(bundle.period.month) - 1, 1);
    if (!isCurrent(selected)) return false;
    Object.entries(MONTH_SLOTS).forEach(([slot, key]) => bridge().set(slot, bundle.month[key]));
    return true;
  }

  function projectDerivedStates() {
    if (!bridge()?.set) return false;
    const states = { ...(root._RAW_STATES || {}), ...(root.STATES || {}) };
    Object.entries(states).forEach(([slot, item]) => {
      if (!item?.attributes?.dashboardmodern_derived) return;
      const kind = item.attributes.dashboardmodern_period;
      const selected = item.attributes.dashboardmodern_selected;
      if (kind === "month" && selected && !isCurrent(selected)) return;
      bridge().set(slot, item.state);
    });
    return true;
  }

  function installBrokerHook() {
    const broker = runtimeApi()?.broker;
    const current = broker?.ingestState;
    if (typeof current !== "function") return false;
    if (current.__dmLegacyBridgeHooks) {
      state.brokerWrapped = true;
      return true;
    }
    function ingestLegacyBridgeHooks0150(item) {
      const result = current.call(this, item);
      if (item?.attributes?.dashboardmodern_derived && bridge()?.set) {
        const kind = item.attributes.dashboardmodern_period;
        const selected = item.attributes.dashboardmodern_selected;
        if (kind !== "month" || !selected || isCurrent(selected)) {
          bridge().set(clean(item.entity_id), item.state);
        }
      }
      return result;
    }
    ingestLegacyBridgeHooks0150.__dmLegacyBridgeHooks = true;
    ingestLegacyBridgeHooks0150.__dmPrevious = current;
    broker.ingestState = ingestLegacyBridgeHooks0150;
    state.brokerWrapped = true;
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
      const holder = input.parentElement;
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
      if (!mini) return;
      const amount = (mini.textContent.match(/[\d.,]+\s*kWh/i) || [""])[0].trim();
      mini.textContent = `${english() ? "Total" : "Totale"}${amount ? ` ${amount}` : ""}`;
    });
  }

  function applyUi() {
    decorateIrrigationEditor();
    normalizeApplianceCards();
    projectBundle();
    projectDerivedStates();
  }

  function wrapAfter(name, after = applyUi) {
    const current = root[name];
    if (typeof current !== "function" || current.__dmLegacyBridgeAfter) return typeof current === "function";
    function legacyBridgeAfter0150(...args) {
      const result = current.apply(this, args);
      const finish = () => root.queueMicrotask?.(after);
      if (result && typeof result.finally === "function") return result.finally(finish);
      finish();
      return result;
    }
    legacyBridgeAfter0150.__dmLegacyBridgeAfter = true;
    legacyBridgeAfter0150.__dmResidualAfter = true;
    legacyBridgeAfter0150.__dmFinalOwner = true;
    legacyBridgeAfter0150.__dmRealFix = name === "editorSwitch" || Boolean(current.__dmRealFix);
    legacyBridgeAfter0150.__dmPrevious = current;
    try {
      root[name] = legacyBridgeAfter0150;
    } catch (_error) {
      return false;
    }
    return root[name] === legacyBridgeAfter0150 || root[name]?.__dmLegacyBridgeAfter === true;
  }

  async function saveTemperatureFromForm() {
    if (state.temperatureSaving) return;
    const dashboardStore = store();
    const roomId = clean(doc.getElementById("dm-temperature-room")?.value);
    const temp = clean(doc.getElementById("ed-pl-temp")?.value);
    const hum = clean(doc.getElementById("dm-humidity-new")?.value);
    if (!dashboardStore?.updateItem || !roomId || (!temp && !hum)) return;
    state.temperatureSaving = true;
    try {
      await dashboardStore.updateItem("rooms", roomId, { temp, hum });
    } catch (_error) {
    } finally {
      state.temperatureSaving = false;
    }
  }

  function installWrappers() {
    wrapAfter("editorSwitch");
    wrapAfter("renderApplianceSection", normalizeApplianceCards);
    wrapAfter("renderAppliances", normalizeApplianceCards);
    wrapAfter("renderEnergy");
    wrapAfter("renderEnergyDashboard");
    wrapAfter("switchEnergyView");
  }

  function scheduleApply() {
    [0, 30, 80, 160, 320, 650, 1100, 1800, 2600].forEach((delay) =>
      root.setTimeout?.(() => {
        installBrokerHook();
        installWrappers();
        applyUi();
      }, delay),
    );
  }

  state.project = () => {
    installBrokerHook();
    installWrappers();
    applyUi();
    return true;
  };

  function settle() {
    state.attempts += 1;
    installBrokerHook();
    installWrappers();
    applyUi();
    const ready = Boolean(bridge()?.set && runtimeState()?.ready && runtimeState()?.bundle);
    if (!ready && state.attempts < 240) root.requestAnimationFrame?.(settle);
    else scheduleApply();
  }

  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-temperature-submit]")) saveTemperatureFromForm();
      root.queueMicrotask?.(applyUi);
    },
    true,
  );
  doc.addEventListener("change", () => root.queueMicrotask?.(applyUi), true);
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleApply);
  root.addEventListener?.("dashboardmodern:period-bundle", scheduleApply);
  root.addEventListener?.("dashboardmodern:energy-statistics", scheduleApply);
  root.addEventListener?.("dashboardmodern:legacy-period-bridge-ready", scheduleApply);
  root.addEventListener?.("pageshow", scheduleApply);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", settle, { once: true });
  else settle();
})(globalThis);
