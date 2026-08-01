/* DashboardModern 0.14.14: restore listeners and prevent render/refresh feedback loops. */
const PRELUDE_KEY = "__DASHBOARDMODERN_RELEASE_0154_PRELUDE__";
const RELEASE_KEY = "__DASHBOARDMODERN_RELEASE_0154__";
const GUARD_KEY = "__DASHBOARDMODERN_RELEASE_0154_STABILITY__";

function restoreEventRegistration0154() {
  const prelude = globalThis[PRELUDE_KEY];
  if (!prelude?.original) return;
  globalThis.addEventListener = prelude.original;
  prelude.restored = true;
}

function stabilityState0154() {
  return (globalThis[GUARD_KEY] ||= {
    renderDepth: 0,
    cooldownUntil: 0,
    installed: false,
  });
}

function now0154() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function installRenderGuard0154() {
  const state = stabilityState0154();
  const original = globalThis.render;
  if (typeof original !== "function" || original.__dm0154RenderGuard) return false;

  function guardedRender0154(...args) {
    state.renderDepth += 1;
    state.cooldownUntil = Math.max(state.cooldownUntil, now0154() + 1200);
    try {
      return original.apply(this, args);
    } finally {
      state.renderDepth = Math.max(0, state.renderDepth - 1);
      state.cooldownUntil = Math.max(state.cooldownUntil, now0154() + 1200);
    }
  }

  guardedRender0154.__dm0154RenderGuard = true;
  guardedRender0154.__dmPrevious = original;
  globalThis.render = guardedRender0154;
  return true;
}

function installRefreshGuard0154(name) {
  const state = stabilityState0154();
  const original = globalThis[name];
  if (typeof original !== "function" || original.__dm0154RefreshGuard) return false;

  function guardedRefresh0154(...args) {
    const release = globalThis[RELEASE_KEY];
    if (state.renderDepth > 0 || release?.refreshing || now0154() < state.cooldownUntil) {
      return false;
    }
    state.cooldownUntil = now0154() + 350;
    const result = original.apply(this, args);
    if (result && typeof result.finally === "function") {
      return result.finally(() => {
        state.cooldownUntil = Math.max(state.cooldownUntil, now0154() + 1200);
      });
    }
    state.cooldownUntil = Math.max(state.cooldownUntil, now0154() + 1200);
    return result;
  }

  guardedRefresh0154.__dm0154RefreshGuard = true;
  guardedRefresh0154.__dmPrevious = original;
  globalThis[name] = guardedRefresh0154;
  return true;
}

function installStability0154() {
  restoreEventRegistration0154();
  installRenderGuard0154();
  installRefreshGuard0154("cdRefreshPeriodDeltas");
  installRefreshGuard0154("cdDeriveFromTotals");
  stabilityState0154().installed = true;
}

installStability0154();
globalThis.queueMicrotask?.(installStability0154);
globalThis.setTimeout?.(installStability0154, 0);
globalThis.setTimeout?.(installStability0154, 150);
globalThis.addEventListener?.("dashboardmodern:legacy-ready", installStability0154);
