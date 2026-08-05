// Optional legacy configuration and production bootstrap.
// Both vendored HTML variants already load this file before their inline runtime.
// Keep configuration in same-origin localStorage and load the single modular owner graph.
(function bootstrapDashboardModernRuntime() {
  if (globalThis.__DASHBOARDMODERN_RUNTIME_BOOTSTRAP__) return;
  globalThis.__DASHBOARDMODERN_RUNTIME_BOOTSTRAP__ = true;
  import("./report-mobile-fixes.js").catch((error) => {
    globalThis.__DASHBOARDMODERN_RUNTIME_BOOTSTRAP_ERROR__ = String(
      error?.message || error || "runtime bootstrap failed",
    );
    globalThis.console?.error?.("[DashboardModern] modular runtime bootstrap failed", error);
  });
})();
