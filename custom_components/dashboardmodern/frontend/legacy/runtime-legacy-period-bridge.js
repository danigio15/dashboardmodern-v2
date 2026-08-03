/* DashboardModern 0.15.0 — classic-script bridge to the vendored CD_PERIOD binding. */
(function installLegacyPeriodBridge0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__";
  if (root[KEY]?.installed) return;

  function registry() {
    try {
      if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
    } catch (_error) {}
    return (root.CD_PERIOD ||= {});
  }

  const api = {
    installed: true,
    version: "0.15.0",
    get(slot) {
      return registry()[slot];
    },
    set(slot, raw) {
      const value = Number(raw);
      if (!slot || !Number.isFinite(value)) return false;
      registry()[slot] = Math.max(0, value);
      return true;
    },
    merge(values) {
      Object.entries(values || {}).forEach(([slot, value]) => api.set(slot, value));
      return registry();
    },
  };

  root[KEY] = api;
  api.merge(root.__DASHBOARDMODERN_LEGACY_PERIOD_PENDING__ || {});
  root.__DASHBOARDMODERN_LEGACY_PERIOD_PENDING__ = {};
  root.dispatchEvent?.(new CustomEvent("dashboardmodern:legacy-period-bridge-ready"));
})(globalThis);
