/* Deterministic, bounded recovery for an empty initial Energy bundle. */
import { applyAtomicEnergyBundle } from "../../legacy/runtime-consolidated.js";
import { HomeAssistantBroker } from "./period-service.js";

const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_ENERGY_READY_GUARD__";
const state = (root[KEY] ||= {
  installed: true,
  attempts: 0,
  timer: 0,
  running: false,
  done: false,
  failures: 0,
});

const clean = (value) => String(value ?? "").trim();
const finite = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const dashboardStore = () => root.DashboardModernModules?.store || null;
const broker = new HomeAssistantBroker({
  timeout: 3000,
  cacheCurrentMs: 0,
  cacheHistoricalMs: 0,
});

function energyConfiguration() {
  const store = dashboardStore();
  if (!store?.getSection) return null;
  const energy = store.getSection("energy") || {};
  const source = (group, periodKey, totalKey) =>
    clean(energy[group]?.[periodKey] || energy[group]?.[totalKey]);
  return {
    day: {
      house: source("house", "daily_energy", "total_energy"),
      solar: source("solar", "daily_energy", "total_energy"),
      gridImport: source("grid", "daily_import_energy", "total_import_energy"),
      gridExport: source("grid", "daily_export_energy", "total_export_energy"),
      batteryCharged: source("battery", "daily_charged_energy", "total_charged_energy"),
      batteryDischarged: source("battery", "daily_discharged_energy", "total_discharged_energy"),
    },
    month: {
      house: source("house", "monthly_energy", "total_energy"),
      solar: source("solar", "monthly_energy", "total_energy"),
      gridImport: source("grid", "monthly_import_energy", "total_import_energy"),
      gridExport: source("grid", "monthly_export_energy", "total_export_energy"),
      batteryCharged: source("battery", "monthly_charged_energy", "total_charged_energy"),
      batteryDischarged: source("battery", "monthly_discharged_energy", "total_discharged_energy"),
    },
    year: {
      house: source("house", "annual_energy", "total_energy"),
      solar: source("solar", "annual_energy", "total_energy"),
      gridImport: source("grid", "annual_import_energy", "total_import_energy"),
      gridExport: source("grid", "annual_export_energy", "total_export_energy"),
      batteryCharged: source("battery", "annual_charged_energy", "total_charged_energy"),
      batteryDischarged: source("battery", "annual_discharged_energy", "total_discharged_energy"),
    },
  };
}

function canonicalDevices() {
  const store = dashboardStore();
  const states = { ...(root._RAW_STATES || {}), ...(root.STATES || {}) };
  const build = root.DashboardModernModules?.data?.canonicalReportDevices;
  if (typeof build === "function") {
    return build(
      store?.getSection?.("appliances") || [],
      store?.getSection?.("loads") || [],
      states,
    );
  }
  return [
    ...(store?.getSection?.("appliances") || []),
    ...(store?.getSection?.("loads") || []),
  ]
    .filter((item) => item?.show_in_report !== false)
    .map((item) => ({
      ...item,
      entity:
        clean(item.total_energy_entity) ||
        clean(item.report_entity) ||
        clean(item.history_entity) ||
        clean(item.energy_entity) ||
        clean(item.monthly_energy_entity),
    }))
    .filter((item) => clean(item.entity));
}

function periodRange(kind, now = new Date()) {
  let start;
  let baselineStart;
  let period;
  if (kind === "day") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    baselineStart = new Date(start);
    baselineStart.setHours(baselineStart.getHours() - 2);
    period = "hour";
  } else if (kind === "year") {
    start = new Date(now.getFullYear(), 0, 1);
    baselineStart = new Date(start);
    baselineStart.setMonth(baselineStart.getMonth() - 1);
    period = "month";
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    baselineStart = new Date(start);
    baselineStart.setDate(baselineStart.getDate() - 2);
    period = "day";
  }
  return { start, baselineStart, end: now, period };
}

async function statistics(ids, start, end, period) {
  const statisticIds = [...new Set((ids || []).map(clean).filter(Boolean))];
  if (!statisticIds.length) return {};
  const result = await broker.request({
    type: "recorder/statistics_during_period",
    start_time: new Date(start).toISOString(),
    end_time: new Date(end).toISOString(),
    statistic_ids: statisticIds,
    period,
    units: { energy: "kWh" },
  });
  return result && typeof result === "object" ? result : {};
}

function lastValue(rows) {
  const list = Array.isArray(rows) ? rows : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    for (const key of ["sum", "state", "max"]) {
      const value = finite(list[index]?.[key]);
      if (value != null) return value;
    }
  }
  return null;
}

function consumption(currentRows, baselineRows) {
  const current = lastValue(currentRows);
  const baseline = lastValue(baselineRows);
  if (current == null) return 0;
  if (baseline == null) return Math.max(0, current);
  const delta = current - baseline;
  return Math.max(0, delta >= 0 ? delta : current);
}

async function loadPeriod(kind, sources, now) {
  const range = periodRange(kind, now);
  const ids = [...new Set(Object.values(sources).filter(Boolean))];
  const [current, baseline] = await Promise.all([
    statistics(ids, range.start, range.end, range.period),
    statistics(ids, range.baselineStart, range.start, range.period),
  ]);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(sources).map(([key, entity]) => [
        key,
        entity ? consumption(current[entity], baseline[entity]) : 0,
      ]),
    ),
  );
}

async function loadDevicePeriod(kind, devices, now) {
  const range = periodRange(kind, now);
  const ids = [...new Set(devices.map((device) => clean(device.entity)).filter(Boolean))];
  const [current, baseline] = await Promise.all([
    statistics(ids, range.start, range.end, range.period),
    statistics(ids, range.baselineStart, range.start, range.period),
  ]);
  return new Map(
    ids.map((entity) => [entity, consumption(current[entity], baseline[entity])]),
  );
}

function rates() {
  const read = (key) => {
    const configured = root.cdCfg?.(key);
    const raw = configured !== undefined && configured !== null && configured !== ""
      ? configured
      : root.localStorage?.getItem(key);
    return finite(raw) || 0;
  };
  return Object.freeze({
    importPrice: read("cd_costo_kwh"),
    exportPrice: read("cd_prezzo_immissione"),
  });
}

function expose(label, details = "") {
  if (!doc?.documentElement) return;
  doc.documentElement.dataset.dmEnergyGuard = [
    label,
    root.WebSocket?.name || "none",
    state.attempts,
    state.failures,
    details,
  ].join("|");
}

async function recoverInitialBundle() {
  if (state.running || state.done) return;
  const configuration = energyConfiguration();
  if (!configuration?.month?.house) return;
  if (root.WebSocket?.name === "StubSocket") return;
  const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__;
  if (!runtime) return;

  state.running = true;
  expose("running", configuration.month.house);
  const owner = root.__DASHBOARDMODERN_VEHICLE_IMAGE_RUNTIME__;
  const coordinator = root.__DASHBOARDMODERN_STARTUP_COORDINATOR__;
  root.clearTimeout?.(owner?.energyTimer);
  if (owner) {
    owner.energyTimer = 0;
    owner.energyVerified = true;
  }
  if (coordinator) coordinator.completed = true;

  try {
    const now = new Date();
    const devices = canonicalDevices();
    const [day, month, year, deviceMonth, deviceYear] = await Promise.all([
      loadPeriod("day", configuration.day, now),
      loadPeriod("month", configuration.month, now),
      loadPeriod("year", configuration.year, now),
      loadDevicePeriod("month", devices, now),
      loadDevicePeriod("year", devices, now),
    ]);

    const generation = Math.max(
      Number(runtime.generation) || 0,
      Number(runtime.bundle?.generation) || 0,
    ) + 1;
    const bundle = Object.freeze({
      generation,
      period: Object.freeze({ month: now.getMonth() + 1, year: now.getFullYear() }),
      day,
      month,
      year,
      deviceMonth: Object.freeze({ devices, values: deviceMonth }),
      deviceYear: Object.freeze({ devices, values: deviceYear }),
      rates: rates(),
    });

    runtime.generation = generation;
    runtime.bundle = bundle;
    runtime.selected = bundle.period;
    runtime.lastRefreshAt = Date.now();
    root.__DASHBOARDMODERN_RUNTIME_0150__ = runtime;
    applyAtomicEnergyBundle(bundle);
    root.dispatchEvent?.(
      new CustomEvent("dashboardmodern:period-bundle", { detail: bundle }),
    );
    state.done = true;
    expose("done", `${bundle.day.house}/${bundle.month.house}/${bundle.year.house}`);
  } catch (error) {
    state.failures += 1;
    expose("error", clean(error?.message || error));
    broker.reset?.(error);
    if (coordinator) coordinator.completed = false;
    if (owner) owner.energyVerified = false;
  } finally {
    state.running = false;
  }
}

function tick() {
  state.timer = 0;
  state.attempts += 1;
  const house = Number(root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle?.month?.house || 0);
  if (Number.isFinite(house) && house !== 0) {
    state.done = true;
    expose("existing", String(house));
    return;
  }
  recoverInitialBundle();
  if (!state.done && state.attempts < 360) {
    state.timer = root.setTimeout?.(tick, 25);
  }
}

root.addEventListener?.("dashboardmodern:legacy-ready", tick);
root.addEventListener?.("dashboardmodern:runtime-ready", tick);
root.queueMicrotask?.(tick);
