/* Preserve the cumulative total source required for day/month recorder history. */
const root = globalThis;
const KEY = "__DASHBOARDMODERN_ENERGY_TOTAL_SOURCE__";
const state = (root[KEY] ||= {
  installed: true,
  attempts: 0,
  timer: 0,
  repairing: false,
  done: false,
});

const clean = (value) => String(value ?? "").trim();

function kickEnergyRuntime() {
  const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__;
  if (runtime && Number(runtime.bundle?.month?.house || 0) === 0) {
    runtime.bundle = null;
    runtime.lastRefreshAt = 0;
  }
  const coordinator = root.__DASHBOARDMODERN_STARTUP_COORDINATOR__;
  if (coordinator && !coordinator.running) coordinator.completed = false;
  const vehicle = root.__DASHBOARDMODERN_VEHICLE_IMAGE_RUNTIME__;
  if (vehicle) {
    vehicle.energyVerified = false;
    vehicle.scheduleContracts?.(0);
    vehicle.verifyEnergy?.();
  }
  root.dispatchEvent?.(
    new CustomEvent("dashboardmodern:energy-total-source-ready"),
  );
}

async function repair() {
  if (state.repairing || state.done) return;
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
    state.done = true;
    state.source = source;
    if (root.document?.documentElement)
      root.document.documentElement.dataset.dmEnergyTotalSource = source;
    kickEnergyRuntime();
  } catch (error) {
    state.error = clean(error?.message || error);
  } finally {
    state.repairing = false;
  }
}

function tick() {
  state.timer = 0;
  state.attempts += 1;
  repair();
  if (!state.done && state.attempts < 320)
    state.timer = root.setTimeout?.(tick, 25);
}

root.addEventListener?.("dashboardmodern:legacy-ready", tick);
root.addEventListener?.("dashboardmodern:runtime-ready", tick);
root.queueMicrotask?.(tick);
