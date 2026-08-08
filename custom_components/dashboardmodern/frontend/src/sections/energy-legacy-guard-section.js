const root = globalThis;
const KEY = "__DASHBOARDMODERN_ENERGY_LEGACY_GUARD__";
const FRESH_BUNDLE_MS = 15000;

/**
 * Legacy DashboardModern still calls cdTotalsRun() once after Home Assistant
 * authentication. That compatibility hook resolves to
 * DashboardModernEnergyService.refresh(), but the canonical Energy section has
 * already loaded the same Recorder bundle by then. Suppress only that redundant
 * public refresh while the current bundle is fresh; canonical store/editor and
 * state-change refresh scheduling remains owned by energy-section.js.
 */
export function installEnergyLegacyGuardSection() {
  if (root[KEY]?.installed) return root[KEY];

  const current = root.DashboardModernEnergyService;
  if (!current?.refresh) return false;
  const originalRefresh = current.refresh;

  const guarded = Object.freeze({
    ...current,
    refresh(...args) {
      const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__;
      const lastRefreshAt = Number(runtime?.lastRefreshAt) || 0;
      const fresh =
        Boolean(runtime?.bundle) &&
        lastRefreshAt > 0 &&
        Date.now() - lastRefreshAt < FRESH_BUNDLE_MS;
      if (fresh) return false;
      return originalRefresh(...args);
    },
  });

  // DashboardModernEnergyService is an accessor while state-event-gate is
  // armed. Reassignment is intentional: the broker object is unchanged and
  // the gate remains installed, while future legacy lookups receive the guard.
  root.DashboardModernEnergyService = guarded;
  root[KEY] = Object.freeze({ installed: true, freshBundleMs: FRESH_BUNDLE_MS });
  return root[KEY];
}

installEnergyLegacyGuardSection();
