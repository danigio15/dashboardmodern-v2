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
          hotfix.suppressUntil = clock0154Hotfix() + 100;
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

function installGlobalRenderGate0154() {
  const current = globalThis.render;
  if (typeof current !== "function" || current.__dm0154EnergyRenderGate) return false;

  function energySafeGlobalRender0154(...args) {
    const hotfix = hotfixState0154();
    if (hotfix.suppressNextGlobalRender) {
      const active = clock0154Hotfix() <= hotfix.suppressUntil;
      hotfix.suppressNextGlobalRender = false;
      hotfix.suppressUntil = 0;
      if (active) return false;
    }
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

if (typeof globalThis.document !== "undefined") {
  installEnergyRenderHotfix0154();
  globalThis.queueMicrotask?.(installEnergyRenderHotfix0154);
  globalThis.setTimeout?.(installEnergyRenderHotfix0154, 0);
  globalThis.setTimeout?.(installEnergyRenderHotfix0154, 120);
  globalThis.setTimeout?.(installEnergyRenderHotfix0154, 500);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", installEnergyRenderHotfix0154);
}
