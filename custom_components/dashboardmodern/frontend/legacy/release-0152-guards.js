/* DashboardModern 0.14.12 guards installed before the corrective runtime. */

function energySectionSignature(store) {
  try {
    return JSON.stringify(store?.getSection?.("energy") || {});
  } catch (_error) {
    return "";
  }
}

function installEnergySubscriptionGuard0152() {
  const store = globalThis.DashboardModernModules?.store;
  const subscribe = store?.subscribe;
  if (!store || typeof subscribe !== "function") return false;
  if (subscribe.__dm0152EnergyGuard) return true;

  function guardedSubscribe(listener) {
    const source = typeof listener === "function" ? String(listener) : "";
    const isRuntimeEnergyListener =
      source.includes("scheduleEnergyRefresh") &&
      source.includes("change.section") &&
      source.includes("energy");

    if (!isRuntimeEnergyListener) {
      return subscribe.call(this, listener);
    }

    let previousSignature = energySectionSignature(store);
    return subscribe.call(this, (change) => {
      if (change?.section === "energy" && change?.status === "success") {
        const nextSignature = energySectionSignature(store);
        if (nextSignature === previousSignature) return;
        previousSignature = nextSignature;
      }
      return listener(change);
    });
  }

  Object.defineProperty(guardedSubscribe, "__dm0152EnergyGuard", {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  Object.defineProperty(guardedSubscribe, "__dmPrevious", {
    value: subscribe,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  store.subscribe = guardedSubscribe;
  return true;
}

function alignDeferredBridgeAlias0152() {
  const bridge = globalThis.__DASHBOARDMODERN_BRIDGE_WS__;
  const activeSocket = globalThis.WebSocket;
  if (typeof bridge !== "function" || typeof activeSocket !== "function") return false;
  if (activeSocket === bridge) return true;

  // The prelude deliberately wraps an injected adapter so synchronous mock
  // replies cannot recursively re-enter the legacy state machine. Keep that
  // safe wrapper active and move the public bridge alias to it instead of
  // restoring the raw constructor.
  if (globalThis.__DASHBOARDMODERN_PRELUDE_WS__ === bridge) {
    globalThis.__DASHBOARDMODERN_BRIDGE_WS__ = activeSocket;
    return true;
  }
  return false;
}

installEnergySubscriptionGuard0152();
alignDeferredBridgeAlias0152();

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener(
    "dashboardmodern:legacy-ready",
    () => {
      installEnergySubscriptionGuard0152();
      alignDeferredBridgeAlias0152();
      globalThis.queueMicrotask?.(() => alignDeferredBridgeAlias0152());
    },
    { once: true },
  );
}

if (globalThis.document?.readyState === "loading") {
  globalThis.document.addEventListener(
    "DOMContentLoaded",
    () => installEnergySubscriptionGuard0152(),
    { once: true },
  );
}
