/* DashboardModern 0.15.4 — readiness gate for the single canonical Energy owner. */
import { applyAtomicEnergyBundle } from "../../legacy/runtime-consolidated.js";

const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_ENERGY_TOTAL_SOURCE__";
const state = (root[KEY] ||= {});
Object.assign(state, {
  installed: true,
  version: "0.15.4",
  attempts: 0,
  timer: 0,
  done: false,
  readyGateInstalled: false,
  appliedGeneration: 0,
  error: "",
});

const clean = (value) => String(value ?? "").trim();

function energyModel() {
  return root.DashboardModernModules?.store?.getSection?.("energy") || {};
}

function configuredSource() {
  const energy = energyModel();
  return clean(
    energy.house?.daily_energy ||
      energy.house?.monthly_energy ||
      energy.house?.annual_energy ||
      energy.house?.total_energy,
  );
}

function runtimeRoot() {
  const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__ || null;
  if (runtime) root.__DASHBOARDMODERN_RUNTIME_0150__ = runtime;
  return runtime;
}

function installReadyGate() {
  const runtime = runtimeRoot();
  if (!runtime || runtime.__dmEnergyReadyGate0154 || !configuredSource()) return false;
  let ownerReady = Boolean(runtime.ready);
  try {
    Object.defineProperty(runtime, "ready", {
      configurable: true,
      enumerable: true,
      get() {
        return state.done === true && ownerReady === true;
      },
      set(value) {
        ownerReady = Boolean(value);
      },
    });
    Object.defineProperty(runtime, "__dmEnergyReadyGate0154", {
      configurable: true,
      value: true,
    });
    state.readyGateInstalled = true;
    return true;
  } catch (error) {
    state.error = clean(error?.message || error);
    return false;
  }
}

function complete(runtime) {
  const bundle = runtime?.bundle;
  if (!bundle?.day || !bundle?.month || !bundle?.year) return false;
  const generation = Number(bundle.generation) || Number(runtime.generation) || 0;
  if (generation && generation !== state.appliedGeneration) {
    applyAtomicEnergyBundle(bundle);
    state.appliedGeneration = generation;
  }
  state.done = true;
  runtime.ready = true;
  root.__DASHBOARDMODERN_RUNTIME_0150__ = runtime;
  if (doc?.documentElement) {
    doc.documentElement.dataset.dmEnergyTotalSource = configuredSource();
    doc.documentElement.dataset.dmRuntimeAlias = [
      bundle.day?.house,
      bundle.month?.house,
      bundle.year?.house,
    ].join("/");
  }
  return true;
}

function releaseWithoutEnergy(runtime) {
  state.done = true;
  if (runtime) runtime.ready = true;
  root.__DASHBOARDMODERN_RUNTIME_0150__ = runtime;
}

function tick() {
  state.timer = 0;
  if (state.done) return;
  state.attempts += 1;
  const runtime = runtimeRoot();
  installReadyGate();

  if (!configuredSource()) {
    releaseWithoutEnergy(runtime);
    return;
  }
  if (complete(runtime)) return;

  if (state.attempts >= 720) {
    state.error ||= "Canonical Energy bundle timeout";
    releaseWithoutEnergy(runtime);
    return;
  }
  state.timer = root.setTimeout?.(tick, 25);
}

function schedule() {
  if (!state.done && !state.timer) state.timer = root.setTimeout?.(tick, 0);
}

installReadyGate();
root.addEventListener?.("dashboardmodern:legacy-ready", schedule);
root.addEventListener?.("dashboardmodern:runtime-ready", schedule);
root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
  const runtime = runtimeRoot();
  if (runtime && event?.detail) runtime.bundle = event.detail;
  schedule();
});
root.addEventListener?.("pageshow", schedule);
root.queueMicrotask?.(schedule);
