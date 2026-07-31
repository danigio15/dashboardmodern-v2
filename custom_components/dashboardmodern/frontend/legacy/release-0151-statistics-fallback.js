/* DashboardModern 0.14.11: authenticated statistics fallback for late store startup. */
import { periodDelta, periodRange } from "./release-0151-fixes.js";

const FALLBACK_FLAG = "__DASHBOARDMODERN_RELEASE_0151_STATISTICS_FALLBACK__";
const REFRESH_EVENT = "dashboardmodern:energy-statistics";

const PERIOD_SOURCES = Object.freeze([
  {
    group: "house",
    totalKey: "total_energy",
    periods: {
      day: { explicitKey: "daily_energy", slot: "dm.energy_consumo_casa_oggi" },
      month: { explicitKey: "monthly_energy", slot: "dm.energy_consumo_casa_mese" },
      year: { explicitKey: "annual_energy", slot: "dm.energy_consumo_casa_anno" },
    },
  },
  {
    group: "grid",
    totalKey: "total_import_energy",
    periods: {
      day: { explicitKey: "daily_import_energy", slot: "dm.energy_energia_prelevata_oggi" },
      month: { explicitKey: "monthly_import_energy", slot: "dm.energy_rete_acquistata_mese" },
      year: { explicitKey: "annual_import_energy", slot: "dm.energy_rete_acquistata_anno" },
    },
  },
  {
    group: "grid",
    totalKey: "total_export_energy",
    periods: {
      day: { explicitKey: "daily_export_energy", slot: "dm.energy_energia_immessa_oggi" },
      month: { explicitKey: "monthly_export_energy", slot: "dm.energy_rete_venduta_mese" },
      year: { explicitKey: "annual_export_energy", slot: "dm.energy_rete_venduta_anno" },
    },
  },
  {
    group: "solar",
    totalKey: "total_energy",
    periods: {
      day: { explicitKey: "daily_energy", slot: "dm.energy_produzione_solare_oggi" },
      month: { explicitKey: "monthly_energy", slot: "dm.energy_produzione_solare_mese" },
      year: { explicitKey: "annual_energy", slot: "dm.energy_produzione_solare_anno" },
    },
  },
  {
    group: "battery",
    totalKey: "total_charged_energy",
    periods: {
      day: { explicitKey: "daily_charged_energy", slot: "dm.energy_batteria_caricata_oggi" },
      month: { explicitKey: "monthly_charged_energy", slot: "dm.energy_batteria_caricata_mese" },
      year: { explicitKey: "annual_charged_energy", slot: "dm.energy_batteria_caricata_anno" },
    },
  },
  {
    group: "battery",
    totalKey: "total_discharged_energy",
    periods: {
      day: { explicitKey: "daily_discharged_energy", slot: "dm.energy_batteria_scaricata_oggi" },
      month: { explicitKey: "monthly_discharged_energy", slot: "dm.energy_batteria_usata_mese" },
      year: { explicitKey: "annual_discharged_energy", slot: "dm.energy_batteria_usata_anno" },
    },
  },
]);

const editorTotals = new Map();

function dashboardStore() {
  return globalThis.DashboardModernModules?.store;
}

function fieldName(group, key) {
  return `${group}.${key}`;
}

function readEditorEntity(group, key) {
  const name = fieldName(group, key);
  const input = document.querySelector(
    `[data-editor="energy"] [name="${name}"], #editor-modal [name="${name}"]`,
  );
  const value = String(input?.value || "").trim();
  if (value) editorTotals.set(name, value);
  return value || editorTotals.get(name) || "";
}

function rememberEditorTotals() {
  PERIOD_SOURCES.forEach(({ group, totalKey }) => readEditorEntity(group, totalKey));
}

function isEnergySaveButton(button) {
  if (!(button instanceof HTMLButtonElement)) return false;
  if (button.matches("[data-energy-save]")) return true;
  const text = String(button.textContent || "").replace(/\s+/g, " ").trim();
  return /(?:salva\s+energia|save\s+energy)/i.test(text);
}

function selectedReportDate() {
  const scope =
    document.getElementById("page-energy") || document.getElementById("page-energia") || document;
  const selects = [...scope.querySelectorAll("select")].filter(
    (select) => !select.closest("#editor-modal"),
  );
  const label = (select) =>
    `${select.id} ${select.name} ${select.className} ${select.getAttribute("aria-label") || ""} ${select.previousElementSibling?.textContent || ""}`.toLowerCase();
  const monthSelect = selects.find((select) => /month|mese/.test(label(select)));
  const yearSelect = selects.find((select) => /year|anno/.test(label(select)));
  const now = new Date();
  const rawMonth = Number(monthSelect?.value);
  const month =
    Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12
      ? rawMonth - 1
      : Number.isInteger(rawMonth) && rawMonth >= 0 && rawMonth <= 11
        ? rawMonth
        : now.getMonth();
  const rawYear = Number(yearSelect?.value || yearSelect?.selectedOptions?.[0]?.textContent);
  const year = Number.isInteger(rawYear) && rawYear >= 2000 ? rawYear : now.getFullYear();
  return new Date(year, month, 1);
}

function definitionsFor(energy) {
  return PERIOD_SOURCES.map((definition) => {
    const group = energy?.[definition.group] || {};
    const entity = String(
      group[definition.totalKey] || readEditorEntity(definition.group, definition.totalKey) || "",
    ).trim();
    return { definition, group, entity };
  }).filter((item) => item.entity);
}

function inject(slot, value, entity, kind, selected) {
  if (!slot || !Number.isFinite(value)) return;
  const timestamp = new Date().toISOString();
  const state = {
    entity_id: slot,
    state: Math.max(0, value).toFixed(1),
    attributes: {
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "measurement",
      friendly_name: slot,
      dashboardmodern_derived: true,
      dashboardmodern_source: entity,
      dashboardmodern_period: kind,
      dashboardmodern_selected: selected.toISOString(),
    },
    last_updated: timestamp,
    last_changed: timestamp,
  };
  globalThis._RAW_STATES ||= {};
  globalThis._RAW_STATES[slot] = state;
  if (globalThis.STATES && globalThis.STATES !== globalThis._RAW_STATES) {
    globalThis.STATES[slot] = state;
  }
}

async function requestPeriod(kind, selected, definitions) {
  const fetchStatistics = globalThis.fetchHAStatistics;
  if (typeof fetchStatistics !== "function") return false;
  const range = periodRange(kind, selected);
  if (range.end <= range.start) return false;
  const ids = [...new Set(definitions.map((item) => item.entity))];
  const result = await fetchStatistics(
    ids,
    range.start.toISOString(),
    range.end.toISOString(),
    range.period,
  );
  definitions.forEach(({ definition, group, entity }) => {
    const target = definition.periods[kind];
    if (!target || String(group[target.explicitKey] || "").trim()) return;
    inject(target.slot, periodDelta(result?.[entity] || []), entity, kind, selected);
  });
  return true;
}

export async function refreshEnergyStatisticsFallback0151(selected = selectedReportDate()) {
  const store = dashboardStore();
  if (typeof globalThis.fetchHAStatistics !== "function") return false;
  rememberEditorTotals();
  const energy = store?.getSection?.("energy") || {};
  const definitions = definitionsFor(energy);
  if (!definitions.length) return false;
  try {
    await Promise.all([
      requestPeriod("day", new Date(), definitions),
      requestPeriod("month", selected, definitions),
      requestPeriod("year", selected, definitions),
    ]);
    globalThis.render?.();
    globalThis.renderEnergy?.();
    globalThis.renderReport?.();
    globalThis.dispatchEvent?.(
      new CustomEvent(REFRESH_EVENT, {
        detail: { selected: selected.toISOString(), transport: "authenticated-runtime" },
      }),
    );
    return true;
  } catch (error) {
    console.warn("[DashboardModern] authenticated Energy statistics fallback", error);
    return false;
  }
}

let refreshTimer = 0;
let subscribed = false;
let subscriptionRetry = 0;

function scheduleRefresh(delay = 80) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshEnergyStatisticsFallback0151(), delay);
}

function subscribeWhenReady() {
  if (subscribed) return true;
  const store = dashboardStore();
  if (!store?.subscribe) {
    clearTimeout(subscriptionRetry);
    subscriptionRetry = setTimeout(subscribeWhenReady, 100);
    return false;
  }
  subscribed = true;
  store.subscribe((change) => {
    if (change.section === "energy" && change.status === "success") {
      rememberEditorTotals();
      scheduleRefresh(0);
    }
  });
  return true;
}

function install() {
  if (globalThis[FALLBACK_FLAG]?.installed) return;
  globalThis[FALLBACK_FLAG] = { installed: true, version: "0.14.11" };
  subscribeWhenReady();
  document.addEventListener(
    "input",
    (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (!PERIOD_SOURCES.some(({ group, totalKey }) => input.name === fieldName(group, totalKey))) return;
      const value = String(input.value || "").trim();
      if (value) editorTotals.set(input.name, value);
      else editorTotals.delete(input.name);
    },
    true,
  );
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest?.("button");
      if (!isEnergySaveButton(button)) return;
      rememberEditorTotals();
      scheduleRefresh(180);
    },
    true,
  );
  document.addEventListener(
    "change",
    (event) => {
      const select = event.target;
      if (!(select instanceof HTMLSelectElement) || select.closest("#editor-modal")) return;
      const description = `${select.id} ${select.name} ${select.getAttribute("aria-label") || ""}`;
      if (/month|mese|year|anno/i.test(description)) scheduleRefresh(40);
    },
    true,
  );
  globalThis.addEventListener("dashboardmodern:legacy-ready", () => {
    subscribeWhenReady();
    scheduleRefresh(120);
  });
  scheduleRefresh(900);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
}
