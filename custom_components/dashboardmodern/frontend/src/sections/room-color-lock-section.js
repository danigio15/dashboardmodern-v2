// DM-FIX-20260813C
import { clean, doc, installStyle, root } from "./shared.js";

// Beta18: all room/action icons are owned by icon-engine-section. This historical
// module keeps only the iOS kiosk contract; it must never observe or repaint icon DOM.
const KEY = "__DASHBOARDMODERN_BETA12_FINAL_LOCK__";
const KIOSK_ATTR = "data-dm-ios-kiosk";
const state = (root[KEY] ||= {
  listeners: false,
  kioskHost: null,
  kioskHostCss: "",
  kioskFrame: null,
  kioskFrameCss: "",
  kioskViewportBound: false,
});

function isIosDevice() {
  const nav = root.navigator;
  const ua = clean(nav?.userAgent);
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return clean(nav?.platform) === "MacIntel" && Number(nav?.maxTouchPoints || 0) > 1;
}

function kioskValueFromLocation(locationLike) {
  if (!locationLike) return null;
  try {
    const params = new URLSearchParams(locationLike.search || "");
    for (const key of ["kiosk", "dm_kiosk"]) {
      if (!params.has(key)) continue;
      const value = clean(params.get(key)).toLowerCase();
      return !["0", "false", "off", "no"].includes(value);
    }
    const hash = clean(locationLike.hash).replace(/^#/, "");
    if (hash.includes("=")) {
      const hashParams = new URLSearchParams(hash.includes("?") ? hash.split("?").pop() : hash);
      for (const key of ["kiosk", "dm_kiosk"]) {
        if (!hashParams.has(key)) continue;
        const value = clean(hashParams.get(key)).toLowerCase();
        return !["0", "false", "off", "no"].includes(value);
      }
    }
  } catch (_error) {}
  return null;
}

function kioskRequested() {
  for (const candidate of [root.parent, root]) {
    try {
      const value = kioskValueFromLocation(candidate?.location);
      if (value !== null) return value;
    } catch (_error) {}
  }
  return false;
}

function hostForFrame() {
  try {
    const frame = root.frameElement;
    const tree = frame?.getRootNode?.();
    const host = tree?.host;
    return { frame: frame || null, host: host || null };
  } catch (_error) {
    return { frame: null, host: null };
  }
}

function updateKioskViewport() {
  const viewport = root.visualViewport;
  const height = Math.max(1, Math.round(viewport?.height || root.innerHeight || 0));
  const width = Math.max(1, Math.round(viewport?.width || root.innerWidth || 0));
  doc?.documentElement?.style?.setProperty?.("--dm-ios-kiosk-height", `${height}px`);
  doc?.documentElement?.style?.setProperty?.("--dm-ios-kiosk-width", `${width}px`);
}

function activateIosKiosk() {
  if (!doc || !isIosDevice() || !kioskRequested()) return false;
  doc.documentElement?.setAttribute?.(KIOSK_ATTR, "true");
  doc.body?.setAttribute?.(KIOSK_ATTR, "true");
  updateKioskViewport();
  if (!state.kioskViewportBound) {
    state.kioskViewportBound = true;
    root.visualViewport?.addEventListener?.("resize", updateKioskViewport, { passive: true });
    root.visualViewport?.addEventListener?.("scroll", updateKioskViewport, { passive: true });
    root.addEventListener?.("resize", updateKioskViewport, { passive: true });
    root.addEventListener?.("orientationchange", updateKioskViewport, { passive: true });
  }
  const { frame, host } = hostForFrame();
  if (host && state.kioskHost !== host) {
    if (state.kioskHost) state.kioskHost.style.cssText = state.kioskHostCss;
    state.kioskHost = host;
    state.kioskHostCss = host.style.cssText || "";
  }
  if (frame && state.kioskFrame !== frame) {
    if (state.kioskFrame) state.kioskFrame.style.cssText = state.kioskFrameCss;
    state.kioskFrame = frame;
    state.kioskFrameCss = frame.style.cssText || "";
  }
  if (host) {
    host.dataset.dmIosKiosk = "true";
    host.style.setProperty("position", "fixed", "important");
    host.style.setProperty("inset", "0", "important");
    host.style.setProperty("z-index", "2147483000", "important");
    host.style.setProperty("width", "100vw", "important");
    host.style.setProperty("height", "100dvh", "important");
    host.style.setProperty("min-height", "100dvh", "important");
    host.style.setProperty("margin", "0", "important");
    host.style.setProperty("padding", "0", "important");
    host.style.setProperty("background", "var(--primary-background-color,#f8fafc)", "important");
    host.style.setProperty("overflow", "hidden", "important");
  }
  if (frame) {
    frame.dataset.dmIosKiosk = "true";
    frame.style.setProperty("width", "100%", "important");
    frame.style.setProperty("height", "100%", "important");
    frame.style.setProperty("min-height", "100%", "important");
  }
  return true;
}

function deactivateIosKiosk() {
  doc?.documentElement?.removeAttribute?.(KIOSK_ATTR);
  doc?.body?.removeAttribute?.(KIOSK_ATTR);
  if (state.kioskHost) {
    state.kioskHost.style.cssText = state.kioskHostCss;
    delete state.kioskHost.dataset.dmIosKiosk;
    state.kioskHost = null;
    state.kioskHostCss = "";
  }
  if (state.kioskFrame) {
    state.kioskFrame.style.cssText = state.kioskFrameCss;
    delete state.kioskFrame.dataset.dmIosKiosk;
    state.kioskFrame = null;
    state.kioskFrameCss = "";
  }
}

function syncIosKiosk() {
  if (isIosDevice() && kioskRequested()) activateIosKiosk();
  else deactivateIosKiosk();
}

if (!state.listeners) {
  state.listeners = true;
  root.addEventListener?.("popstate", syncIosKiosk);
  root.addEventListener?.("hashchange", syncIosKiosk);
  root.addEventListener?.("pageshow", syncIosKiosk);
}
for (const eventName of [
  "dashboardmodern:legacy-ready",
  "dashboardmodern:runtime-ready",
  "dashboardmodern:states-ready",
]) root.addEventListener?.(eventName, syncIosKiosk);

installStyle("dm-beta12-room-color-lock-style", `
  html[data-dm-ios-kiosk="true"],html[data-dm-ios-kiosk="true"] body{
    width:100%!important;min-width:0!important;height:var(--dm-ios-kiosk-height,100dvh)!important;
    min-height:var(--dm-ios-kiosk-height,100dvh)!important;max-height:none!important;margin:0!important;
    overflow-x:hidden!important;overscroll-behavior:none!important;background:var(--primary-background-color,#f8fafc)!important
  }
  html[data-dm-ios-kiosk="true"] body{
    box-sizing:border-box!important;padding-top:max(env(safe-area-inset-top),0px)!important;
    padding-left:max(env(safe-area-inset-left),0px)!important;padding-right:max(env(safe-area-inset-right),0px)!important;
    -webkit-overflow-scrolling:touch!important
  }
  html[data-dm-ios-kiosk="true"] #bottomNav{padding-bottom:max(env(safe-area-inset-bottom),0px)!important}
`);

syncIosKiosk();
