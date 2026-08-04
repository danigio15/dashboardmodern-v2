/* Restart the canonical startup once Energy config and the real HA bridge are ready. */
const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_ENERGY_READY_GUARD__";
const state = (root[KEY] ||= {
  installed: true,
  attempts: 0,
  restarts: 0,
  timer: 0,
  done: false,
  ids: new Set(),
});

const clean = (value) => String(value ?? "").trim();

function canonicalIds() {
  const store = root.DashboardModernModules?.store;
  if (!store?.getSection) return new Set();
  const energy = store.getSection("energy") || {};
  const values = [
    energy.house?.daily_energy,
    energy.house?.monthly_energy,
    energy.house?.annual_energy,
    energy.house?.total_energy,
    energy.solar?.daily_energy,
    energy.solar?.monthly_energy,
    energy.solar?.annual_energy,
    energy.solar?.total_energy,
    energy.grid?.daily_import_energy,
    energy.grid?.monthly_import_energy,
    energy.grid?.annual_import_energy,
    energy.grid?.total_import_energy,
    energy.grid?.daily_export_energy,
    energy.grid?.monthly_export_energy,
    energy.grid?.annual_export_energy,
    energy.grid?.total_export_energy,
    energy.battery?.daily_charged_energy,
    energy.battery?.monthly_charged_energy,
    energy.battery?.annual_charged_energy,
    energy.battery?.total_charged_energy,
    energy.battery?.daily_discharged_energy,
    energy.battery?.monthly_discharged_energy,
    energy.battery?.annual_discharged_energy,
    energy.battery?.total_discharged_energy,
  ];
  for (const section of ["appliances", "loads"]) {
    for (const item of store.getSection(section) || []) {
      values.push(
        item?.daily_energy_entity,
        item?.monthly_energy_entity,
        item?.annual_energy_entity,
        item?.total_energy_entity,
        item?.report_entity,
        item?.history_entity,
        item?.energy_entity,
      );
    }
  }
  return new Set(values.map(clean).filter((id) => id.includes(".")));
}

function installCanonicalResolver() {
  state.ids = canonicalIds();
  const current = root.resolveEntity;
  if (typeof current === "function" && current.__dmCanonicalEnergyResolver0152) {
    current.__dmCanonicalIds = state.ids;
    return;
  }
  function canonicalResolver(value) {
    const original = clean(value);
    if (canonicalResolver.__dmCanonicalIds?.has(original)) return original;
    try {
      return clean(current?.(original) || original);
    } catch (_error) {
      return original;
    }
  }
  canonicalResolver.__dmCanonicalEnergyResolver0152 = true;
  canonicalResolver.__dmCanonicalIds = state.ids;
  canonicalResolver.__dmPrevious = current;
  root.resolveEntity = canonicalResolver;
}

function expose(house, coordinator, owner) {
  if (!doc?.documentElement) return;
  doc.documentElement.dataset.dmEnergyGuard = [
    [...state.ids][0] || "none",
    root.WebSocket?.name || "none",
    coordinator?.running ? "coordinator-running" : "coordinator-idle",
    coordinator?.completed ? "completed" : "pending",
    owner?.energyRunning ? "recovery-running" : "recovery-idle",
    state.restarts,
    house,
    Array.isArray(root.__dmStatisticsRequests) ? root.__dmStatisticsRequests.length : -1,
  ].join("|");
}

function restartCanonicalStartup() {
  const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__;
  const coordinator = root.__DASHBOARDMODERN_STARTUP_COORDINATOR__;
  const owner = root.__DASHBOARDMODERN_VEHICLE_IMAGE_RUNTIME__;
  if (!runtime || !coordinator || !owner) return false;
  if (coordinator.running || owner.energyRunning) return false;
  if (root.WebSocket?.name === "StubSocket") return false;

  root.clearTimeout?.(owner.energyTimer);
  owner.energyTimer = 0;
  owner.energyVerified = true;
  coordinator.completed = false;
  runtime.bundle = null;
  runtime.lastRefreshAt = 0;
  state.restarts += 1;
  root.dispatchEvent?.(new CustomEvent("dashboardmodern:runtime-ready"));
  return true;
}

function tick() {
  state.timer = 0;
  state.attempts += 1;
  installCanonicalResolver();

  const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__;
  const coordinator = root.__DASHBOARDMODERN_STARTUP_COORDINATOR__;
  const owner = root.__DASHBOARDMODERN_VEHICLE_IMAGE_RUNTIME__;
  const house = Number(runtime?.bundle?.month?.house || 0);
  expose(house, coordinator, owner);

  if (state.ids.size && Number.isFinite(house) && house !== 0) {
    state.done = true;
    return;
  }

  if (
    state.ids.size &&
    state.attempts % 8 === 0 &&
    state.restarts < 6
  ) {
    restartCanonicalStartup();
  }

  if (!state.done && state.attempts < 360) {
    state.timer = root.setTimeout?.(tick, 25);
  }
}

root.addEventListener?.("dashboardmodern:legacy-ready", tick);
root.addEventListener?.("dashboardmodern:runtime-ready", tick);
root.queueMicrotask?.(tick);
