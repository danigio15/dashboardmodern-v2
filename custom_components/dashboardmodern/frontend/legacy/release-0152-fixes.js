/* DashboardModern 0.15.0 compatibility facade: one production runtime. */
import "./runtime-regression-guard.js";
import {
  refreshEnergyStatistics0152 as refreshEnergyStatisticsCore0152,
  refreshSelectedPeriod,
} from "./runtime-consolidated.js";
import "./runtime-canonical-readiness.js";
import "./runtime-residual-contracts.js";
import "./runtime-compatibility.js";
import "./runtime-release-owner-v3.js";

(function installReleaseE2EGuard0150(root) {
  "use strict";
  const KEY = "__DASHBOARDMODERN_RELEASE_E2E_GUARD_0150__";
  if (root[KEY]?.installed || !root.document) return;
  const doc = root.document;
  const guard = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    currentMonth: Object.create(null),
  });
  const MONTH_SLOTS = Object.freeze({
    "dm.energy_consumo_casa_mese": "house",
    "dm.energy_produzione_solare_mese": "solar",
    "dm.energy_rete_acquistata_mese": "gridImport",
    "dm.energy_rete_venduta_mese": "gridExport",
    "dm.energy_batteria_caricata_mese": "batteryCharged",
    "dm.energy_batteria_usata_mese": "batteryDischarged",
  });
  const clean = (value) => String(value ?? "").trim();
  const store = () => root.DashboardModernModules?.store || null;
  const bundle = () => root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle || null;

  function isCurrent(value) {
    if (!value?.period) return false;
    const now = new Date();
    return Number(value.period.month) === now.getMonth() + 1 &&
      Number(value.period.year) === now.getFullYear();
  }

  function registries() {
    const targets = [];
    if (root.CD_PERIOD && typeof root.CD_PERIOD === "object") targets.push(root.CD_PERIOD);
    try {
      const lexical = root.eval?.("typeof CD_PERIOD !== 'undefined' ? CD_PERIOD : null");
      if (lexical && typeof lexical === "object") targets.push(lexical);
    } catch (_error) {}
    return [...new Set(targets)];
  }

  function capture(value = bundle()) {
    if (!isCurrent(value) || !value?.month) return false;
    Object.entries(MONTH_SLOTS).forEach(([slot, key]) => {
      const amount = Number(value.month[key]);
      if (Number.isFinite(amount)) guard.currentMonth[slot] = Math.max(0, amount);
    });
    return Object.keys(guard.currentMonth).length > 0;
  }

  function restore() {
    if (!Object.keys(guard.currentMonth).length) return false;
    const owner = root.__DASHBOARDMODERN_RELEASE_OWNER_0150__;
    if (owner?.currentMonth) {
      Object.assign(owner.currentMonth, guard.currentMonth);
    }
    root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__?.merge?.(guard.currentMonth);
    root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE_V2__?.merge?.(guard.currentMonth);
    registries().forEach((registry) => {
      Object.entries(guard.currentMonth).forEach(([slot, amount]) => {
        try {
          registry[slot] = amount;
        } catch (_error) {}
      });
    });
    return true;
  }

  function section(name, fallback) {
    try {
      return store()?.getSection?.(name) ?? fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function availability() {
    const energy = section("energy", {}) || {};
    const names = ["energy", "ev", "loads", "appliances", "climate", "rooms"];
    const config = JSON.stringify(
      Object.fromEntries(names.map((name) => [name, section(name, name === "energy" ? {} : [])])),
    ).toLowerCase();
    const hasGroup = (name) =>
      Object.values(energy?.[name] || {}).some((value) => clean(value).includes("."));
    return {
      solar: hasGroup("solar"),
      grid: hasGroup("grid"),
      battery: hasGroup("battery"),
      home: hasGroup("house"),
      wb: /wallbox|evcc|charge[_ -]?power|charging[_ -]?power/.test(config),
      boiler: /boiler|scaldabagno|water[_ -]?heater/.test(config),
      clima: /climate\.|condizion|air[_ -]?condition/.test(config),
      lav: /lavatrice|washer|washing[_ -]?machine|asciugatrice|dryer/.test(config),
      cuc: /forno|oven|microonde|microwave|frigo|fridge|dishwasher|lavastoviglie|cooktop/.test(config),
    };
  }

  function endpoints(pathId) {
    return String(pathId || "")
      .replace(/^m-/, "")
      .replace(/^line-/, "")
      .replace(/-(ist|day|month)$/, "")
      .split("-")
      .filter(Boolean)
      .slice(0, 2);
  }

  function applyOptionalFlowVisibility() {
    const available = availability();
    for (const view of ["ist", "day", "month"]) {
      const suffix = view === "ist" ? "" : `-${view}`;
      Object.entries(available).forEach(([token, present]) => {
        const node = doc.getElementById(`n-${token}${suffix}`);
        if (!node) return;
        node.hidden = !present;
        node.style.display = present ? "" : "none";
      });
      doc.querySelectorAll(`#view-${view} .flow-line`).forEach((path) => {
        const visible = endpoints(path.id).every((token) => available[token] !== false);
        path.hidden = !visible;
        path.style.display = visible ? "" : "none";
      });
    }
    return true;
  }

  function publish() {
    const compatibility = root.__DASHBOARDMODERN_RUNTIME_COMPATIBILITY_0150__;
    if (compatibility) compatibility.applyOptionalFlowVisibility = applyOptionalFlowVisibility;
    capture();
    if (!isCurrent(bundle())) restore();
    applyOptionalFlowVisibility();
  }

  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    if (isCurrent(event.detail)) {
      capture(event.detail);
      restore();
    } else {
      restore();
      root.queueMicrotask?.(restore);
      [0, 40, 140].forEach((delay) => root.setTimeout?.(restore, delay));
    }
    publish();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => root.queueMicrotask?.(publish));
  root.addEventListener?.("dashboardmodern:legacy-ready", () => root.queueMicrotask?.(publish));
  root.addEventListener?.("pageshow", () => root.queueMicrotask?.(publish));
  root.queueMicrotask?.(publish);
  [50, 180].forEach((delay) => root.setTimeout?.(publish, delay));
})(globalThis);

(function installReviewCorrections0150(root) {
  "use strict";
  const KEY = "__DASHBOARDMODERN_REVIEW_CORRECTIONS_0150__";
  if (root[KEY]?.installed || !root.document) return;

  const doc = root.document;
  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    store: null,
    unsubscribe: null,
    renderingPeriod: false,
    temperatureSubmit: false,
  });
  const clean = (value) => String(value ?? "").trim();
  const store = () => root.DashboardModernModules?.store || null;

  function installDefaultRates() {
    const defaults = {
      cd_costo_kwh: "0.25",
      cd_prezzo_immissione: "0.10",
    };
    Object.entries(defaults).forEach(([key, fallback]) => {
      try {
        const value = root.localStorage?.getItem(key);
        if (value == null || clean(value) === "") root.localStorage?.setItem(key, fallback);
      } catch (_error) {}
    });
  }

  function planIsCurrent(plan, selected) {
    const date = selected instanceof Date ? selected : new Date(selected);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    if (plan?.kind === "year") return date.getFullYear() === now.getFullYear();
    if (plan?.kind === "day") return date.toDateString() === now.toDateString();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  function installHistoricalDirectPlanFix() {
    const broker = root.DashboardModernRuntime0150?.broker;
    const current = broker?.valuesForPlans;
    if (typeof current !== "function" || current.__dmHistoricalDirect0150) return false;

    async function valuesForPlans0150(plans, selected, states) {
      const adjusted = (plans || []).map((plan) =>
        plan?.direct && !planIsCurrent(plan, selected) ? { ...plan, direct: false } : plan,
      );
      return current.call(this, adjusted, selected, states);
    }

    valuesForPlans0150.__dmHistoricalDirect0150 = true;
    valuesForPlans0150.__dmPrevious = current;
    broker.valuesForPlans = valuesForPlans0150;
    return true;
  }

  function finalizePeriodRender(bundle) {
    root.DashboardModernRuntime0150?.applyBundle?.(bundle);
    root.__DASHBOARDMODERN_RESIDUAL_CONTRACTS_0150__?.apply?.();
    root.__DASHBOARDMODERN_RELEASE_OWNER_0150__?.apply?.();
    state.renderingPeriod = false;
  }

  function refreshAllPeriodViews(event) {
    const bundle = event.detail;
    if (!bundle || state.renderingPeriod || typeof root.renderEnergyDashboard !== "function") return;
    state.renderingPeriod = true;
    try {
      const result = root.renderEnergyDashboard();
      if (result && typeof result.finally === "function") {
        result.finally(() => root.setTimeout?.(() => finalizePeriodRender(bundle), 0));
      } else {
        root.setTimeout?.(() => finalizePeriodRender(bundle), 0);
      }
    } catch (_error) {
      finalizePeriodRender(bundle);
    }
  }

  function installApplianceClearFacade() {
    const current = root.edApplSave;
    if (typeof current !== "function" || current.__dmClearTotalEnergy0150) return false;

    async function saveAppliance0150() {
      const field = doc.getElementById("appl-total-energy-entity");
      const total = clean(field?.value);
      const editingId = clean(root.__DASHBOARDMODERN_RUNTIME_0150__?.editingApplianceId);
      const dashboardStore = store();
      const before = (dashboardStore?.getSection?.("appliances") || []).find(
        (item) => clean(item.id) === editingId,
      );
      const oldTotal = clean(before?.total_energy_entity);
      const result = await current.apply(this, arguments);
      if (!field || total || !oldTotal || !dashboardStore?.updateItem) return result;

      const latest = (dashboardStore.getSection("appliances") || []).find(
        (item) => clean(item.id) === clean(before?.id),
      );
      if (!latest) return result;
      const patch = {
        total_energy_entity: "",
        entities: (latest.entities || []).filter((entity) => clean(entity) !== oldTotal),
      };
      if (clean(latest.report_entity) === oldTotal) patch.report_entity = "";
      if (clean(latest.history_entity) === oldTotal) patch.history_entity = "";
      await dashboardStore.updateItem("appliances", latest.id, patch);
      return result;
    }

    saveAppliance0150.__dmClearTotalEnergy0150 = true;
    saveAppliance0150.__dmPrevious = current;
    root.edApplSave = saveAppliance0150;
    return true;
  }

  function installTemperatureStoreValidation() {
    const dashboardStore = store();
    const current = dashboardStore?.updateItem;
    if (typeof current !== "function" || current.__dmTemperatureValidation0150) return false;

    async function updateItem0150(section, id, patch) {
      const invalidTemperature =
        section === "rooms" &&
        state.temperatureSubmit &&
        patch &&
        Object.prototype.hasOwnProperty.call(patch, "temp") &&
        !clean(patch.temp).includes(".");
      state.temperatureSubmit = false;
      if (invalidTemperature) {
        root.alert?.(
          doc.documentElement.lang === "en"
            ? "Enter a valid temperature entity"
            : "Inserisci un'entità temperatura valida",
        );
        return (dashboardStore.getSection("rooms") || []).find((room) => room.id === id) || null;
      }
      return current.call(this, section, id, patch);
    }

    updateItem0150.__dmTemperatureValidation0150 = true;
    updateItem0150.__dmPrevious = current;
    dashboardStore.updateItem = updateItem0150;
    return true;
  }

  function normalizeVisibleTemperatureCards() {
    const rooms = (store()?.getSection?.("rooms") || [])
      .filter((room) => clean(room.temp))
      .sort((left, right) => clean(right.name).length - clean(left.name).length);
    doc.querySelectorAll("#temp-grid .temp-card").forEach((card) => {
      const explicitId = clean(card.dataset.roomId || card.getAttribute("data-room-id"));
      const text = clean(card.textContent).toLowerCase();
      const room =
        rooms.find((item) => clean(item.id) === explicitId) ||
        rooms.find((item) => clean(item.name) && text.includes(clean(item.name).toLowerCase()));
      if (!room) return;
      card.dataset.roomId = clean(room.id);
      let icon = card.querySelector(".temp-room-icon");
      if (!icon) {
        icon = doc.createElement("span");
        icon.className = "temp-room-icon";
        (card.querySelector(".temp-card-header") || card).prepend(icon);
      }
      const source = clean(room.icon) || "mdi:home";
      icon.dataset.roomIcon = source;
      const markup = root.cdIconMarkup?.(source, 28);
      if (markup) icon.innerHTML = markup;
      else icon.textContent = /^mdi:/i.test(source) ? "🏠" : source;
    });
  }

  function removeDuplicateAlertList() {
    doc.querySelectorAll("#editor-modal [data-dm-standard-alert-list]").forEach((node) => node.remove());
  }

  function scheduleReviewApply() {
    root.queueMicrotask?.(applyReviewCorrections);
    [0, 40, 140].forEach((delay) => root.setTimeout?.(applyReviewCorrections, delay));
  }

  function installEditorCleanupFacade() {
    const current = root.editorSwitch;
    if (typeof current !== "function" || current.__dmReviewCorrections0150) return false;

    function editorSwitch0150() {
      const result = current.apply(this, arguments);
      scheduleReviewApply();
      return result;
    }

    Object.assign(editorSwitch0150, current);
    editorSwitch0150.__dmReviewCorrections0150 = true;
    editorSwitch0150.__dmPrevious = current;
    root.editorSwitch = editorSwitch0150;
    return true;
  }

  function installTemperatureRenderFacade() {
    const current = root.buildTempCards;
    if (typeof current !== "function" || current.__dmVisibleRooms0150) return false;

    function buildTempCards0150() {
      const result = current.apply(this, arguments);
      root.queueMicrotask?.(normalizeVisibleTemperatureCards);
      return result;
    }

    buildTempCards0150.__dmVisibleRooms0150 = true;
    buildTempCards0150.__dmPrevious = current;
    root.buildTempCards = buildTempCards0150;
    return true;
  }

  function bindStore() {
    const dashboardStore = store();
    if (!dashboardStore || state.store === dashboardStore) return Boolean(dashboardStore);
    state.unsubscribe?.();
    state.store = dashboardStore;
    state.unsubscribe = dashboardStore.subscribe?.((change) => {
      if (["rooms", "appliances", "lights", "snapshot"].includes(change?.section)) {
        scheduleReviewApply();
      }
    });
    return true;
  }

  function applyReviewCorrections() {
    installDefaultRates();
    installHistoricalDirectPlanFix();
    installApplianceClearFacade();
    installTemperatureStoreValidation();
    installEditorCleanupFacade();
    installTemperatureRenderFacade();
    normalizeVisibleTemperatureCards();
    removeDuplicateAlertList();
    bindStore();
  }

  doc.addEventListener(
    "pointerdown",
    (event) => {
      if (!event.target?.closest?.("[data-temperature-submit]")) return;
      state.temperatureSubmit = true;
      root.setTimeout?.(() => {
        state.temperatureSubmit = false;
      }, 1000);
    },
    true,
  );
  doc.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" || !event.target?.closest?.("[data-temperature-form]")) return;
      const temp = clean(doc.getElementById("ed-pl-temp")?.value);
      if (temp.includes(".")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      root.alert?.(
        doc.documentElement.lang === "en"
          ? "Enter a valid temperature entity"
          : "Inserisci un'entità temperatura valida",
      );
    },
    true,
  );

  root.addEventListener?.("dashboardmodern:period-bundle", refreshAllPeriodViews);
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleReviewApply);
  root.addEventListener?.("dashboardmodern:legacy-ready", scheduleReviewApply);
  root.addEventListener?.("pageshow", scheduleReviewApply);
  doc.addEventListener("click", scheduleReviewApply, true);

  applyReviewCorrections();
  [50, 180, 500, 900].forEach((delay) => root.setTimeout?.(applyReviewCorrections, delay));
})(globalThis);

function loadClassicRuntime(id, path, readyKey) {
  if (typeof document === "undefined" || globalThis[readyKey]) return Promise.resolve(true);
  const current = document.getElementById(id);
  if (current) {
    return new Promise((resolve) => {
      if (globalThis[readyKey]) resolve(true);
      else {
        current.addEventListener("load", () => resolve(true), { once: true });
        current.addEventListener("error", () => resolve(false), { once: true });
      }
    });
  }
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = new URL(path, import.meta.url).href;
    script.async = false;
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    (document.head || document.documentElement).append(script);
  });
}

const classicRuntimeReady =
  typeof document === "undefined"
    ? Promise.resolve(true)
    : loadClassicRuntime(
        "dm-runtime-legacy-period-bridge-v2",
        "./runtime-legacy-period-bridge-v2.js",
        "__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE_V2__",
      );

function statisticsStatus(result) {
  if (typeof document === "undefined") return;
  let status = document.querySelector("[data-dm-energy-statistics-status]");
  if (!status) {
    status = document.createElement("output");
    status.hidden = true;
    status.dataset.dmEnergyStatisticsStatus = "";
    status.setAttribute("aria-live", "polite");
    (document.getElementById("page-energy") || document.body || document.documentElement).append(status);
  }
  status.textContent = result
    ? ""
    : document.documentElement.lang === "en"
      ? "Energy statistics unavailable"
      : "Statistiche energia non disponibili";
}

export { refreshSelectedPeriod };

export async function refreshEnergyStatistics0152(selected = new Date()) {
  await classicRuntimeReady;
  const broker = globalThis.DashboardModernRuntime0150?.broker;
  broker?.cache?.clear?.();
  broker?.inflight?.clear?.();
  const result = await refreshEnergyStatisticsCore0152(selected);
  globalThis.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__?.project?.();
  globalThis.__DASHBOARDMODERN_RESIDUAL_CONTRACTS_0150__?.apply?.();
  globalThis.__DASHBOARDMODERN_RELEASE_OWNER_0150__?.apply?.();
  statisticsStatus(result);
  return result;
}

export {
  PERIOD_SOURCES as PERIOD_SOURCES_0152,
  isCumulativeEnergyEntity as isCumulativeEnergyEntity0154,
  periodConsumption as periodConsumption0152,
  periodRange as periodRange0152,
  sourcePlans as periodPlans0154,
} from "../src/core/period-service.js";

export {
  applianceArtwork0152,
  applianceArtwork0154,
  canonicalArtworkType0154,
} from "../src/core/appliance-artwork.js";
