/* DashboardModern 0.14.14: keep energy-period refreshes from rebuilding unrelated UI. */
const HOTFIX_KEY = "__DASHBOARDMODERN_RELEASE_0154_ENERGY_RENDER_HOTFIX__";
const RELEASE_KEY = "__DASHBOARDMODERN_RELEASE_0154__";

function clock0154Hotfix() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function hotfixState0154() {
  return (globalThis[HOTFIX_KEY] ||= {
    suppressNextGlobalRender: false,
    suppressUntil: 0,
    releaseState: null,
    installed: false,
    monitor: null,
    monitorTicks: 0,
  });
}

function instrumentEnergyRefreshState0154() {
  const release = globalThis[RELEASE_KEY];
  const hotfix = hotfixState0154();
  if (!release || hotfix.releaseState === release) return Boolean(release);

  let refreshing = Boolean(release.refreshing);
  try {
    Object.defineProperty(release, "refreshing", {
      configurable: true,
      enumerable: true,
      get() {
        return refreshing;
      },
      set(value) {
        const next = Boolean(value);
        if (refreshing && !next) {
          hotfix.suppressNextGlobalRender = true;
          hotfix.suppressUntil = clock0154Hotfix() + 250;
        }
        refreshing = next;
      },
    });
    hotfix.releaseState = release;
    return true;
  } catch (_error) {
    return false;
  }
}

function calledFromEnergyRefresh0154() {
  try {
    return String(new Error().stack || "").includes("refreshEnergyPeriods0154");
  } catch (_error) {
    return false;
  }
}

function installGlobalRenderGate0154() {
  const current = globalThis.render;
  if (typeof current !== "function" || current.__dm0154EnergyRenderGate) return false;

  function energySafeGlobalRender0154(...args) {
    const hotfix = hotfixState0154();
    const armed = hotfix.suppressNextGlobalRender;
    const active = armed && clock0154Hotfix() <= hotfix.suppressUntil;
    if (armed) {
      hotfix.suppressNextGlobalRender = false;
      hotfix.suppressUntil = 0;
    }
    if (active || calledFromEnergyRefresh0154()) return false;
    return current.apply(this, args);
  }

  energySafeGlobalRender0154.__dm0154EnergyRenderGate = true;
  energySafeGlobalRender0154.__dm0154RenderGuard = true;
  energySafeGlobalRender0154.__dmPrevious = current;
  globalThis.render = energySafeGlobalRender0154;
  return true;
}

function installEnergyRenderHotfix0154() {
  instrumentEnergyRefreshState0154();
  installGlobalRenderGate0154();
  hotfixState0154().installed = true;
}

function monitorStartup0154() {
  const hotfix = hotfixState0154();
  if (hotfix.monitor || typeof globalThis.setInterval !== "function") return;
  hotfix.monitorTicks = 0;
  hotfix.monitor = globalThis.setInterval(() => {
    hotfix.monitorTicks += 1;
    installEnergyRenderHotfix0154();
    if (hotfix.monitorTicks >= 150) {
      globalThis.clearInterval?.(hotfix.monitor);
      hotfix.monitor = null;
    }
  }, 100);
}

if (typeof globalThis.document !== "undefined") {
  installEnergyRenderHotfix0154();
  monitorStartup0154();
  globalThis.queueMicrotask?.(installEnergyRenderHotfix0154);
  globalThis.setTimeout?.(installEnergyRenderHotfix0154, 0);
  globalThis.setTimeout?.(installEnergyRenderHotfix0154, 120);
  globalThis.setTimeout?.(installEnergyRenderHotfix0154, 500);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", installEnergyRenderHotfix0154);
  globalThis.addEventListener?.("pageshow", installEnergyRenderHotfix0154);
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", installEnergyRenderHotfix0154, {
      once: true,
    });
  }
}
