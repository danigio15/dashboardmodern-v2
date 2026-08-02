/* DashboardModern 0.14.16: protect the final period owner from late legacy writes. */
const FINAL_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__";
const OWNER_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0156_OWNER_GUARD__";
const CURRENT_SLOTS_0156 = Object.freeze([
  "dm.energy_consumo_casa_mese",
  "dm.energy_produzione_solare_mese",
  "dm.energy_rete_acquistata_mese",
  "dm.energy_rete_venduta_mese",
  "dm.energy_batteria_caricata_mese",
  "dm.energy_batteria_usata_mese",
]);

function ownerState0156() {
  return (globalThis[OWNER_KEY_0156] ||= {
    installed: true,
    timer: 0,
    overviewTimer: 0,
    refreshingCurrent: false,
    refreshingOverview: false,
  });
}

function registry0156() {
  try {
    if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
  } catch (_error) {}
  return (globalThis.CD_PERIOD ||= {});
}

function rawState0156(slot) {
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES?.[slot]) return _RAW_STATES[slot];
  } catch (_error) {}
  return globalThis._RAW_STATES?.[slot] || globalThis.STATES?.[slot] || null;
}

function restoreCurrentSlots0156() {
  const values = registry0156();
  let restored = false;
  CURRENT_SLOTS_0156.forEach((slot) => {
    const state = rawState0156(slot);
    if (!state?.attributes?.dashboardmodern_derived || !state?.attributes?.dashboardmodern_source) return;
    const value = Number(state.state);
    if (!Number.isFinite(value)) return;
    if (Number(values[slot]) !== value) values[slot] = value;
    restored = true;
  });
  return restored;
}

async function refreshCurrent0156() {
  const state = ownerState0156();
  const runtime = globalThis[FINAL_KEY_0156];
  if (state.refreshingCurrent || typeof runtime?.refreshCurrent !== "function") {
    return restoreCurrentSlots0156();
  }
  state.refreshingCurrent = true;
  try {
    await runtime.refreshCurrent();
    return restoreCurrentSlots0156();
  } catch (error) {
    console.warn("[DashboardModern] final current-period owner", error);
    return false;
  } finally {
    state.refreshingCurrent = false;
  }
}

async function refreshOverview0156() {
  const state = ownerState0156();
  const runtime = globalThis[FINAL_KEY_0156];
  if (state.refreshingOverview || typeof runtime?.refreshOverview !== "function") return false;
  state.refreshingOverview = true;
  try {
    return await runtime.refreshOverview();
  } catch (error) {
    console.warn("[DashboardModern] final Report-period owner", error);
    return false;
  } finally {
    state.refreshingOverview = false;
  }
}

function scheduleOverview0156(delay = 0) {
  const state = ownerState0156();
  globalThis.clearTimeout?.(state.overviewTimer);
  state.overviewTimer = globalThis.setTimeout?.(() => refreshOverview0156(), delay);
}

function wrapLateWriter0156(name) {
  const current = globalThis[name];
  if (typeof current !== "function" || current.__dm0156OwnerGuard) return false;

  function guardedLateWriter0156(...args) {
    const result = current.apply(this, args);
    const finish = () => {
      if (!restoreCurrentSlots0156()) refreshCurrent0156();
    };
    if (result && typeof result.finally === "function") return result.finally(finish);
    finish();
    return result;
  }

  guardedLateWriter0156.__dm0156OwnerGuard = true;
  guardedLateWriter0156.__dmPrevious = current;
  globalThis[name] = guardedLateWriter0156;
  return true;
}

function wrapReportRenderer0156() {
  const current = globalThis.renderEnergyDashboard;
  if (typeof current !== "function" || current.__dm0156OwnerGuard) return false;

  function guardedReportRenderer0156(...args) {
    const result = current.apply(this, args);
    const finish = () => {
      restoreCurrentSlots0156();
      scheduleOverview0156(0);
    };
    if (result && typeof result.finally === "function") return result.finally(finish);
    globalThis.queueMicrotask?.(finish);
    return result;
  }

  guardedReportRenderer0156.__dm0156OwnerGuard = true;
  guardedReportRenderer0156.__dmPrevious = current;
  globalThis.renderEnergyDashboard = guardedReportRenderer0156;
  return true;
}

function installWrappers0156() {
  const derive = wrapLateWriter0156("cdDeriveFromTotals");
  const deltas = wrapLateWriter0156("cdRefreshPeriodDeltas");
  const report = wrapReportRenderer0156();
  return Boolean(
    derive ||
    deltas ||
    report ||
    globalThis.cdDeriveFromTotals?.__dm0156OwnerGuard ||
    globalThis.cdRefreshPeriodDeltas?.__dm0156OwnerGuard ||
    globalThis.renderEnergyDashboard?.__dm0156OwnerGuard
  );
}

function reinforce0156() {
  installWrappers0156();
  refreshCurrent0156();
  scheduleOverview0156(0);
}

function install0156() {
  const state = ownerState0156();
  reinforce0156();
  if (!state.eventsInstalled) {
    state.eventsInstalled = true;
    globalThis.document?.addEventListener?.(
      "change",
      (event) => {
        if (!event.target?.matches?.("#ed-sel-month, #ed-sel-year")) return;
        scheduleOverview0156(20);
        globalThis.setTimeout?.(() => scheduleOverview0156(0), 180);
        globalThis.setTimeout?.(() => scheduleOverview0156(0), 650);
      },
      true,
    );
    globalThis.addEventListener?.("dashboardmodern:legacy-ready", reinforce0156);
    globalThis.addEventListener?.("pageshow", reinforce0156);
  }

  globalThis.clearInterval?.(state.timer);
  let attempts = 0;
  state.timer = globalThis.setInterval?.(() => {
    attempts += 1;
    installWrappers0156();
    restoreCurrentSlots0156();
    if (
      attempts >= 80 ||
      (globalThis.cdDeriveFromTotals?.__dm0156OwnerGuard &&
        globalThis.cdRefreshPeriodDeltas?.__dm0156OwnerGuard &&
        globalThis.renderEnergyDashboard?.__dm0156OwnerGuard)
    ) {
      globalThis.clearInterval?.(state.timer);
      state.timer = 0;
    }
  }, 100);
}

if (typeof globalThis.document !== "undefined") install0156();
