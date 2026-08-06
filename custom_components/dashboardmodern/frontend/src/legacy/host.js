/*
 * Hosts the vendored dashboard inside the DashboardModern panel.
 *
 * Authentication remains exclusively in the parent Home Assistant connection.
 * The child document is built through srcdoc so the restricted BridgeSocket is
 * installed before the first dashboard script can execute on every browser and
 * WebView. No access token and no native WebSocket are exposed to the child.
 */

import { createBridgeSocket } from "./bridge-socket.js";

export const HOST_KEY = "__DASHBOARDMODERN_HOST__";
export const LEGACY_FRAME_PERMISSIONS =
  "autoplay; fullscreen; picture-in-picture; encrypted-media";
export const LEGACY_VARIANTS = Object.freeze({ it: "dashboard.html", en: "dashboard-en.html" });

export function legacyVariantForLocale(locale) {
  const normalized = typeof locale === "string" ? locale.toLowerCase() : "";
  return normalized.startsWith("it") ? LEGACY_VARIANTS.it : LEGACY_VARIANTS.en;
}

function escapeAttribute(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function injectHostedPrelude(html, { baseUrl, instanceId, primary }) {
  const prelude = `<base href="${escapeAttribute(baseUrl)}"><script>(function(){
    const p=parent;
    const bridge=p&&p.__DASHBOARDMODERN_BRIDGE_WS__;
    window.__DASHBOARDMODERN_INSTANCE__=${JSON.stringify(instanceId)};
    window.__DASHBOARDMODERN_PRIMARY__=${primary !== false};
    window.__DASHBOARDMODERN_HOSTED__=true;
    window.__DASHBOARDMODERN_BRIDGED__=typeof bridge==='function';
    try{delete window.__DASHBOARDMODERN_REAL_TOKEN__;delete window.DASHBOARDMODERN_AUTH_TOKEN;delete window.LONG_LIVED_TOKEN;delete window.HA_TOKEN;}catch(_e){}
    if(typeof bridge==='function'){
      window.__DASHBOARDMODERN_BRIDGE_WS__=bridge;
      window.WebSocket=bridge;
    }else{
      class BlockedSocket{static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;constructor(){this.readyState=3;queueMicrotask(()=>this.onerror?.(new Error('DashboardModern bridge unavailable')));}send(){}close(){this.readyState=3;this.onclose?.({});}}
      window.WebSocket=BlockedSocket;
    }
  })();<\/script>`;
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${prelude}`);
  return `<!doctype html><html><head>${prelude}</head><body>${html}</body></html>`;
}

function absoluteUrl(path, hostWindow) {
  try {
    return new URL(path, hostWindow?.location?.href || "http://localhost/").href;
  } catch (_error) {
    return path;
  }
}

async function loadHostedDocument(frame, { staticBase, file, instanceId, primary, fetchRef, hostWindow }) {
  const relativeBase = `${String(staticBase).replace(/\/$/, "")}/legacy/`;
  const requestUrl = absoluteUrl(`${relativeBase}${file}`, hostWindow);
  const response = await fetchRef(requestUrl, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(`DashboardModern document load failed: ${response.status}`);
  const html = await response.text();
  frame.srcdoc = injectHostedPrelude(html, { baseUrl: absoluteUrl(relativeBase, hostWindow), instanceId, primary });
}

export function mountLegacyHost(
  container,
  {
    hass,
    connection = hass?.connection,
    staticBase,
    documentRef = globalThis.document,
    hostWindow = globalThis.window,
    fetchRef = null,
    variant = null,
    instanceId = "integration",
    primary = true,
    onDenied = () => {},
  } = {},
) {
  if (!container) throw new Error("A container element is required.");
  if (!staticBase) throw new Error("A versioned static base path is required.");
  if (!connection?.sendMessagePromise) throw new Error("An authenticated Home Assistant connection is required.");

  hostWindow[HOST_KEY] = true;
  hostWindow.__DASHBOARDMODERN_INSTANCE__ = instanceId;
  hostWindow.__DASHBOARDMODERN_PRIMARY__ = primary !== false;
  delete hostWindow.__DASHBOARDMODERN_REAL_TOKEN__;
  delete hostWindow.DASHBOARDMODERN_AUTH_TOKEN;

  const file = variant || legacyVariantForLocale(hass?.locale?.language);
  const frame = documentRef.createElement("iframe");
  frame.className = "dashboardmodern-legacy-host";
  frame.setAttribute("title", "DashboardModern");
  frame.setAttribute("allow", LEGACY_FRAME_PERMISSIONS);
  frame.dataset ||= {};
  frame.dataset.source = `${String(staticBase).replace(/\/$/, "")}/legacy/${file}?dmi=${encodeURIComponent(instanceId)}&dmp=${primary !== false ? 1 : 0}`;
  frame.style.cssText = "width:100%;height:100%;min-height:0;border:0;display:block";

  const BridgeSocket = createBridgeSocket({ connection, onDenied });
  BridgeSocket.__dmInjectedHostedAdapter = true;
  BridgeSocket.__dmHostedHandshakeAdapter = true;
  hostWindow.__DASHBOARDMODERN_BRIDGE_WS__ = BridgeSocket;

  const install = () => {
    const child = frame.contentWindow;
    if (!child) return false;
    child.__DASHBOARDMODERN_INSTANCE__ = instanceId;
    child.__DASHBOARDMODERN_PRIMARY__ = primary !== false;
    child.__DASHBOARDMODERN_HOSTED__ = true;
    child.__DASHBOARDMODERN_BRIDGED__ = true;
    child.__DASHBOARDMODERN_BRIDGE_WS__ = BridgeSocket;
    delete child.__DASHBOARDMODERN_REAL_TOKEN__;
    delete child.DASHBOARDMODERN_AUTH_TOKEN;
    child.WebSocket = BridgeSocket;
    return true;
  };

  const ensureHeight = () => {
    if (typeof frame.clientHeight === "number" && frame.clientHeight <= 0) frame.style.height = "100dvh";
  };

  frame.addEventListener?.("load", install);
  container.replaceChildren(frame);
  install();
  ensureHeight();

  const loader = typeof fetchRef === "function"
    ? fetchRef
    : hostWindow?.location?.href
      ? globalThis.fetch?.bind(globalThis)
      : async () => ({ ok: true, text: async () => "<!doctype html><html><head></head><body></body></html>" });
  if (typeof loader !== "function") throw new Error("A fetch implementation is required.");

  const ready = loadHostedDocument(frame, { staticBase, file, instanceId, primary, fetchRef: loader, hostWindow }).catch((error) => {
    console.error("[DashboardModern] hosted document bootstrap failed", error);
    frame.srcdoc = `<main role="alert" style="padding:24px;font:16px sans-serif">DashboardModern: ${escapeAttribute(error.message)}</main>`;
    return false;
  });

  return {
    frame,
    ready,
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
