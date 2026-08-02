/* DashboardModern 0.14.16: bounded current-period hydration after the canonical store becomes ready. */
const FINAL_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__";
const BOOT_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0156_CURRENT_BOOTSTRAP__";
const CURRENT_SLOTS_0156 = Object.freeze([
  "dm.energy_consumo_casa_mese",
  "dm.energy_produzione_solare_mese",
  "dm.energy_rete_acquistata_mese",
  "dm.energy_rete_venduta_mese",
  "dm.energy_batteria_caricata_mese",
  "dm.energy_batteria_usata_mese",
]);

function registry0156() {
  try {
    if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
  } catch (_error) {}
  return (globalThis.CD_PERIOD ||= {});
}

function configuredEnergy0156() {
  try {
    const energy = globalThis.DashboardModernModules?.store?.getSection?.("energy");
    if (!energy || typeof energy !== "object") return false;
    return [energy.house, energy.solar, energy.grid, energy.battery].some(
      (group) => group && Object.values(group).some((value) => String(value || "").trim()),
    );
  } catch (_error) {
    return false;
  }
}

function currentValuesReady0156() {
  if (!configuredEnergy0156()) return false;
  const values = registry0156();
  return CURRENT_SLOTS_0156.some((slot) => Number.isFinite(Number(values[slot])));
}

function state0156() {
  return (globalThis[BOOT_KEY_0156] ||= {
    installed: true,
    timer: 0,
    attempts: 0,
    running: false,
  });
}

async function hydrateCurrentPeriod0156() {
  const state = state0156();
  if (state.running) return false;
  const runtime = globalThis[FINAL_KEY_0156];
  if (typeof runtime?.refreshCurrent !== "function") return false;
  state.running = true;
  try {
    await runtime.refreshCurrent();
    return currentValuesReady0156();
  } catch (error) {
    console.warn("[DashboardModern] current monthly period bootstrap", error);
    return false;
  } finally {
    state.running = false;
  }
}

function scheduleHydration0156(delay = 0) {
  const state = state0156();
  globalThis.clearTimeout?.(state.timer);
  state.timer = globalThis.setTimeout?.(async () => {
    state.attempts += 1;
    const ready = await hydrateCurrentPeriod0156();
    if (!ready && state.attempts < 60) scheduleHydration0156(100);
    else state.timer = 0;
  }, delay);
}

function install0156() {
  const state = state0156();
  state.attempts = 0;
  scheduleHydration0156(0);
}

if (typeof globalThis.document !== "undefined") {
  install0156();
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", install0156);
  globalThis.addEventListener?.("pageshow", install0156);
}
