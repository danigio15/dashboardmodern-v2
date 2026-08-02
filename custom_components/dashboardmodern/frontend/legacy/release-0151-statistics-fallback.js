/* DashboardModern 0.14.16: current-period statistics without Report cross-contamination. */
import { periodRange } from "./release-0151-fixes.js";
import { fetchEnergyStatistics0151 } from "./release-0151-statistics-socket.js";

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
let requestGeneration = 0;

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

function definitionsFor(energy) {
  return PERIOD_SOURCES.map((definition) => {
    const group = energy?.[definition.group] || {};
    const entity = String(
      group[definition.totalKey] || readEditorEntity(definition.group, definition.totalKey) || "",
    ).trim();
    return { definition, group, entity };
  }).filter((item) => item.entity);
}

function rowTime(row) {
  const raw = row?.start ?? row?.end ?? row?.last_updated ?? row?.timestamp ?? 0;
  const value = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(value) ? value : 0;
}

function cumulativeValue(row) {
  for (const key of ["sum", "state", "max"]) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function periodValue(rows = [], baseline = null) {
  const ordered = (Array.isArray(rows) ? rows : [])
    .filter(Boolean)
    .slice()
    .sort((left, right) => rowTime(left) - rowTime(right));
  const changes = ordered
    .map((row) => Number(row?.change))
    .filter((value) => Number.isFinite(value));
  if (changes.length) return Math.max(0, changes.reduce((total, value) => total + value, 0));

  const values = ordered.map(cumulativeValue).filter((value) => value != null);
  const base = cumulativeValue(baseline);
  if (base != null && values.length) values.unshift(base);
  if (values.length < 2) return null;

  let total = 0;
  for (let index = 1; index < values.length; index += 1) {
    const difference = values[index] - values[index - 1];
    total += difference >= 0 ? difference : Math.max(0, values[index]);
  }
  return Math.max(0, total);
}

function baselineStart(range, kind) {
  const start = new Date(range.start);
  if (kind === "year") start.setMonth(start.getMonth() - 2);
  else if (kind === "day") start.setDate(start.getDate() - 1);
  else start.setDate(start.getDate() - 2);
  return start;
}

function inject(slot, value, entity, kind, selected) {
  if (!slot || !Number.isFinite(value)) return;
  const timestamp = new Date().toISOString();
  const state = {
    entity_id: slot,
    state: Math.max(0, value).toFixed(3),
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
  const range = periodRange(kind, selected);
  if (range.end <= range.start) return [];
  const relevant = definitions.filter(({ definition, group }) => {
    const target = definition.periods[kind];
    return target && !String(group[target.explicitKey] || "").trim();
  });
  if (!relevant.length) return [];

  const ids = [...new Set(relevant.map((item) => item.entity))];
  const result = await fetchEnergyStatistics0151(
    ids,
    range.start.toISOString(),
    range.end.toISOString(),
    range.period,
  );

  const unresolved = relevant.filter(({ entity }) => periodValue(result?.[entity] || []) == null);
  let baselines = {};
  if (unresolved.length) {
    const baselineIds = [...new Set(unresolved.map((item) => item.entity))];
    baselines = await fetchEnergyStatistics0151(
      baselineIds,
      baselineStart(range, kind).toISOString(),
      range.start.toISOString(),
      range.period,
    );
  }

  return relevant.flatMap(({ definition, entity }) => {
    const rows = result?.[entity] || [];
    const baselineRows = (baselines?.[entity] || [])
      .slice()
      .sort((left, right) => rowTime(left) - rowTime(right));
    const value = periodValue(rows, baselineRows.at(-1) || null);
    if (value == null) return [];
    return [{
      slot: definition.periods[kind].slot,
      value,
      entity,
      kind,
      selected,
    }];
  });
}

export async function refreshEnergyStatisticsFallback0151(selected = new Date()) {
  const store = dashboardStore();
  if (
    typeof globalThis.fetchHAStatistics !== "function" &&
    typeof globalThis.WebSocket !== "function"
  ) return false;
  rememberEditorTotals();
  const energy = store?.getSection?.("energy") || {};
  const definitions = definitionsFor(energy);
  if (!definitions.length) return false;

  const generation = ++requestGeneration;
  try {
    const updates = (
      await Promise.all([
        requestPeriod("day", new Date(), definitions),
        requestPeriod("month", selected, definitions),
        requestPeriod("year", selected, definitions),
      ])
    ).flat();
    if (generation !== requestGeneration) return false;

    updates.forEach(({ slot, value, entity, kind, selected: updateDate }) => {
      inject(slot, value, entity, kind, updateDate);
    });
    globalThis.renderEnergy?.();
    globalThis.dispatchEvent?.(
      new CustomEvent(REFRESH_EVENT, {
        detail: { selected: selected.toISOString(), transport: "current-period-runtime" },
      }),
    );
    return true;
  } catch (error) {
    console.warn("[DashboardModern] current Energy statistics fallback", error);
    return false;
  }
}

let refreshTimer = 0;
let subscribed = false;
let subscriptionRetry = 0;

function scheduleRefresh(delay = 80) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshEnergyStatisticsFallback0151(new Date()), delay);
}

function subscribeWhenReady() {
  if (subscribed) return true;
  const store = dashboardStore();
  if (!store?.subscribe) {
    clearTimeout(subscriptionRetry);
    subscriptionRetry = setTimeout(subscribeWhenReady, 150);
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
  globalThis[FALLBACK_FLAG] = { installed: true, version: "0.14.16" };
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
