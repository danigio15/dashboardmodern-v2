/* DashboardModern 0.15.0 — stateless compatibility facade. */
(function installRuntimeCompatibility0150(root) {
  "use strict";

  const VERSION = "0.15.0";
  const states = new Map();
  const KEYS = [
    "__DASHBOARDMODERN_RELEASE_0152__",
    "__DASHBOARDMODERN_RELEASE_0153_REPORT_RUNTIME__",
    "__DASHBOARDMODERN_RELEASE_0154__",
    "__DASHBOARDMODERN_RELEASE_0154_REAL_CONFIG__",
    "__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__",
    "__DASHBOARDMODERN_RELEASE_0156_PERIOD_RUNTIME__",
    "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__",
    "__DASHBOARDMODERN_RELEASE_0157_UI_STABILITY__",
    "__DASHBOARDMODERN_RELEASE_0157_FINAL__",
  ];

  const api = () => root.DashboardModernRuntime0150 || null;

  function ingestState(state) {
    const id = String(state?.entity_id || "").trim();
    if (!id) return false;
    const copy = { ...state, attributes: { ...(state.attributes || {}) } };
    states.set(id, copy);
    api()?.broker?.ingestState?.(copy);
    return true;
  }

  function ingestStates(list) {
    (Array.isArray(list) ? list : []).forEach(ingestState);
    return states.size;
  }

  function syncTemperature() {
    try {
      root.buildTempCards?.();
      root.renderTemperature?.();
      return true;
    } catch (_error) {
      return false;
    }
  }

  function syncAppliances() {
    try {
      root.renderApplianceSection?.(true);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function values(ids, kind, date) {
    return api()?.broker?.valuesForEntities?.(ids, kind, date) || Promise.resolve(new Map());
  }

  const shared = {
    installed: true,
    ready: true,
    version: VERSION,
    states,
    sampleTimer: 0,
    ingestState,
    ingestStates,
    syncTemperature,
    syncAppliances,
    monthValues(ids, month, year) {
      return values(ids, "month", new Date(year, month - 1, 1));
    },
    yearValues(ids, year) {
      return values(ids, "year", new Date(year, 0, 1));
    },
    refreshCurrent() {
      return api()?.refreshEnergyStatistics0152?.(new Date()) || Promise.resolve(false);
    },
    refreshOverview() {
      return api()?.refreshSelectedPeriod?.() || Promise.resolve(false);
    },
  };
  shared.refreshEnergyStatistics0152 = shared.refreshCurrent;
  shared.refreshEnergyPeriods0154 = shared.refreshCurrent;

  function publish() {
    shared.broker = api()?.broker;
    shared.statistics = shared.broker?.statistics?.bind(shared.broker);
    shared.applyOptionalFlowVisibility = api()?.applyOptionalFlowVisibility;
    KEYS.forEach((key) => {
      root[key] = { ...(root[key] || {}), ...shared };
    });
    root.__DASHBOARDMODERN_RUNTIME_COMPATIBILITY_0150__ = shared;
  }

  publish();
  root.addEventListener?.("dashboardmodern:runtime-ready", publish);
  root.addEventListener?.("pageshow", publish);
})(globalThis);
