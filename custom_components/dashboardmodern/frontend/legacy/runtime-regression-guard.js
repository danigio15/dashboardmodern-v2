/* DashboardModern 0.15.0 — transport bootstrap only. */
(function installRuntimeTransport0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_RUNTIME_REGRESSION_GUARD_0150__";
  if (root[KEY]?.installed) return;
  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    bridgeAligned: false,
  });

  function installSocketConstants(Socket) {
    if (typeof Socket !== "function") return false;
    [["CONNECTING", 0], ["OPEN", 1], ["CLOSING", 2], ["CLOSED", 3]].forEach(
      ([name, value]) => {
        if (Socket[name] != null) return;
        try {
          Object.defineProperty(Socket, name, { value, configurable: true });
        } catch (_error) {}
      },
    );
    return true;
  }

  function alignBridge() {
    const candidate =
      (typeof root.__DASHBOARDMODERN_PRELUDE_WS__ === "function" &&
        root.__DASHBOARDMODERN_PRELUDE_WS__) ||
      (typeof root.__DASHBOARDMODERN_BRIDGE_WS__ === "function" &&
        root.__DASHBOARDMODERN_BRIDGE_WS__) ||
      null;
    if (!candidate) return false;
    installSocketConstants(candidate);
    root.WebSocket = candidate;
    root.__DASHBOARDMODERN_BRIDGE_WS__ = candidate;
    state.bridgeAligned = true;
    const reconnect = root.__DASHBOARDMODERN_LEGACY_RECONNECT__;
    if (reconnect?.timer) {
      root.clearTimeout?.(reconnect.timer);
      reconnect.timer = 0;
      reconnect.cancelled = true;
    }
    return true;
  }

  alignBridge();
  root.addEventListener?.("dashboardmodern:legacy-ready", alignBridge);
  root.addEventListener?.("pageshow", alignBridge);
})(globalThis);
