import assert from "node:assert/strict";
import test from "node:test";

test("fresh canonical Energy bundle suppresses the delayed legacy totals refresh", async () => {
  const previousService = globalThis.DashboardModernEnergyService;
  const previousRuntime = globalThis.__DASHBOARDMODERN_RUNTIME_ROOT__;
  const previousGuard = globalThis.__DASHBOARDMODERN_ENERGY_LEGACY_GUARD__;
  let refreshes = 0;

  globalThis.DashboardModernEnergyService = Object.freeze({
    broker: {},
    refresh() {
      refreshes += 1;
      return true;
    },
  });
  globalThis.__DASHBOARDMODERN_RUNTIME_ROOT__ = {
    bundle: { month: { house: 12 } },
    lastRefreshAt: Date.now(),
  };
  delete globalThis.__DASHBOARDMODERN_ENERGY_LEGACY_GUARD__;

  try {
    await import(`../src/sections/energy-legacy-guard-section.js?fresh=${Date.now()}`);
    assert.equal(globalThis.DashboardModernEnergyService.refresh(), false);
    assert.equal(refreshes, 0);

    globalThis.__DASHBOARDMODERN_RUNTIME_ROOT__.lastRefreshAt = Date.now() - 16000;
    assert.equal(globalThis.DashboardModernEnergyService.refresh(), true);
    assert.equal(refreshes, 1, "a genuinely stale bundle may still be refreshed");
  } finally {
    if (previousService === undefined) delete globalThis.DashboardModernEnergyService;
    else globalThis.DashboardModernEnergyService = previousService;
    if (previousRuntime === undefined) delete globalThis.__DASHBOARDMODERN_RUNTIME_ROOT__;
    else globalThis.__DASHBOARDMODERN_RUNTIME_ROOT__ = previousRuntime;
    if (previousGuard === undefined) delete globalThis.__DASHBOARDMODERN_ENERGY_LEGACY_GUARD__;
    else globalThis.__DASHBOARDMODERN_ENERGY_LEGACY_GUARD__ = previousGuard;
  }
});
