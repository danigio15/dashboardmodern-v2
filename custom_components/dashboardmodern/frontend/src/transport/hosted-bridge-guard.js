const root = globalThis;
const HOSTED_PLACEHOLDER = "__dashboardmodern_hosted__";

const clean = (value) => String(value ?? "").trim();

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

export function isHostedDashboard() {
  if (root.__DASHBOARDMODERN_HOSTED__ === true || root.__DASHBOARDMODERN_BRIDGED__ === true)
    return true;
  try {
    if (/[?&](?:dmi|dmp)=/.test(root.location?.search || ""))
      return !hasUsableNativeCredential();
    return root.parent && root.parent !== root && root.parent.__DASHBOARDMODERN_HOST__ === true;
  } catch (_error) {
    return false;
  }
}

export function isNativeSocket(SocketCtor = root.WebSocket) {
  if (typeof SocketCtor !== "function") return false;
  try {
    return /\[native code\]/.test(Function.prototype.toString.call(SocketCtor));
  } catch (_error) {
    return false;
  }
}

export function isHostedBridgeReady() {
  const SocketCtor = root.WebSocket;
  if (!isHostedDashboard() || typeof SocketCtor !== "function") return false;
  if (SocketCtor.name === "StubSocket" || isNativeSocket(SocketCtor)) return false;
  return root.__DASHBOARDMODERN_BRIDGED__ === true || root.__DASHBOARDMODERN_HOSTED__ === true;
}

export function sanitizeHostedCredentials() {
  for (const key of ["DASHBOARDMODERN_AUTH_TOKEN", "__DASHBOARDMODERN_REAL_TOKEN__"]) {
    if (clean(root[key]) === HOSTED_PLACEHOLDER) {
      try {
        delete root[key];
      } catch (_error) {
        root[key] = "";
      }
    }
  }
  const connection = root.__DASHBOARDMODERN_CONNECTION__;
  if (connection && clean(connection.token) === HOSTED_PLACEHOLDER) connection.token = "";

  const reconnect = root.__DASHBOARDMODERN_LEGACY_RECONNECT__;
  if (isHostedDashboard() && reconnect?.timer) {
    root.clearTimeout?.(reconnect.timer);
    reconnect.timer = 0;
    reconnect.callback = null;
    reconnect.args = [];
    reconnect.cancelled = true;
  }
}

export async function waitForHostedBridge({ timeout = 5000, interval = 25 } = {}) {
  if (!isHostedDashboard()) return true;
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
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready", "pageshow"]) {
    root.addEventListener?.(event, sanitizeHostedCredentials);
  }
}

installHostedBridgeGuard();
