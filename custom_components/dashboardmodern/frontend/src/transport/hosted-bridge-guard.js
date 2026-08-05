const root = globalThis;
const HOSTED_PLACEHOLDER = "__dashboardmodern_hosted__";

const clean = (value) => String(value ?? "").trim();

function parentValue(key) {
  try {
    return root.parent && root.parent !== root ? root.parent[key] : undefined;
  } catch (_error) {
    return undefined;
  }
}

function nativeCredential() {
  return clean(
    root.DASHBOARDMODERN_AUTH_TOKEN ||
      root.__DASHBOARDMODERN_REAL_TOKEN__ ||
      root.__DASHBOARDMODERN_CONNECTION__?.token,
  );
}

export function hasUsableNativeCredential() {
  const token = nativeCredential();
  return Boolean(token && token !== HOSTED_PLACEHOLDER);
}

export function isStructurallyHostedDashboard() {
  if (root.__DASHBOARDMODERN_HOSTED__ === true || root.__DASHBOARDMODERN_BRIDGED__ === true)
    return true;
  try {
    if (/[?&](?:dmi|dmp)=/.test(root.location?.search || "")) return true;
    return Boolean(root.parent && root.parent !== root && parentValue("__DASHBOARDMODERN_HOST__") === true);
  } catch (_error) {
    return false;
  }
}

export function isHostedDashboard() {
  return isStructurallyHostedDashboard();
}

export function isNativeSocket(SocketCtor = root.WebSocket) {
  if (typeof SocketCtor !== "function") return false;
  try {
    return /\[native code\]/.test(Function.prototype.toString.call(SocketCtor));
  } catch (_error) {
    return false;
  }
}

export function ensureSocketConstants(SocketCtor) {
  if (typeof SocketCtor !== "function") return SocketCtor;
  for (const [key, fallback] of Object.entries({ CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 })) {
    if (SocketCtor[key] != null) continue;
    try {
      Object.defineProperty(SocketCtor, key, {
        configurable: true,
        enumerable: true,
        value: fallback,
      });
    } catch (_error) {
      try {
        SocketCtor[key] = fallback;
      } catch (_ignored) {}
    }
  }
  return SocketCtor;
}

function deferredSocketConstructor(SocketCtor) {
  function DeferredSocket(...args) {
    const inner = Reflect.construct(SocketCtor, args);
    Object.defineProperty(this, "__dmInnerSocket", { value: inner });
    for (const property of ["onopen", "onmessage", "onerror", "onclose"]) {
      let assigned = null;
      Object.defineProperty(this, property, {
        configurable: true,
        enumerable: true,
        get: () => assigned,
        set: (handler) => {
          assigned = typeof handler === "function" ? handler : null;
          inner[property] = assigned
            ? (event) => root.setTimeout?.(() => assigned.call(this, event), 0)
            : null;
        },
      });
    }
  }
  DeferredSocket.prototype = Object.create(SocketCtor.prototype || Object.prototype);
  DeferredSocket.prototype.constructor = DeferredSocket;
  DeferredSocket.prototype.send = function send(...args) {
    return this.__dmInnerSocket.send(...args);
  };
  DeferredSocket.prototype.close = function close(...args) {
    return this.__dmInnerSocket.close?.(...args);
  };
  DeferredSocket.prototype.addEventListener = function addEventListener(type, handler, options) {
    if (typeof this.__dmInnerSocket.addEventListener !== "function") return undefined;
    return this.__dmInnerSocket.addEventListener(
      type,
      (event) => root.setTimeout?.(() => handler.call(this, event), 0),
      options,
    );
  };
  DeferredSocket.prototype.removeEventListener = function removeEventListener(...args) {
    return this.__dmInnerSocket.removeEventListener?.(...args);
  };
  for (const property of ["readyState", "url", "protocol", "extensions", "bufferedAmount", "binaryType"]) {
    Object.defineProperty(DeferredSocket.prototype, property, {
      configurable: true,
      enumerable: true,
      get() {
        return this.__dmInnerSocket[property];
      },
      set(value) {
        this.__dmInnerSocket[property] = value;
      },
    });
  }
  ensureSocketConstants(DeferredSocket);
  DeferredSocket.__dmPreloadedCredentialSocket = true;
  return DeferredSocket;
}

function parseSocketMessage(event) {
  try {
    return JSON.parse(event?.data || event);
  } catch (_error) {
    return null;
  }
}

function wrapInjectedHostedAdapter(BridgeCtor) {
  if (
    typeof BridgeCtor !== "function" ||
    BridgeCtor.__dmInjectedHostedAdapter !== true ||
    BridgeCtor.__dmHostedHandshakeAdapter === true
  )
    return BridgeCtor;
  class HostedHandshakeAdapter extends BridgeCtor {
    constructor(...args) {
      super(...args);
      const original = Object.getOwnPropertyDescriptor(this, "onmessage");
      if (!original?.set) return;
      let assigned = null;
      Object.defineProperty(this, "onmessage", {
        configurable: true,
        enumerable: true,
        get: () => assigned,
        set: (handler) => {
          assigned = typeof handler === "function" ? handler : null;
          original.set.call(this, (event) => {
            if (parseSocketMessage(event)?.type === "auth_required") {
              this.send(JSON.stringify({ type: "auth", access_token: HOSTED_PLACEHOLDER }));
              return;
            }
            assigned?.call(this, event);
          });
        },
      });
    }
  }
  ensureSocketConstants(HostedHandshakeAdapter);
  HostedHandshakeAdapter.__dmInjectedHostedAdapter = true;
  HostedHandshakeAdapter.__dmHostedHandshakeAdapter = true;
  return HostedHandshakeAdapter;
}

export function adoptHostedBridge() {
  if (!isStructurallyHostedDashboard()) return false;
  let bridge =
    (typeof root.__DASHBOARDMODERN_BRIDGE_WS__ === "function" && root.__DASHBOARDMODERN_BRIDGE_WS__) ||
    (typeof parentValue("__DASHBOARDMODERN_BRIDGE_WS__") === "function" &&
      parentValue("__DASHBOARDMODERN_BRIDGE_WS__"));
  if (typeof bridge !== "function") return false;
  bridge = wrapInjectedHostedAdapter(bridge);
  ensureSocketConstants(bridge);
  root.__DASHBOARDMODERN_HOSTED__ = true;
  root.__DASHBOARDMODERN_BRIDGED__ = true;
  root.__DASHBOARDMODERN_BRIDGE_WS__ = bridge;
  if (root.WebSocket !== bridge) root.WebSocket = bridge;
  return true;
}

export function restoreCredentialedPreloadedSocket() {
  if (isStructurallyHostedDashboard()) return false;
  const current = root.WebSocket;
  const preloaded = root.__DASHBOARDMODERN_PRELUDE_WS__;
  if (!hasUsableNativeCredential()) return false;
  if (typeof preloaded !== "function" || current?.name !== "StubSocket") return false;
  const restored =
    root.__DASHBOARDMODERN_PRELUDE_DEFERRED_WS__ || deferredSocketConstructor(preloaded);
  root.__DASHBOARDMODERN_PRELUDE_DEFERRED_WS__ = restored;
  root.WebSocket = restored;
  return true;
}

export function isHostedBridgeReady() {
  if (!isStructurallyHostedDashboard()) return false;
  adoptHostedBridge();
  const SocketCtor = root.WebSocket;
  if (typeof SocketCtor !== "function") return false;
  if (SocketCtor.name === "StubSocket" || isNativeSocket(SocketCtor)) return false;
  ensureSocketConstants(SocketCtor);
  return root.__DASHBOARDMODERN_BRIDGED__ === true;
}

function clearCredential(key) {
  try {
    delete root[key];
  } catch (_error) {
    root[key] = "";
  }
}

export function sanitizeHostedCredentials() {
  const hosted = isStructurallyHostedDashboard();
  if (hosted) {
    for (const key of [
      "DASHBOARDMODERN_AUTH_TOKEN",
      "__DASHBOARDMODERN_REAL_TOKEN__",
      "LONG_LIVED_TOKEN",
      "HA_TOKEN",
    ])
      clearCredential(key);
    const connection = root.__DASHBOARDMODERN_CONNECTION__;
    if (connection) connection.token = "";
    adoptHostedBridge();
  } else {
    for (const key of ["DASHBOARDMODERN_AUTH_TOKEN", "__DASHBOARDMODERN_REAL_TOKEN__"]) {
      if (clean(root[key]) === HOSTED_PLACEHOLDER) clearCredential(key);
    }
    const connection = root.__DASHBOARDMODERN_CONNECTION__;
    if (connection && clean(connection.token) === HOSTED_PLACEHOLDER) connection.token = "";
    restoreCredentialedPreloadedSocket();
  }

  const reconnect = root.__DASHBOARDMODERN_LEGACY_RECONNECT__;
  if (hosted && reconnect?.timer) {
    root.clearTimeout?.(reconnect.timer);
    reconnect.timer = 0;
    reconnect.callback = null;
    reconnect.args = [];
    reconnect.cancelled = true;
  }
}

export async function waitForHostedBridge({ timeout = 5000, interval = 25 } = {}) {
  if (!isStructurallyHostedDashboard()) return true;
  sanitizeHostedCredentials();
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (isHostedBridgeReady()) return true;
    await new Promise((resolve) => root.setTimeout?.(resolve, interval));
  }
  throw new Error("DashboardModern hosted bridge is not ready");
}

export function installHostedBridgeGuard() {
  sanitizeHostedCredentials();
  if (root.__DASHBOARDMODERN_HOST_GUARD_INSTALLED__) return;
  root.__DASHBOARDMODERN_HOST_GUARD_INSTALLED__ = true;
  for (const event of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:bridge-ready",
    "pageshow",
  ]) {
    root.addEventListener?.(event, sanitizeHostedCredentials);
  }
}

installHostedBridgeGuard();
