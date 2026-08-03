/* DashboardModern compatibility entry point. */
import "./release-0152-guards.js";
export * from "./release-0152-runtime.js";
import "./release-0152-runtime.js";
import "./energy-monthly-report-media-fixes.js";
import "./energy-report-runtime-hooks.js";
import "./energy-report-observer-guard.js";
import "./release-0154-prelude.js";
import "./release-0154-runtime.js";
import "./release-0154-postlude.js";
import "./release-0154-final-appliance-stability.js";
import "./release-0154-render-stability.js";
import "./release-0154-energy-render-hotfix.js";
import "./release-0154-classifier-cycle-guard.js";
import "./release-0154-dom-stability.js";
import "./release-0154-temperature-live-state.js";
import "./release-0155-energy-placeholder-fallback.js";
import "./release-0155-public-runtime.js";
import "./release-0156-webkit-stability.js";
import "./release-0156-final-stability.js";
import "./release-0156-reconnect-timer-cancel.js";
import "./release-0156-current-period-lock.js";
import "./release-0157-finalization.js";
import "./release-0157-period-owner.js";

if (typeof globalThis.document !== "undefined") {
  import("./release-0156-final-runtime.js")
    .then(() => import("./release-0156-current-period-bootstrap.js"))
    .then(() => import("./release-0156-owner-guard.js"))
    .then(() => import("./release-0157-ui-stability.js"))
    .then(() => import("./release-0157-stability-guard.js"))
    .then(() => globalThis.__DASHBOARDMODERN_RELEASE_0157_FINALIZE__?.())
    .catch((error) => globalThis.console?.warn?.("[DashboardModern] final runtime import", error));
}

const RENDER_GUARD_KEY_0152 = "__DASHBOARDMODERN_RELEASE_0152_RENDER_GUARD__";

function guardClock0152() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function installRenderRefreshGuard0152() {
  const state = (globalThis[RENDER_GUARD_KEY_0152] ||= {
    depth: 0,
    blockUntil: 0,
  });

  const wrapRender = (name) => {
    const original = globalThis[name];
    if (typeof original !== "function" || original.__dm0152RenderGuard) return false;

    function guardedRender0152(...args) {
      state.depth += 1;
      state.blockUntil = Math.max(state.blockUntil, guardClock0152() + 500);
      let result;
      try {
        result = original.apply(this, args);
      } catch (error) {
        state.depth = Math.max(0, state.depth - 1);
        state.blockUntil = Math.max(state.blockUntil, guardClock0152() + 500);
        throw error;
      }
      if (result && typeof result.finally === "function") {
        return result.finally(() => {
          state.depth = Math.max(0, state.depth - 1);
          state.blockUntil = Math.max(state.blockUntil, guardClock0152() + 500);
        });
      }
      state.depth = Math.max(0, state.depth - 1);
      state.blockUntil = Math.max(state.blockUntil, guardClock0152() + 500);
      return result;
    }

    guardedRender0152.__dm0152RenderGuard = true;
    guardedRender0152.__dmPrevious = original;
    globalThis[name] = guardedRender0152;
    return true;
  };

  const wrapDerivedRefresh = (name) => {
    const original = globalThis[name];
    if (typeof original !== "function" || original.__dm0152DerivedGuard) return false;

    function guardedDerivedRefresh0152(...args) {
      if (state.depth > 0 || guardClock0152() < state.blockUntil) return false;
      return original.apply(this, args);
    }

    guardedDerivedRefresh0152.__dm0152DerivedGuard = true;
    guardedDerivedRefresh0152.__dmPrevious = original;
    globalThis[name] = guardedDerivedRefresh0152;
    return true;
  };

  ["renderEnergy", "renderEnergyDashboard", "renderReport"].forEach(wrapRender);
  ["cdDeriveFromTotals", "cdRefreshPeriodDeltas"].forEach(wrapDerivedRefresh);
}

function reinstallRuntimeGuards0152() {
  installRenderRefreshGuard0152();
  globalThis.queueMicrotask?.(installRenderRefreshGuard0152);
  globalThis.setTimeout?.(installRenderRefreshGuard0152, 0);
  globalThis.setTimeout?.(installRenderRefreshGuard0152, 120);
}

reinstallRuntimeGuards0152();

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("dashboardmodern:legacy-ready", reinstallRuntimeGuards0152, {
    once: true,
  });
}

if (globalThis.document?.readyState === "loading") {
  globalThis.document.addEventListener("DOMContentLoaded", reinstallRuntimeGuards0152, {
    once: true,
  });
}
