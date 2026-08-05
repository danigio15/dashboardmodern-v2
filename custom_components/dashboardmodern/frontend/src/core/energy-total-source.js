/* Preserve cumulative totals, canonical aliases and final live-state cleanup. */
const root = globalThis;
const KEY = "__DASHBOARDMODERN_ENERGY_TOTAL_SOURCE__";
const state = (root[KEY] ||= {
  installed: true,
  attempts: 0,
  timer: 0,
  repairing: false,
  repaired: false,
  forced: false,
  done: false,
  shutterAttempts: 0,
  shutterTimer: 0,
});

const clean = (value) => String(value ?? "").trim();

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

function energyTick() {
  state.timer = 0;
  state.attempts += 1;
  repair();
  synchronizeRuntimeAlias();
  requestFullEnergyRecovery();

  const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__;
  const vehicle = root.__DASHBOARDMODERN_VEHICLE_IMAGE_RUNTIME__;
  const complete =
    state.forced &&
    vehicle?.energyVerified === true &&
    runtime?.bundle?.day &&
    runtime?.bundle?.month &&
    runtime?.bundle?.year;
  if (complete) {
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

  if (!state.done && state.attempts < 480)
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
