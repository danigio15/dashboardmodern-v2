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
 * This module owns the host lifecycle only. It deliberately knows nothing about
 * the legacy dashboard's internals, so migrating a section to a native
 * DashboardModern module never requires touching this file.
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

  // The prelude checks this to tell hosted from standalone. It is a marker,
  // not a payload: there is nothing in it worth reading.
  hostWindow[HOST_KEY] = true;
  // The real access token must be readable by the frame's prelude BEFORE the
  // dashboard's own scripts parse (const LONG_LIVED_TOKEN is evaluated at
  // parse time). Properties set on the frame's contentWindow are lost when the
  // about:blank window is replaced on navigation, so the token lives on the
  // parent — which persists — and the prelude copies it synchronously.
  try {
    const realToken = hass?.auth?.data?.access_token;
    if (realToken) hostWindow.__DASHBOARDMODERN_REAL_TOKEN__ = realToken;
  } catch (error) {
    /* no token; REST-dependent widgets degrade, never a failed login */
  }

  const file = variant || legacyVariantForLocale(hass?.locale?.language);
  const frame = documentRef.createElement("iframe");
  frame.className = "dashboardmodern-legacy-host";
  frame.setAttribute("title", "DashboardModern");
  frame.setAttribute("src", `${staticBase}/legacy/${file}`);
  // Camera playback needs these delegated explicitly: an iframe blocks
  // autoplay, fullscreen and picture-in-picture by default, which silently
  // breaks the WebRTC/HLS/MJPEG cascade and the iOS fullscreen handling.
  frame.setAttribute("allow", LEGACY_FRAME_PERMISSIONS);
  // No sandbox attribute: the hosted document must stay same-origin for the
  // shim to be installable, and it is first-party code shipped by this
  // integration.
  frame.style.width = "100%";
  frame.style.border = "0";
  frame.style.display = "block";
  // Fill the container rather than computing from the viewport. Subtracting a
  // header height the panel container has already excluded leaves exactly that
  // much blank space below the dashboard.
  frame.style.height = "100%";

  const BridgeSocket = createBridgeSocket({ connection, onDenied });
  // Available to the frame's prelude from the very first parse, so the
  // page's initial connection goes straight through the bridge — no failed
  // first attempt, no visible red phase, no reconnect reload.
  hostWindow.__DASHBOARDMODERN_BRIDGE_WS__ = BridgeSocket;

  // If the ancestor chain turns out to have no definite height, a percentage
  // resolves to zero and the dashboard renders as a thin strip. Falling back
  // to viewport units costs nothing and only applies when it is needed.
  const ensureHeight = () => {
    if (typeof frame.clientHeight !== "number") return;
    if (frame.clientHeight > 0) return;
    frame.style.height = "100dvh";
  };
  const install = () => {
    // Installed on every load so a reload inside the frame does not fall back
    // to the real constructor and try to authenticate on its own.
    const child = frame.contentWindow;
    if (!child) return;
    // Give the hosted dashboard a stable, integration-specific storage
    // namespace, so its cd_* keys never collide with a standalone plancia or
    // another dashboard on the same origin.
    child.__DASHBOARDMODERN_INSTANCE__ = instanceId;
    // The primary plancia keeps the historical cloud-sync key; secondary
    // plance get an instance-suffixed key so their configs never collide.
    child.__DASHBOARDMODERN_PRIMARY__ = primary !== false;
    // Set the hosted marker directly too, so the dashboard knows it is hosted
    // even before its own prelude runs — the wizard guard depends on this.
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
      delete hostWindow.__DASHBOARDMODERN_BRIDGE_WS__;
    },
  };
}
