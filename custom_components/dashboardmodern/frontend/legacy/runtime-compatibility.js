/* DashboardModern 0.15.0 — stateless compatibility API, no runtime owner. */

const api = globalThis.DashboardModernRuntime0150;
const states = new Map();
const CURRENT_MONTH_SLOTS = [
  "dm.energy_consumo_casa_mese",
  "dm.energy_produzione_solare_mese",
  "dm.energy_rete_acquistata_mese",
  "dm.energy_rete_venduta_mese",
  "dm.energy_batteria_caricata_mese",
  "dm.energy_batteria_usata_mese",
];

function historicalSelection() {
  const now = new Date();
  const month = Number(document.getElementById("ed-sel-month")?.value);
  const year = Number(document.getElementById("ed-sel-year")?.value);
  if (!Number.isInteger(month) || !Number.isInteger(year)) return false;
  return month !== now.getMonth() + 1 || year !== now.getFullYear();
}

function installCurrentMonthRegistryGuard() {
  const registry = (globalThis.CD_PERIOD ||= {});
  CURRENT_MONTH_SLOTS.forEach((slot) => {
    const descriptor = Object.getOwnPropertyDescriptor(registry, slot);
    if (descriptor?.get?.__dm0150CurrentMonth) return;
    let value = Number(registry[slot]);
    function getCurrentMonth0150() {
      return value;
    }
    getCurrentMonth0150.__dm0150CurrentMonth = true;
    Object.defineProperty(registry, slot, {
      configurable: true,
      enumerable: true,
      get: getCurrentMonth0150,
      set(next) {
        if (historicalSelection()) return;
        const parsed = Number(next);
        if (Number.isFinite(parsed)) value = parsed;
      },
    });
  });
}

function installDerivedStateGuard() {
  const broker = api?.broker;
  const original = broker?.ingestState;
  if (typeof original !== "function" || original.__dm0150CurrentMonth) return;
  function ingestStateCurrentMonth0150(state) {
    const attributes = state?.attributes || {};
    const isHistoricalMonthly =
      attributes.dashboardmodern_derived === true &&
      attributes.dashboardmodern_period === "month" &&
      historicalSelection();
    if (isHistoricalMonthly) return true;
    return original.call(this, state);
  }
  ingestStateCurrentMonth0150.__dm0150CurrentMonth = true;
  ingestStateCurrentMonth0150.__dmPrevious = original;
  broker.ingestState = ingestStateCurrentMonth0150;
}

function ingestState(state) {
  const id = String(state?.entity_id || "").trim();
  if (!id) return false;
  const copy = { ...state, attributes: { ...(state.attributes || {}) } };
  states.set(id, copy);
  api?.broker?.ingestState?.(copy);
  return true;
}

function ingestStates(list) {
  (Array.isArray(list) ? list : []).forEach(ingestState);
  return states.size;
}

function syncTemperature() {
  try {
    globalThis.buildTempCards?.();
    globalThis.renderTemperature?.();
    return true;
  } catch (_error) {
    return false;
  }
}

function syncAppliances() {
  try {
    globalThis.renderApplianceSection?.(true);
    return true;
  } catch (_error) {
    return false;
  }
}

installCurrentMonthRegistryGuard();
installDerivedStateGuard();

const shared = {
  installed: true,
  ready: true,
  version: "0.15.0",
  states,
  sampleTimer: 0,
  ingestState,
  ingestStates,
  syncTemperature,
  syncAppliances,
  broker: api?.broker,
  statistics: api?.broker?.statistics?.bind(api.broker),
  monthValues(ids, month, year) {
    return api?.broker?.valuesForEntities?.(ids, "month", new Date(year, month - 1, 1));
  },
  yearValues(ids, year) {
    return api?.broker?.valuesForEntities?.(ids, "year", new Date(year, 0, 1));
  },
  refreshCurrent() {
    return api?.refreshEnergyStatistics0152?.(new Date());
  },
  refreshOverview() {
    return api?.refreshSelectedPeriod?.();
  },
};

for (const key of [
  "__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__",
  "__DASHBOARDMODERN_RELEASE_0156_PERIOD_RUNTIME__",
  "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__",
]) {
  globalThis[key] = { ...(globalThis[key] || {}), ...shared };
}

globalThis.__DASHBOARDMODERN_RUNTIME_COMPATIBILITY_0150__ = shared;
