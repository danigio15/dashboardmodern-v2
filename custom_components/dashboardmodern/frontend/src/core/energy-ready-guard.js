/* Re-arm the canonical Energy recovery after an early empty bundle was accepted. */
const root = globalThis;
const KEY = "__DASHBOARDMODERN_ENERGY_READY_GUARD__";
const state = (root[KEY] ||= {
  installed: true,
  attempts: 0,
  timer: 0,
  rearmed: false,
});

const clean = (value) => String(value ?? "").trim();

function canonicalEnergySource() {
  const store = root.DashboardModernModules?.store;
  if (!store?.getSection) return "";
  const energy = store.getSection("energy") || {};
  return clean(
    energy.house?.monthly_energy ||
      energy.house?.total_energy ||
      energy.solar?.monthly_energy ||
      energy.solar?.total_energy ||
      energy.grid?.monthly_import_energy ||
      energy.grid?.total_import_energy,
  );
}

function tick() {
  state.timer = 0;
  state.attempts += 1;
  const source = canonicalEnergySource();
  const owner = root.__DASHBOARDMODERN_VEHICLE_IMAGE_RUNTIME__;
  const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__;
  const acceptedEmptyBundle =
    owner?.energyVerified === true &&
    Number(runtime?.bundle?.month?.house || 0) === 0;

  if (source && owner && !owner.energyRunning && acceptedEmptyBundle && !state.rearmed) {
    state.rearmed = true;
    state.source = source;
    owner.energyVerified = false;
    owner.scheduleContracts?.(0);
    root.dispatchEvent?.(
      new CustomEvent("dashboardmodern:energy-source-ready", { detail: { source } }),
    );
  }

  if (!state.rearmed && state.attempts < 320) {
    state.timer = root.setTimeout?.(tick, 25);
  }
}

root.addEventListener?.("dashboardmodern:legacy-ready", tick);
root.addEventListener?.("dashboardmodern:runtime-ready", tick);
root.queueMicrotask?.(tick);
