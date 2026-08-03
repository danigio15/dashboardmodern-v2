/* DashboardModern 0.15.0 — stateless compatibility API, no runtime owner. */

const api = globalThis.DashboardModernRuntime0150;
const states = new Map();

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
