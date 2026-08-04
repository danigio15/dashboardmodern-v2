/*
 * Hosts the vendored legacy dashboard inside the DashboardModern panel.
 *
 * The legacy dashboard is a complete HTML document that owns <html>, <body> and
 * ~250KB of unscoped CSS, so it is mounted in a same-origin iframe rather than
 * adopted into the panel's shadow root.
 *
 * No credential is passed into that iframe. Same-origin means the host can do
 * something better than handing over a token: it replaces the hosted document's
 * WebSocket constructor with a shim that forwards a fixed set of message types
 * through the panel's own authenticated connection. The hosted page therefore
 * has no credential to leak to the three CDN scripts it loads, and can perform
 * exactly the operations the dashboard needs and nothing else.
 *
 * The hosted HTML owns the single DashboardModern runtime. This host only owns
 * iframe lifecycle and the authenticated transport bridge; it never injects a
 * second runtime or a post-load patch into the child document.
 */

import { createBridgeSocket } from "./bridge-socket.js";

export const HOST_KEY = "__DASHBOARDMODERN_HOST__";
export const LEGACY_FRAME_PERMISSIONS = "autoplay; fullscreen; picture-in-picture; encrypted-media";
export const LEGACY_VARIANTS = Object.freeze({
  it: "dashboard.html",
  en: "dashboard-en.html",
});

/** Pick the vendored language variant for a Home Assistant locale. */
export function legacyVariantForLocale(locale) {
  const normalized = typeof locale === "string" ? locale.toLowerCase() : "";
  return normalized.startsWith("it") ? LEGACY_VARIANTS.it : LEGACY_VARIANTS.en;
}

/**
 * Mount the hosted legacy dashboard.
 *
 * `staticBase` is the versioned static mount registered by frontend.py, so a
 * shipped dashboard update changes the URL and defeats the browser cache
 * without any user action.
 */
export function mountLegacyHost(
  container,
  {
    hass,
    connection = hass?.connection,
    staticBase,
    documentRef = globalThis.document,
    hostWindow = globalThis.window,
    variant = null,
    instanceId = "integration",
    primary = true,
    onDenied = () => {},
  } = {},
) {
  if (!container) throw new Error("A container element is required.");
  if (!staticBase) throw new Error("A versioned static base path is required.");
  if (!connection?.sendMessagePromise) {
    throw new Error("An authenticated Home Assistant connection is required.");
  }

  hostWindow[HOST_KEY] = true;
  try {
    const realToken = hass?.auth?.data?.access_token;
    if (realToken) hostWindow.__DASHBOARDMODERN_REAL_TOKEN__ = realToken;
    hostWindow.__DASHBOARDMODERN_INSTANCE__ = instanceId;
    hostWindow.__DASHBOARDMODERN_PRIMARY__ = primary !== false;
  } catch (_error) {
    /* REST-dependent widgets degrade without turning the dashboard into a failed login. */
  }

  const file = variant || legacyVariantForLocale(hass?.locale?.language);
  const frame = documentRef.createElement("iframe");
  frame.className = "dashboardmodern-legacy-host";
  frame.setAttribute("title", "DashboardModern");
  const dmQuery = `?dmi=${encodeURIComponent(instanceId)}&dmp=${primary !== false ? 1 : 0}`;
  frame.setAttribute("src", `${staticBase}/legacy/${file}${dmQuery}`);
  frame.setAttribute("allow", LEGACY_FRAME_PERMISSIONS);
  frame.style.width = "100%";
  frame.style.border = "0";
  frame.style.display = "block";
  frame.style.height = "100%";

  const BridgeSocket = createBridgeSocket({ connection, onDenied });
  hostWindow.__DASHBOARDMODERN_BRIDGE_WS__ = BridgeSocket;

  const ensureHeight = () => {
    if (typeof frame.clientHeight !== "number") return;
    if (frame.clientHeight > 0) return;
    frame.style.height = "100dvh";
  };

  const install = () => {
    const child = frame.contentWindow;
    if (!child) return;
    child.__DASHBOARDMODERN_INSTANCE__ = instanceId;
    child.__DASHBOARDMODERN_PRIMARY__ = primary !== false;
    child.__DASHBOARDMODERN_HOSTED__ = true;
    child.WebSocket = BridgeSocket;
    child.__DASHBOARDMODERN_BRIDGED__ = true;
  };

  frame.addEventListener?.("load", install);
  container.replaceChildren(frame);
  install();
  ensureHeight();

  return {
    frame,
    install,
    ensureHeight,
    destroy() {
      frame.remove();
      delete hostWindow[HOST_KEY];
      delete hostWindow.__DASHBOARDMODERN_REAL_TOKEN__;
      delete hostWindow.__DASHBOARDMODERN_INSTANCE__;
      delete hostWindow.__DASHBOARDMODERN_PRIMARY__;
      delete hostWindow.__DASHBOARDMODERN_BRIDGE_WS__;
    },
  };
}
