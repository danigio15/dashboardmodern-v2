/* DashboardModern 0.14.14: restore listeners and prevent render/refresh feedback loops. */
const PRELUDE_KEY = "__DASHBOARDMODERN_RELEASE_0154_PRELUDE__";
const RELEASE_KEY = "__DASHBOARDMODERN_RELEASE_0154__";
const GUARD_KEY = "__DASHBOARDMODERN_RELEASE_0154_STABILITY__";

function restoreEventRegistration0154() {
  const prelude = globalThis[PRELUDE_KEY];
  if (!prelude?.original || prelude.restored) return;
  globalThis.addEventListener = prelude.original;
  prelude.restored = true;
}

function stabilityState0154() {
  return (globalThis[GUARD_KEY] ||= {
    renderDepth: 0,
    cooldownUntil: 0,
    installed: false,
    stableRefreshes: {},
  });
}

function now0154() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function installRenderGuard0154(name) {
  const state = stabilityState0154();
  const original = globalThis[name];
  if (typeof original !== "function" || original.__dm0154RenderGuard) return false;

  function guardedRender0154(...args) {
    state.renderDepth += 1;
    state.cooldownUntil = Math.max(state.cooldownUntil, now0154() + 1400);
    let result;
    try {
      result = original.apply(this, args);
    } catch (error) {
      state.renderDepth = Math.max(0, state.renderDepth - 1);
      state.cooldownUntil = Math.max(state.cooldownUntil, now0154() + 1400);
      throw error;
    }
    if (result && typeof result.finally === "function") {
      return result.finally(() => {
        state.renderDepth = Math.max(0, state.renderDepth - 1);
        state.cooldownUntil = Math.max(state.cooldownUntil, now0154() + 1400);
      });
    }
    state.renderDepth = Math.max(0, state.renderDepth - 1);
    state.cooldownUntil = Math.max(state.cooldownUntil, now0154() + 1400);
    return result;
  }

  guardedRender0154.__dm0154RenderGuard = true;
  guardedRender0154.__dmPrevious = original;
  globalThis[name] = guardedRender0154;
  return true;
}

function installStableRefresh0154(name) {
  const state = stabilityState0154();
  const target = globalThis[name];
  if (typeof target !== "function") return false;

  if (target.__dm0154RefreshGuard) {
    state.stableRefreshes[name] = target;
    return true;
  }

  function guardedRefresh0154(...args) {
    const release = globalThis[RELEASE_KEY];
    if (state.renderDepth > 0 || release?.refreshing || now0154() < state.cooldownUntil) {
      return false;
    }
    state.cooldownUntil = now0154() + 450;
    const result = target.apply(this, args);
    if (result && typeof result.finally === "function") {
      return result.finally(() => {
        state.cooldownUntil = Math.max(state.cooldownUntil, now0154() + 1400);
      });
    }
    state.cooldownUntil = Math.max(state.cooldownUntil, now0154() + 1400);
    return result;
  }

  guardedRefresh0154.__dm0154RefreshGuard = true;
  guardedRefresh0154.__dmPrevious = target;

  try {
    // Legacy global function declarations are writable but non-configurable.
    // A normal assignment is therefore compatible; Object.defineProperty is not.
    globalThis[name] = guardedRefresh0154;
  } catch (_error) {
    return false;
  }

  if (globalThis[name] !== guardedRefresh0154) return false;
  state.stableRefreshes[name] = guardedRefresh0154;
  return true;
}

function installStability0154() {
  restoreEventRegistration0154();
  ["render", "renderEnergy", "renderEnergyDashboard", "renderReport"].forEach(
    installRenderGuard0154,
  );
  installStableRefresh0154("cdRefreshPeriodDeltas");
  installStableRefresh0154("cdDeriveFromTotals");
  stabilityState0154().installed = true;
}

restoreEventRegistration0154();
installStability0154();
globalThis.queueMicrotask?.(installStability0154);
globalThis.setTimeout?.(installStability0154, 0);
globalThis.setTimeout?.(installStability0154, 180);
globalThis.addEventListener?.("dashboardmodern:legacy-ready", installStability0154);

const retry0154 = globalThis.setInterval?.(installStability0154, 100);
globalThis.setTimeout?.(() => globalThis.clearInterval?.(retry0154), 15000);
// The corrective runtime also retries for 15 seconds. Re-apply once after it stops
// so the guarded entry points are deterministically the final assignments.
globalThis.setTimeout?.(installStability0154, 15150);
globalThis.setTimeout?.(installStability0154, 15500);
