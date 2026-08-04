/* Bounded recovery guard for Energy bundles created before canonical hydration. */
const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_ENERGY_READY_GUARD__";
const state = (root[KEY] ||= {
  installed: true,
  attempts: 0,
  rearms: 0,
  timer: 0,
  done: false,
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

function expose(source, owner, house) {
  if (!doc?.documentElement) return;
  const requests = Array.isArray(root.__dmStatisticsRequests)
    ? root.__dmStatisticsRequests.length
    : -1;
  doc.documentElement.dataset.dmEnergyGuard = [
    source || "none",
    root.WebSocket?.name || "none",
    owner?.energyRunning ? "running" : "idle",
    owner?.energyVerified ? "verified" : "pending",
    state.rearms,
    house,
    requests,
  ].join("|");
}

function tick() {
  state.timer = 0;
  state.attempts += 1;
  const source = canonicalEnergySource();
  const owner = root.__DASHBOARDMODERN_VEHICLE_IMAGE_RUNTIME__;
  const house = Number(root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle?.month?.house || 0);

  expose(source, owner, house);
  if (source && Number.isFinite(house) && house !== 0) {
    state.done = true;
    return;
  }

  const cadenceReached = state.attempts % 10 === 0;
  if (
    source &&
    owner &&
    !owner.energyRunning &&
    cadenceReached &&
    state.rearms < 16
  ) {
    state.rearms += 1;
    state.source = source;
    owner.energyVerified = false;
    owner.scheduleContracts?.(0);
    root.dispatchEvent?.(
      new CustomEvent("dashboardmodern:energy-source-ready", {
        detail: { source, attempt: state.rearms },
      }),
    );
  }

  if (!state.done && state.attempts < 360) {
    state.timer = root.setTimeout?.(tick, 25);
  }
}

root.addEventListener?.("dashboardmodern:legacy-ready", tick);
root.addEventListener?.("dashboardmodern:runtime-ready", tick);
root.queueMicrotask?.(tick);
