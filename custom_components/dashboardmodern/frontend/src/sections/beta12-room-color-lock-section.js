import {
  ACTION_ICON_CATALOG,
  ROOM_CATALOG,
  actionCatalogMatch,
  roomCatalogMatch,
} from "../core/personalization-catalog.js";
import { clean, doc, installStyle, root } from "./shared.js";

// Final compatibility owner for quick-action, room and picker glyphs. The
// visible contract is one real DOM glyph only. Older repair layers may still
// replace children, but this owner never duplicates that child with a pseudo.
const STYLE_ID = "dm-beta12-room-color-lock-style";
const QUICK_OWNER_FLAG = "__dmBeta12ConfigAwareQuickActions";
const EDITOR_OWNER_FLAG = "__dmBeta12StableRoomRows";
const KIOSK_ATTR = "data-dm-ios-kiosk";

const ACTION_BUILTINS = Object.freeze({
  luci: "mdi:lightbulb",
  luci_group: "mdi:lightbulb-group",
  clima: "mdi:snowflake",
  antifurto: "mdi:shield-home",
  lavatrice: "mdi:washing-machine",
  toggle: "mdi:toggle-switch-outline",
  script: "mdi:script-text-play",
  scene: "mdi:movie-open",
});

const ROOM_GLYPHS = Object.freeze({
  living: "🛋️",
  kitchen: "🍳",
  bedroom: "🛏️",
  kids: "🧸",
  nursery: "👶",
  bathroom: "🚿",
  wc: "🚽",
  dining: "🍽️",
  office: "💻",
  guest: "🛏️",
  entrance: "🚪",
  hallway: "🚪",
  laundry: "🧺",
  pantry: "🥫",
  wardrobe: "👗",
  storage: "📦",
  balcony: "🌇",
  terrace: "🌤️",
  garage: "🚗",
  cellar: "🍷",
  attic: "🏠",
  utility: "🛠️",
  gym: "🏋️",
  media: "🎬",
  garden: "🌿",
  pool: "🏊",
});

const state = (root.__DASHBOARDMODERN_BETA12_FINAL_LOCK__ ||= {
  listeners: false,
  kioskHost: null,
  kioskHostCss: "",
  kioskFrame: null,
  kioskFrameCss: "",
  kioskViewportBound: false,
});

function directEmoji(value) {
  const token = clean(value);
  if (!token || token.startsWith("mdi:")) return "";
  return /[^\p{L}\p{N}\s:_-]/u.test(token) && token.length <= 12 ? token : "";
}

function actionGlyph(value) {
  const token = clean(value);
  const direct = directEmoji(token);
  if (direct) return direct;
  return actionCatalogMatch(token)?.glyph || "⭐";
}

function roomGlyph(value) {
  const token = clean(value);
  const direct = directEmoji(token);
  if (direct) return direct;
  const item = roomCatalogMatch(token);
  return ROOM_GLYPHS[item?.id] || "🏠";
}

function parseActionList(raw) {
  if (!raw) return [];
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(value) ? value : [];
  } catch (_error) {
    return [];
  }
}

function quickActionsFromRuntime() {
  const candidates = [];
  for (const host of [globalThis, root]) {
    if (!host) continue;
    try { candidates.push(host.localStorage?.getItem?.("cd_quick_actions")); } catch (_error) {}
    candidates.push(host._CD_CFG?.quickActions);
    candidates.push(host.CD_BAKED_CONFIG?.cd_quick_actions);
    candidates.push(host.CD_BAKED_CONFIG?.quickActions);
  }
  for (const candidate of candidates) {
    const actions = parseActionList(candidate);
    if (actions.length) return actions;
  }
  return [];
}

function tokenForAction(action = {}, target = null) {
  const configured = clean(action.icon);
  if (configured) return configured;
  const builtin = clean(action.builtin).toLowerCase();
  const type = clean(action.type).toLowerCase();
  const builtinToken = ACTION_BUILTINS[builtin]
    || ACTION_BUILTINS[type.replace(/^builtin_/, "")];
  if (builtinToken) return builtinToken;

  const rendered = clean(target?.textContent);
  if (rendered && rendered !== "⭐" && rendered !== "★") return rendered;
  return "mdi:star";
}

function makeGlyph(className, token, glyph) {
  const holder = doc.createElement("span");
  holder.className = className;
  holder.dataset.token = token;
  const visual = doc.createElement("span");
  visual.setAttribute("aria-hidden", "true");
  visual.textContent = glyph;
  holder.appendChild(visual);
  return holder;
}

function repairQuickActionsFromRuntime() {
  const nodes = [...(doc?.querySelectorAll?.("#qa-grid .qa-btn .icon") || [])];
  if (!nodes.length) return false;
  const actions = quickActionsFromRuntime();

  nodes.forEach((target, index) => {
    const action = actions[index] || {};
    const token = tokenForAction(action, target);
    const glyph = actionGlyph(token);
    const signature = `${token}|${glyph}`;

    target.dataset.dmBeta12DisplayGlyph = glyph;
    target.dataset.dmBeta12DisplayToken = token;
    target.dataset.dmBeta12ConfigAction = signature;
    target.dataset.dmActionStyle = "beta12-color";

    const children = [...target.children];
    const current = children.length === 1 && children[0].classList.contains("dm-beta12-action-glyph")
      ? children[0]
      : null;
    if (!current || clean(current.dataset.token) !== token || clean(current.textContent) !== glyph) {
      target.replaceChildren(makeGlyph("dm-beta12-action-glyph", token, glyph));
    }
  });
  return true;
}

function repairRoomRowsFromTokens() {
  const nodes = [...(doc?.querySelectorAll?.("#editor-modal #ed-body .dm-room-list-icon[data-room-icon]") || [])];
  nodes.forEach((target) => {
    const token = clean(target.dataset.roomIcon || "mdi:home");
    const glyph = roomGlyph(token);
    const signature = `${token}|${glyph}`;
    const children = [...target.children];
    const current = children.length === 1 && children[0].classList.contains("dm-beta12-room-glyph")
      ? children[0]
      : null;
    if (target.dataset.dmBeta12StableRoom === signature && current
      && clean(current.dataset.token) === token && clean(current.textContent) === glyph) return;

    target.replaceChildren(makeGlyph("dm-beta12-room-glyph", token, glyph));
    target.dataset.dmBeta12StableRoom = signature;
    target.dataset.dmBeta12Room = "true";
  });
  return nodes.length > 0;
}

function repairRoomModalPreview() {
  const modal = doc?.getElementById?.("dm-room-editor-modal");
  const input = modal?.querySelector?.('input[name="icon"]');
  const preview = modal?.querySelector?.("[data-room-icon-preview]");
  if (!modal || !input || !preview) return false;

  const refresh = () => {
    const token = clean(input.value || "mdi:home");
    const glyph = roomGlyph(token);
    const signature = `${token}|${glyph}`;
    const children = [...preview.children];
    const current = children.length === 1 && children[0].classList.contains("dm-beta12-room-glyph")
      ? children[0]
      : null;
    if (preview.dataset.dmBeta12StablePreview === signature && current
      && clean(current.dataset.token) === token && clean(current.textContent) === glyph) return;
    preview.replaceChildren(makeGlyph("dm-beta12-room-glyph", token, glyph));
    preview.dataset.dmBeta12StablePreview = signature;
    preview.dataset.dmBeta12Colored = "true";
  };

  if (input.dataset.dmBeta12StablePreviewBound !== "true") {
    input.dataset.dmBeta12StablePreviewBound = "true";
    input.addEventListener("input", refresh);
    input.addEventListener("change", refresh);
  }
  refresh();
  return true;
}

function repairVisualPicker() {
  const picker = doc?.getElementById?.("dm-visual-picker");
  if (!picker) return false;
  const kind = clean(picker.dataset.kind);
  if (kind !== "room" && kind !== "action") return false;
  const catalog = kind === "room" ? ROOM_CATALOG : ACTION_ICON_CATALOG;
  picker.dataset.dmBeta12Colored = "true";
  picker.dataset.dmSingleGlyphOwner = "true";
  picker.querySelectorAll(".dm-picker-option[data-index]").forEach((button) => {
    const index = Number.parseInt(button.dataset.index || "-1", 10);
    const item = index >= 0 ? catalog[index] : null;
    const target = button.querySelector(".dm-picker-visual");
    if (!item || !target) return;
    const token = clean(item.mdi || item.id);
    const glyph = kind === "room" ? (ROOM_GLYPHS[item.id] || "🏠") : (item.glyph || "⭐");
    const className = kind === "room" ? "dm-beta12-room-glyph" : "dm-beta12-action-glyph";
    const children = [...target.children];
    const current = children.length === 1 && children[0].classList.contains(className)
      ? children[0]
      : null;
    if (!current || clean(current.dataset.token) !== token || clean(current.textContent) !== glyph) {
      target.replaceChildren(makeGlyph(className, token, glyph));
    }
  });
  return true;
}

function repairStableVisuals() {
  repairQuickActionsFromRuntime();
  repairRoomRowsFromTokens();
  repairRoomModalPreview();
  repairVisualPicker();
}

function scheduleStableVisuals() {
  repairStableVisuals();
  root.queueMicrotask?.(repairStableVisuals);
  root.requestAnimationFrame?.(repairStableVisuals);
  root.setTimeout?.(repairStableVisuals, 0);
  // Older bounded compatibility work can still repaint after the synchronous
  // owner. These finite repairs preserve one child without introducing polling.
  root.setTimeout?.(repairStableVisuals, 120);
  root.setTimeout?.(repairStableVisuals, 960);
}

function wrapOwner(name, marker) {
  const current = root[name];
  if (typeof current !== "function" || current[marker]) return false;
  function wrapped(...args) {
    const result = current.apply(this, args);
    const repair = () => scheduleStableVisuals();
    if (result && typeof result.finally === "function") result.finally(repair);
    else repair();
    return result;
  }
  Object.assign(wrapped, current);
  wrapped[marker] = true;
  wrapped.__dmBeta12SynchronousPolish = true;
  wrapped.__dmPrevious = current;
  root[name] = wrapped;
  return true;
}

function installOwners() {
  wrapOwner("buildQuickActions", QUICK_OWNER_FLAG);
  wrapOwner("editorSwitch", EDITOR_OWNER_FLAG);
}

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

function installCompatibilityOwner() {
  installOwners();
  scheduleStableVisuals();
  syncIosKiosk();
}

for (const eventName of [
  "dashboardmodern:legacy-ready",
  "dashboardmodern:runtime-ready",
  "dashboardmodern:states-ready",
]) root.addEventListener?.(eventName, installCompatibilityOwner);

if (!state.listeners) {
  state.listeners = true;
  // Window capture runs before document-capture handlers that may stop immediate
  // propagation. The queued repair therefore sees a picker created later in the
  // same click and normalizes it before the browser paints the next frame.
  root.addEventListener?.("click", (event) => {
    if (event.target?.closest?.("#qa-grid .qa-btn,[data-dm-edit-kind='room'],#dm-room-editor-modal,.dm-visual-trigger,.dm-icon-preview-button,.dm-icon-picker,.dm-beta6-qa-icon-trigger,.dm-beta5-room-icon-trigger,#dm-visual-picker")) {
      scheduleStableVisuals();
    }
  }, true);
  root.addEventListener?.("popstate", syncIosKiosk);
  root.addEventListener?.("hashchange", syncIosKiosk);
  root.addEventListener?.("pageshow", syncIosKiosk);
}

installStyle(STYLE_ID, `
  #page-home #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]{
    position:relative!important;display:grid!important;place-items:center!important;
    overflow:visible!important;color:initial!important
  }
  #page-home #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]::before,
  #page-home #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]::after{
    content:none!important;display:none!important
  }
  #page-home #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]>.dm-beta12-action-glyph{
    display:grid!important;place-items:center!important;width:100%!important;height:100%!important;
    font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;
    font-size:42px!important;font-style:normal!important;font-weight:400!important;line-height:1!important;
    color:initial!important;filter:drop-shadow(0 5px 8px rgba(15,23,42,.12))!important
  }
  #page-home #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]>.dm-beta12-action-glyph>span{
    display:block!important;line-height:1!important
  }
  #page-home #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]>*:not(.dm-beta12-action-glyph){display:none!important}

  #editor-modal #ed-body .dm-room-list-icon[data-room-icon]{
    position:relative!important;display:grid!important;place-items:center!important;
    color:initial!important;overflow:visible!important
  }
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon]::before,
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon]::after{
    content:none!important;display:none!important
  }
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon]>.dm-beta12-room-glyph{
    display:grid!important;place-items:center!important;width:100%!important;height:100%!important;
    font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;
    font-size:31px!important;font-style:normal!important;font-weight:400!important;line-height:1!important;
    color:initial!important;filter:drop-shadow(0 5px 8px rgba(15,23,42,.12))!important
  }
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon]>.dm-beta12-room-glyph>span{
    display:block!important;line-height:1!important
  }
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon]>*:not(.dm-beta12-room-glyph){display:none!important}

  #dm-visual-picker[data-dm-single-glyph-owner="true"] .dm-picker-visual{
    position:relative!important;display:grid!important;place-items:center!important;color:initial!important
  }
  #dm-visual-picker[data-dm-single-glyph-owner="true"] .dm-picker-visual::before,
  #dm-visual-picker[data-dm-single-glyph-owner="true"] .dm-picker-visual::after{content:none!important;display:none!important}
  #dm-visual-picker[data-dm-single-glyph-owner="true"] .dm-picker-visual>*:not(.dm-beta12-room-glyph):not(.dm-beta12-action-glyph){display:none!important}
  #dm-visual-picker[data-dm-single-glyph-owner="true"] .dm-beta12-room-glyph,
  #dm-visual-picker[data-dm-single-glyph-owner="true"] .dm-beta12-action-glyph{
    display:grid!important;place-items:center!important;width:100%!important;height:100%!important;
    font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:38px!important;line-height:1!important;color:initial!important
  }

  #dm-room-editor-modal [data-room-icon-preview][data-dm-beta12-colored="true"]{
    display:grid!important;place-items:center!important;color:initial!important;overflow:visible!important
  }
  #dm-room-editor-modal [data-room-icon-preview]::before,
  #dm-room-editor-modal [data-room-icon-preview]::after{content:none!important;display:none!important}
  #dm-room-editor-modal [data-room-icon-preview]>.dm-beta12-room-glyph{
    display:grid!important;place-items:center!important;width:100%!important;height:100%!important;
    font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;
    font-size:38px!important;font-style:normal!important;font-weight:400!important;line-height:1!important;color:initial!important
  }
  #dm-room-editor-modal [data-room-icon-preview]>.dm-beta12-room-glyph>span{display:block!important;line-height:1!important}

  html[data-dm-ios-kiosk="true"],html[data-dm-ios-kiosk="true"] body{
    width:100%!important;min-width:0!important;height:var(--dm-ios-kiosk-height,100dvh)!important;
    min-height:var(--dm-ios-kiosk-height,100dvh)!important;max-height:none!important;margin:0!important;
    overflow-x:hidden!important;overscroll-behavior:none!important;background:var(--primary-background-color,#f8fafc)!important
  }
  html[data-dm-ios-kiosk="true"] body{
    box-sizing:border-box!important;
    padding-top:max(env(safe-area-inset-top),0px)!important;
    padding-left:max(env(safe-area-inset-left),0px)!important;
    padding-right:max(env(safe-area-inset-right),0px)!important;
    -webkit-overflow-scrolling:touch!important
  }
  html[data-dm-ios-kiosk="true"] #bottomNav{
    padding-bottom:max(env(safe-area-inset-bottom),0px)!important
  }
`);

installCompatibilityOwner();
