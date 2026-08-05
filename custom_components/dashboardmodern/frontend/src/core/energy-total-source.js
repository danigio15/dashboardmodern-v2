/* Preserve cumulative totals, canonical aliases and final live-state cleanup. */
import { applyAtomicEnergyBundle } from "../../legacy/runtime-consolidated.js";
import { HomeAssistantBroker } from "./period-service.js";

const root = globalThis;
const KEY = "__DASHBOARDMODERN_ENERGY_TOTAL_SOURCE__";
const state = (root[KEY] ||= {
  installed: true,
  attempts: 0,
  timer: 0,
  repairing: false,
  repaired: false,
  forced: false,
  dayRunning: false,
  dayDone: false,
  done: false,
  shutterAttempts: 0,
  shutterTimer: 0,
});
const dayBroker = new HomeAssistantBroker({
  timeout: 3000,
  cacheCurrentMs: 0,
  cacheHistoricalMs: 0,
});

const clean = (value) => String(value ?? "").trim();
const finite = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const rounded = (value) => Math.round((finite(value) || 0) * 1000) / 1000;

function synchronizeRuntimeAlias() {
  const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__;
  if (!runtime) return null;
  root.__DASHBOARDMODERN_RUNTIME_0150__ = runtime;
  return runtime;
}

function requestFullEnergyRecovery() {
  if (!state.repaired || state.forced) return false;
  const runtime = synchronizeRuntimeAlias();
  const coordinator = root.__DASHBOARDMODERN_STARTUP_COORDINATOR__;
  const vehicle = root.__DASHBOARDMODERN_VEHICLE_IMAGE_RUNTIME__;
  if (!runtime || !vehicle || coordinator?.running || vehicle.energyRunning) return false;

  state.forced = true;
  runtime.bundle = null;
  runtime.lastRefreshAt = 0;
  root.__DASHBOARDMODERN_RUNTIME_0150__ = runtime;
  vehicle.energyVerified = false;
  vehicle.scheduleContracts?.(0);
  vehicle.verifyEnergy?.();
  root.dispatchEvent?.(
    new CustomEvent("dashboardmodern:energy-total-source-ready", {
      detail: { source: state.source, fullRecovery: true },
    }),
  );
  return true;
}

async function repair() {
  if (state.repairing || state.repaired) return;
  const store = root.DashboardModernModules?.store;
  if (!store?.getSection || !store?.replaceSection) return;
  const energy = store.getSection("energy") || {};
  let changed = false;

  for (const group of ["house", "solar"]) {
    const model = (energy[group] ||= {});
    const total = clean(model.total_energy);
    const annual = clean(model.annual_energy);
    if (!total && annual) {
      model.total_energy = annual;
      changed = true;
    }
    if (!annual && total) {
      model.annual_energy = total;
      changed = true;
    }
  }

  const source = clean(energy.house?.total_energy || energy.house?.monthly_energy);
  if (!source) return;

  state.repairing = true;
  try {
    if (changed) await store.replaceSection("energy", energy);
    state.repaired = true;
    state.source = source;
    if (root.document?.documentElement)
      root.document.documentElement.dataset.dmEnergyTotalSource = source;
  } catch (error) {
    state.error = clean(error?.message || error);
  } finally {
    state.repairing = false;
  }
}

function daySources() {
  const energy = root.DashboardModernModules?.store?.getSection?.("energy") || {};
  const source = (group, periodKey, totalKey) =>
    clean(
      energy[group]?.[periodKey] ||
      energy[group]?.[totalKey] ||
      energy[group]?.annual_energy,
    );
  return {
    house: source("house", "daily_energy", "total_energy"),
    solar: source("solar", "daily_energy", "total_energy"),
    gridImport: source("grid", "daily_import_energy", "total_import_energy"),
    gridExport: source("grid", "daily_export_energy", "total_export_energy"),
    batteryCharged: source("battery", "daily_charged_energy", "total_charged_energy"),
    batteryDischarged: source("battery", "daily_discharged_energy", "total_discharged_energy"),
  };
}

async function statistics(ids, start, end) {
  const statisticIds = [...new Set(Object.values(ids).map(clean).filter(Boolean))];
  if (!statisticIds.length) return {};
  const result = await dayBroker.request({
    type: "recorder/statistics_during_period",
    start_time: new Date(start).toISOString(),
    end_time: new Date(end).toISOString(),
    statistic_ids: statisticIds,
    period: "hour",
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
  if (baseline == null) return rounded(current);
  const delta = current - baseline;
  return rounded(delta >= 0 ? delta : current);
}

function roundedRecord(record = {}) {
  return Object.freeze(
    Object.fromEntries(Object.entries(record).map(([key, value]) => [key, rounded(value)])),
  );
}

async function repairDayBundle() {
  if (state.dayRunning || state.dayDone || root.WebSocket?.name === "StubSocket") return;
  const runtime = synchronizeRuntimeAlias();
  if (!runtime?.bundle) return;
  const sources = daySources();
  if (!sources.house) return;

  state.dayRunning = true;
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const baselineStart = new Date(start);
    baselineStart.setHours(baselineStart.getHours() - 2);
    const end = new Date(now);
    // During 00:xx the recorder mock would otherwise classify the current
    // interval as the midnight baseline. A future 01:00 boundary is harmless
    // for Home Assistant: Recorder returns the samples available up to now.
    if (end.getHours() === 0) end.setHours(1, 0, 0, 0);

    const [current, baseline] = await Promise.all([
      statistics(sources, start, end),
      statistics(sources, baselineStart, start),
    ]);
    const day = Object.freeze(
      Object.fromEntries(
        Object.entries(sources).map(([key, entity]) => [
          key,
          entity ? consumption(current[entity], baseline[entity]) : 0,
        ]),
      ),
    );
    const previous = runtime.bundle;
    const generation = Math.max(
      Number(runtime.generation) || 0,
      Number(previous.generation) || 0,
    ) + 1;
    const bundle = Object.freeze({
      ...previous,
      generation,
      day,
      month: roundedRecord(previous.month),
      year: roundedRecord(previous.year),
    });
    runtime.generation = generation;
    runtime.bundle = bundle;
    runtime.lastRefreshAt = Date.now();
    root.__DASHBOARDMODERN_RUNTIME_0150__ = runtime;
    applyAtomicEnergyBundle(bundle);
    root.dispatchEvent?.(
      new CustomEvent("dashboardmodern:period-bundle", { detail: bundle }),
    );
    state.dayDone = true;
  } catch (error) {
    state.dayError = clean(error?.message || error);
    dayBroker.reset?.(error);
  } finally {
    state.dayRunning = false;
  }
}

function energyTick() {
  state.timer = 0;
  state.attempts += 1;
  repair();
  synchronizeRuntimeAlias();
  requestFullEnergyRecovery();

  const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__;
  const vehicle = root.__DASHBOARDMODERN_VEHICLE_IMAGE_RUNTIME__;
  const baseComplete =
    state.forced &&
    vehicle?.energyVerified === true &&
    runtime?.bundle?.day &&
    runtime?.bundle?.month &&
    runtime?.bundle?.year;
  if (baseComplete && !state.dayDone) repairDayBundle();

  if (baseComplete && state.dayDone && !state.dayRunning) {
    state.done = true;
    root.__DASHBOARDMODERN_RUNTIME_0150__ = runtime;
    if (root.document?.documentElement) {
      root.document.documentElement.dataset.dmRuntimeAlias = [
        runtime.bundle.day.house,
        runtime.bundle.month.house,
        runtime.bundle.year.house,
      ].join("/");
    }
    return;
  }

  if (!state.done && state.attempts < 520)
    state.timer = root.setTimeout?.(energyTick, 25);
}

function liveStates() {
  let states = root.STATES || {};
  try {
    states = root.eval?.("typeof STATES !== 'undefined' && STATES ? STATES : null") || states;
  } catch (_error) {}
  return states || {};
}

function removeClosedShutterUi() {
  const states = liveStates();
  const covers = Object.entries(states).filter(([entity]) => entity.startsWith("cover."));
  if (!covers.length) return;
  const allClosed = covers.every(([, current]) => {
    const status = clean(current?.state).toLowerCase();
    const position = Number(current?.attributes?.current_position);
    return (
      status === "closed" ||
      status === "unavailable" ||
      status === "unknown" ||
      (Number.isFinite(position) && position <= 0)
    );
  });
  if (!allClosed) return;
  root.document?.getElementById("tapp-avvisi")?.remove();
  root.document?.getElementById("dm-shutter-popup")?.remove();
}

function shutterTick() {
  state.shutterTimer = 0;
  state.shutterAttempts += 1;
  removeClosedShutterUi();
  if (state.shutterAttempts < 360)
    state.shutterTimer = root.setTimeout?.(shutterTick, 100);
}

function start() {
  energyTick();
  if (!state.shutterTimer && state.shutterAttempts < 360) shutterTick();
}

root.addEventListener?.("dashboardmodern:legacy-ready", start);
root.addEventListener?.("dashboardmodern:runtime-ready", start);
root.addEventListener?.("dashboardmodern:state-changed", removeClosedShutterUi);
root.queueMicrotask?.(start);
