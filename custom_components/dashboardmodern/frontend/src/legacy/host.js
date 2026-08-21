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
/* Marker on the one message the hosted document is allowed to send its host. */
export const HOST_MESSAGE_SOURCE = "dashboardmodern-host";
export const LEGACY_FRAME_PERMISSIONS =
  "autoplay; fullscreen; picture-in-picture; encrypted-media";
export const LEGACY_VARIANTS = Object.freeze({ it: "dashboard.html", en: "dashboard-en.html" });

/* Quale delle due plance servire, a partire dalla lingua del profilo.
 *
 * Il patto e' questo, e vale anche per le lingue che non parliamo: `it` e
 * `it-*` prendono l'italiano, tutto il resto prende l'inglese. Un profilo in
 * francese, tedesco o spagnolo non capirebbe l'italiano piu' di quanto capisca
 * l'inglese, e l'inglese almeno e' la lingua che tutti si aspettano quando la
 * propria non c'e'. Chi un domani aggiungesse una terza plancia deve nominarla
 * qui: il ripiego non si sceglie da solo. */
export function legacyVariantForLocale(locale) {
  const normalized = typeof locale === "string" ? locale.toLowerCase() : "";
  if (normalized === "it" || normalized.startsWith("it-")) return LEGACY_VARIANTS.it;
  return LEGACY_VARIANTS.en;
}

function escapeAttribute(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function injectHostedPrelude(html, { baseUrl, instanceId, primary, configProfile }) {
  const prelude = `<base href="${escapeAttribute(baseUrl)}"><script>(function(){
    const p=parent;
    const bridge=p&&p.__DASHBOARDMODERN_BRIDGE_WS__;
    window.__DASHBOARDMODERN_INSTANCE__=${JSON.stringify(instanceId)};
    window.__DASHBOARDMODERN_PROFILE__=${JSON.stringify(configProfile || "")};
    window.__DASHBOARDMODERN_PRIMARY__=${primary !== false};
    window.__DASHBOARDMODERN_HOSTED__=true;
    window.__DASHBOARDMODERN_BRIDGED__=typeof bridge==='function';
    /* The document lives at about:srcdoc, where location.reload() lands on a
       blank page in the Home Assistant WebView. Anything that needs a fresh
       dashboard asks the host to build one instead. The message carries no
       data: the host only accepts it from this frame. */
    window.__DASHBOARDMODERN_RELOAD__=function(){
      try{ if(!p||p===window) return false; p.postMessage({source:'dashboardmodern-host',action:'reload'},'*'); return true; }catch(_e){ return false; }
    };
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

export function stableStaticBase(staticBase, hostWindow = globalThis.window) {
  try {
    const url = new URL(String(staticBase || ""), hostWindow?.location?.href || "http://localhost/");
    const marker = "/dashboardmodern_static";
    const index = url.pathname.indexOf(marker);
    if (index < 0) return "";
    url.pathname = url.pathname.slice(0, index + marker.length);
    url.search = "";
    url.hash = "";
    return url.href.replace(/\/$/, "");
  } catch (_error) {
    return "";
  }
}

async function loadHostedDocument(frame, { staticBase, file, instanceId, primary, configProfile, fetchRef, hostWindow }) {
  const requestedBase = String(staticBase).replace(/\/$/, "");
  const fallbackBase = stableStaticBase(requestedBase, hostWindow);
  const bases = [...new Set([requestedBase, fallbackBase].filter(Boolean))];
  let lastResponse = null;

  for (const base of bases) {
    const relativeBase = `${base}/legacy/`;
    const requestUrl = absoluteUrl(`${relativeBase}${file}`, hostWindow);
    const response = await fetchRef(requestUrl, { credentials: "same-origin", cache: "no-store" });
    lastResponse = response;
    if (response.ok) {
      const html = await response.text();
      frame.srcdoc = injectHostedPrelude(html, {
        baseUrl: absoluteUrl(relativeBase, hostWindow),
        instanceId,
        primary,
        configProfile,
      });
      frame.dataset.runtimeBase = base;
      frame.dataset.usedStableFallback = String(base !== requestedBase);
      return true;
    }
    // The stable route is a recovery path for stale versioned URLs. Do not hide
    // authentication/authorization/server failures behind another request.
    if (response.status !== 404) break;
  }

  throw new Error(`DashboardModern document load failed: ${lastResponse?.status ?? "network"}`);
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
    configProfile = "",
    onDenied = () => {},
  } = {},
) {
  if (!container) throw new Error("A container element is required.");
  if (!staticBase) throw new Error("A versioned static base path is required.");
  if (!connection?.sendMessagePromise) throw new Error("An authenticated Home Assistant connection is required.");

  hostWindow[HOST_KEY] = true;
  hostWindow.__DASHBOARDMODERN_INSTANCE__ = instanceId;
  hostWindow.__DASHBOARDMODERN_PROFILE__ = configProfile || "";
  hostWindow.__DASHBOARDMODERN_PRIMARY__ = primary !== false;
  delete hostWindow.__DASHBOARDMODERN_REAL_TOKEN__;
  delete hostWindow.DASHBOARDMODERN_AUTH_TOKEN;

  const file = variant || legacyVariantForLocale(hass?.locale?.language);
  const frame = documentRef.createElement("iframe");
  frame.className = "dashboardmodern-legacy-host";
  frame.setAttribute("title", "DashboardModern");
  frame.setAttribute("allow", LEGACY_FRAME_PERMISSIONS);
  frame.dataset ||= {};
  const profileQuery = configProfile ? `&dmc=${encodeURIComponent(configProfile)}` : "";
  frame.dataset.source = `${String(staticBase).replace(/\/$/, "")}/legacy/${file}?dmi=${encodeURIComponent(instanceId)}&dmp=${primary !== false ? 1 : 0}${profileQuery}`;
  frame.style.cssText = "width:100%;height:100%;min-height:0;border:0;display:block";
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.style.minHeight = "0";
  frame.style.border = "0";
  frame.style.display = "block";

  const BridgeSocket = createBridgeSocket({ connection, onDenied });
  BridgeSocket.__dmInjectedHostedAdapter = true;
  BridgeSocket.__dmHostedHandshakeAdapter = true;
  hostWindow.__DASHBOARDMODERN_BRIDGE_WS__ = BridgeSocket;

  const install = () => {
    const child = frame.contentWindow;
    if (!child) return false;
    child.__DASHBOARDMODERN_INSTANCE__ = instanceId;
    child.__DASHBOARDMODERN_PROFILE__ = configProfile || "";
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

  container.replaceChildren(frame);
  install();
  ensureHeight();

  const loader = typeof fetchRef === "function"
    ? fetchRef
    : hostWindow?.location?.href
      ? globalThis.fetch?.bind(globalThis)
      : async () => ({ ok: true, status: 200, text: async () => "<!doctype html><html><head></head><body></body></html>" });
  if (typeof loader !== "function") throw new Error("A fetch implementation is required.");

  const boot = () =>
    loadHostedDocument(frame, { staticBase, file, instanceId, primary, configProfile, fetchRef: loader, hostWindow }).catch((error) => {
      console.error("[DashboardModern] hosted document bootstrap failed", error);
      frame.srcdoc = `<main role="alert" style="padding:24px;font:16px sans-serif">DashboardModern: ${escapeAttribute(error.message)}</main>`;
      return false;
    });

  /* Reloading the dashboard.
   *
   * The dashboard document is handed to the frame through `srcdoc`, so its URL
   * is `about:srcdoc`. Reloading that from the inside — which is what "reset
   * the configuration" and "apply the auto-detection" both end with — lands on
   * an empty document in the Home Assistant WebView: the plancia goes white and
   * never comes back. The child asks for the reload instead, and the document
   * is built again from here, exactly the way it was built the first time.
   *
   * The same rebuild also runs whenever the frame reports a load that left no
   * document behind, which covers the reloads this host never hears about. */
  let rebooting = false;
  let booted = false;
  const reboot = () => {
    if (rebooting) return false;
    rebooting = true;
    Promise.resolve(boot()).finally(() => {
      rebooting = false;
    });
    return true;
  };

  const lostItsDocument = () => {
    try {
      const childDocument = frame.contentDocument;
      if (!childDocument) return false;
      // A dashboard document always has a body with content in it. An
      // about:blank replacement has an empty body and no dashboard marker.
      return Boolean(
        childDocument.body &&
          !childDocument.body.firstElementChild &&
          !frame.contentWindow?.__DASHBOARDMODERN_STORAGE_NS__,
      );
    } catch (_error) {
      return false;
    }
  };

  const onFrameLoad = () => {
    install();
    if (rebooting) return;
    // The frame's first load is the empty document it is created with, before
    // this host has written anything into it: that one is not a loss.
    if (!lostItsDocument()) {
      booted = true;
      return;
    }
    if (booted) reboot();
  };
  frame.addEventListener?.("load", onFrameLoad);

  const onChildMessage = (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data;
    if (data?.source !== HOST_MESSAGE_SOURCE || data?.action !== "reload") return;
    reboot();
  };
  hostWindow.addEventListener?.("message", onChildMessage);

  const ready = boot();

  return {
    frame,
    ready,
    install,
    ensureHeight,
    reboot,
    destroy() {
      hostWindow.removeEventListener?.("message", onChildMessage);
      // La plancia scrive anche nel documento di Home Assistant — lo scorrimento
      // bloccato, il velo a tutto schermo del modo chiosco. Se ne va prima che
      // la cornice sparisca, altrimenti resta addosso alle altre plance.
      try {
        frame.contentWindow?.dmReleaseOwnerDocument?.();
      } catch (_error) {}
      frame.remove();
      delete hostWindow[HOST_KEY];
      delete hostWindow.__DASHBOARDMODERN_INSTANCE__;
      delete hostWindow.__DASHBOARDMODERN_PROFILE__;
      delete hostWindow.__DASHBOARDMODERN_PRIMARY__;
      delete hostWindow.__DASHBOARDMODERN_BRIDGE_WS__;
      delete hostWindow.__DASHBOARDMODERN_REAL_TOKEN__;
      delete hostWindow.DASHBOARDMODERN_AUTH_TOKEN;
    },
  };
}
