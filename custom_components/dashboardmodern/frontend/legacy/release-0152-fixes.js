/* DashboardModern 0.14.12 compatibility entry point. */
import "./release-0152-guards.js";
export * from "./release-0152-runtime.js";
import "./release-0152-runtime.js";
import "./energy-monthly-report-media-fixes.js";
import "./energy-report-runtime-hooks.js";
import "./energy-report-observer-guard.js";
import "./appliance-media-layout-lock.js";

function installArtworkLayoutFix0152() {
  const doc = globalThis.document;
  if (!doc || doc.getElementById("dm-release-0152-artwork-layout-fix")) return;

  const artworkSelector = `
    html body #page-appliances-main
      .appl-wide-card.dm-control-device[data-dm-artwork]
      .appl-visual
      .appl-ic
      .dm-appliance-media
      > .dm-appliance-art
      > .dm-appliance-art.dm-appliance-art-0152[data-dm-art]
  `;

  const style = doc.createElement("style");
  style.id = "dm-release-0152-artwork-layout-fix";
  style.textContent = `
    ${artworkSelector} {
      display: grid !important;
      place-items: center !important;
      box-sizing: border-box !important;
      width: 100% !important;
      height: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: 100% !important;
      max-height: 100% !important;
      padding: 6px !important;
      margin: 0 !important;
      overflow: hidden !important;
      transform: none !important;
    }

    ${artworkSelector} > svg {
      display: block !important;
      box-sizing: border-box !important;
      width: 76% !important;
      height: 76% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: 76% !important;
      max-height: 76% !important;
      object-fit: contain !important;
      object-position: center !important;
      transform: none !important;
      overflow: visible !important;
      flex: 0 0 76% !important;
    }
  `;
  doc.head.append(style);
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
  globalThis.queueMicrotask?.(() => installRenderRefreshGuard0152());
  globalThis.setTimeout?.(() => installRenderRefreshGuard0152(), 0);
  globalThis.setTimeout?.(() => installRenderRefreshGuard0152(), 120);
}

installArtworkLayoutFix0152();
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