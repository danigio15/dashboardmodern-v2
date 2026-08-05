/*
 * Hosts the vendored legacy dashboard inside the DashboardModern panel.
 *
 * The legacy dashboard is a complete HTML document that owns <html>, <body> and
 * unscoped CSS, so it is mounted in a same-origin iframe. Authentication stays
 * exclusively in the parent Home Assistant connection: the child receives only
 * the restricted BridgeSocket constructor and never an access token.
 */

import { createBridgeSocket } from "./bridge-socket.js";

export const HOST_KEY = "__DASHBOARDMODERN_HOST__";
export const LEGACY_FRAME_PERMISSIONS =
  "autoplay; fullscreen; picture-in-picture; encrypted-media";
export const LEGACY_VARIANTS = Object.freeze({
  it: "dashboard.html",
  en: "dashboard-en.html",
});

export function legacyVariantForLocale(locale) {
  const normalized = typeof locale === "string" ? locale.toLowerCase() : "";
  return normalized.startsWith("it") ? LEGACY_VARIANTS.it : LEGACY_VARIANTS.en;
}

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
  hostWindow.__DASHBOARDMODERN_INSTANCE__ = instanceId;
  hostWindow.__DASHBOARDMODERN_PRIMARY__ = primary !== false;
  // Remove credentials left by older DashboardModern versions. The bridge is
  // already authenticated by Home Assistant and must be the only transport.
  delete hostWindow.__DASHBOARDMODERN_REAL_TOKEN__;
  delete hostWindow.DASHBOARDMODERN_AUTH_TOKEN;

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
    if (typeof frame.clientHeight !== "number" || frame.clientHeight > 0) return;
    frame.style.height = "100dvh";
  };

  const install = () => {
    const child = frame.contentWindow;
    if (!child) return;
    child.__DASHBOARDMODERN_INSTANCE__ = instanceId;
    child.__DASHBOARDMODERN_PRIMARY__ = primary !== false;
    child.__DASHBOARDMODERN_HOSTED__ = true;
    child.__DASHBOARDMODERN_BRIDGED__ = true;
    delete child.__DASHBOARDMODERN_REAL_TOKEN__;
    delete child.DASHBOARDMODERN_AUTH_TOKEN;
    child.WebSocket = BridgeSocket;
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
      delete hostWindow.__DASHBOARDMODERN_INSTANCE__;
      delete hostWindow.__DASHBOARDMODERN_PRIMARY__;
      delete hostWindow.__DASHBOARDMODERN_BRIDGE_WS__;
      delete hostWindow.__DASHBOARDMODERN_REAL_TOKEN__;
      delete hostWindow.DASHBOARDMODERN_AUTH_TOKEN;
    },
  };
}
