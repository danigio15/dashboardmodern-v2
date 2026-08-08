// DashboardModern hosted bootstrap coordinator.
// The vendored legacy runtime owns the initial DOM/functions. Modern sections
// are installed only after legacy-ready and after modules-entry has exposed the
// canonical store/API, avoiding a second bootstrap racing during HTML parsing.
(function bootstrapDashboardModernRuntime() {
  const KEY = "__DASHBOARDMODERN_RUNTIME_BOOTSTRAP__";
  const state = (globalThis[KEY] ||= {
    started: false,
    promise: null,
    unloading: false,
  });

  globalThis.addEventListener?.(
    "pagehide",
    () => {
      state.unloading = true;
    },
    { once: true },
  );

  const start = () => {
    if (state.started || state.unloading) return true;
    const modules = globalThis.DashboardModernModules;
    if (
      !globalThis.__DASHBOARDMODERN_LEGACY_READY__ ||
      !modules ||
      globalThis.document?.readyState === "loading"
    ) {
      return false;
    }

    const releaseVersion = modules.diagnostics?.BUILD_INFO?.dashboardVersion;
    if (releaseVersion) globalThis.DASHBOARD_VERSION = releaseVersion;

    state.started = true;
    state.promise = import("../src/sections/section-runtime.js").catch((error) => {
      state.started = false;
      state.promise = null;
      if (state.unloading) return null;
      globalThis.__DASHBOARDMODERN_RUNTIME_BOOTSTRAP_ERROR__ = String(
        error?.message || error || "runtime bootstrap failed",
      );
      globalThis.console?.error?.("[DashboardModern] modular runtime bootstrap failed", error);
      return null;
    });
    return true;
  };

  globalThis.addEventListener?.("dashboardmodern:legacy-ready", start, { once: true });
  if (globalThis.document?.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    queueMicrotask(start);
  }
})();
