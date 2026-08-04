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
