// DM-FIX-20260812B
import {
  ACTION_ICON_CATALOG,
  ROOM_CATALOG,
  actionCatalogMatch,
  directEmoji,
  roomGlyph,
} from "../core/personalization-catalog.js";
import {
  clean,
  dashboardStore,
  doc,
  esc,
  installStyle,
  readJson,
  root,
} from "./shared.js";

// beta.12: fixes four issues reproduced in the Home Assistant Android WebView:
// quick-action first-paint flicker, room artwork falling back to blue outlines,
// climate mode separation. The Pool page moved to its own scene owner, so the
// pool repairs that used to live here stood down with it.
// All repairs are bounded to the existing render owners; no polling or global
// MutationObserver is introduced here.
const KEY = "__DASHBOARDMODERN_BETA12_REAL_DEVICE_POLISH__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  listeners: false,
  storeUnsubscribe: null,
});


const ACTION_BUILTIN_TOKENS = Object.freeze({
  luci: "mdi:lightbulb",
  luci_group: "mdi:lightbulb-group",
  builtin_luci: "mdi:lightbulb",
  builtin_clima: "mdi:snowflake",
  clima: "mdi:snowflake",
  antifurto: "mdi:shield-home",
  builtin_antifurto: "mdi:shield-home",
  lavatrice: "mdi:washing-machine",
  builtin_lavatrice: "mdi:washing-machine",
  toggle: "mdi:toggle-switch-outline",
  script: "mdi:script-text-play",
  scene: "mdi:movie-open",
});

function nativeGlyphMarkup(glyph, className, token = "") {
  return `<span class="${className}" data-token="${esc(token)}"><span aria-hidden="true">${esc(glyph)}</span></span>`;
}


function actionToken(action = {}) {
  const configured = clean(action.icon);
  if (configured) return configured;
  const builtin = clean(action.builtin).toLowerCase();
  const type = clean(action.type).toLowerCase();
  return ACTION_BUILTIN_TOKENS[`builtin_${builtin}`]
    || ACTION_BUILTIN_TOKENS[builtin]
    || ACTION_BUILTIN_TOKENS[type]
    || "mdi:star";
}

function actionGlyphFromToken(value) {
  const direct = directEmoji(value);
  if (direct) return direct;
  const item = actionCatalogMatch(value);
  return item?.glyph || "⭐";
}

function configuredQuickActions() {
  const persisted = readJson("cd_quick_actions", []);
  if (Array.isArray(persisted) && persisted.length) return persisted;
  try {
    const values = root.getQuickActions?.();
    return Array.isArray(values) ? values : [];
  } catch (_error) {
    return [];
  }
}

function mergedRooms() {
  let canonical = [];
  try {
    const values = dashboardStore()?.getSection?.("rooms");
    if (Array.isArray(values)) canonical = values;
  } catch (_error) {}
  const legacy = readJson("cd_stanze", []);
  if (!Array.isArray(legacy) || !legacy.length) return canonical;
  return legacy.map((room, index) => {
    const id = clean(room?.id);
    const name = clean(room?.name).toLowerCase();
    const fallback = canonical.find((candidate) => id && clean(candidate?.id) === id)
      || canonical.find((candidate) => name && clean(candidate?.name).toLowerCase() === name)
      || canonical[index]
      || {};
    return { ...fallback, ...room };
  });
}

function repairQuickActionHome() {
  return Boolean(root.DashboardModernIconEngine?.syncQuickActions?.());
}

function repairQuickActionRows() {
  return Boolean(root.DashboardModernIconEngine?.syncEditor?.());
}

function repairRoomRows() {
  return Boolean(root.DashboardModernIconEngine?.syncEditor?.());
}

function repairRoomCards() {
  return Boolean(root.DashboardModernIconEngine?.syncEditor?.());
}

function decorateVisualPicker() {
  return Boolean(doc?.querySelector?.('#dm-visual-picker[data-dm-icon-engine="single-owner"]'));
}


function repairModalPreviews() {
  return Boolean(root.DashboardModernIconEngine?.syncEditor?.());
}

function repairClimateSwitch() {
  const page = doc?.getElementById?.("page-clima");
  const sw = page?.querySelector?.(".clima-page-mode-switch");
  const cold = doc?.getElementById?.("clima-page-mode-freddo");
  const warm = doc?.getElementById?.("clima-page-mode-caldo");
  if (!sw || !cold || !warm) return false;
  // Beta 12 pinned this switch open, on the reasoning that the two climate
  // families should stay explicit. On a house that has only air conditioners,
  // or only radiators, that left a tab which opens on nothing — so the switch
  // is shown when there is something to switch between, and not otherwise.
  // How many families are configured is the climate section's to know; this
  // stays the one owner of the property, because it is the one that pins it.
  const zones = page.querySelector(".dm-cl-shell")?.dataset.dmClZones;
  const single = zones === "0" || zones === "1";
  sw.style.setProperty("display", single ? "none" : "grid", "important");
  sw.dataset.dmBeta12Climate = "true";
  const coldActive = cold.classList.contains("active-freddo");
  const warmActive = warm.classList.contains("active-caldo");
  cold.setAttribute("aria-pressed", String(coldActive));
  warm.setAttribute("aria-pressed", String(warmActive));
  return true;
}

function runImmediate() {
  repairQuickActionHome();
  repairQuickActionRows();
  repairRoomRows();
  repairRoomCards();
  decorateVisualPicker();
  repairModalPreviews();
  repairClimateSwitch();
}

function runScheduled() {
  state.frame = 0;
  ensureOwners();
  runImmediate();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(runScheduled) || root.setTimeout?.(runScheduled, 0) || 0;
}

function wrapSyncOwner(name) {
  const current = root[name];
  if (typeof current !== "function" || current.__dmBeta12SynchronousPolish) return false;
  function wrapped(...args) {
    const result = current.apply(this, args);
    const repair = () => {
      // Synchronous for classic render owners: this is what removes the visible
      // vector->emoji first-paint swap on mobile. rAF remains only a fallback for
      // nested work that deliberately completes later.
      runImmediate();
      schedule();
    };
    if (result && typeof result.finally === "function") result.finally(repair);
    else repair();
    return result;
  }
  Object.assign(wrapped, current);
  wrapped.__dmBeta12SynchronousPolish = true;
  wrapped.__dmPrevious = current;
  root[name] = wrapped;
  return true;
}

function ensureOwners() {
  for (const name of [
    "buildQuickActions",
    "render",
    "editorSwitch",
    "edQaTypeChanged",
    "edAddQA",
    "buildTempCards",
    "renderTemperature",
    "buildClimaCards",
    "setClimaPageMode",
  ]) wrapSyncOwner(name);
}

function subscribeStore() {
  if (state.storeUnsubscribe) return;
  const store = dashboardStore();
  if (typeof store?.subscribe !== "function") return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (["rooms", "snapshot"].includes(change?.section)) {
      runImmediate();
      schedule();
    }
  });
}

function installListeners() {
  if (state.listeners || !doc) return;
  state.listeners = true;
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
  ]) root.addEventListener?.(eventName, () => {
    ensureOwners();
    subscribeStore();
    runImmediate();
    schedule();
  });

  doc.addEventListener("click", (event) => {
    const relevant = event.target?.closest?.(
      "#dm-visual-picker,#dm-room-editor-modal,#dm-action-editor-modal,.dm-beta6-qa-icon-trigger,.dm-beta5-room-icon-trigger,.clima-page-mode-switch",
    );
    if (!relevant) return;
    root.queueMicrotask?.(runImmediate);
    schedule();
  }, true);
}

function installStyles() {
  installStyle("dm-beta12-real-device-polish-style", `
    .dm-beta12-room-glyph,.dm-beta12-action-glyph{
      display:grid!important;place-items:center!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;
      font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-style:normal!important;font-weight:400!important;line-height:1!important;
      visibility:visible!important;opacity:1!important;color:initial!important
    }
    .dm-beta12-room-glyph>span,.dm-beta12-action-glyph>span{display:block!important;line-height:1!important;filter:drop-shadow(0 5px 8px rgba(15,23,42,.12))!important}
    #qa-grid .qa-btn .dm-beta12-action-glyph{font-size:34px!important}
    #editor-modal .dm-beta7-existing-action-icon .dm-beta12-action-glyph,#editor-modal .dm-beta6-qa-icon-trigger .dm-beta12-action-glyph{font-size:29px!important}
    #editor-modal .dm-room-list-icon[data-dm-beta12-room="true"]{
      display:grid!important;place-items:center!important;overflow:visible!important;background:linear-gradient(145deg,rgba(224,247,255,.98),rgba(240,249,255,.82))!important;
      border:1px solid rgba(56,189,248,.18)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 7px 16px rgba(14,165,233,.08)!important;color:initial!important
    }
    #editor-modal .dm-room-list-icon .dm-beta12-room-glyph{font-size:31px!important}
    .dm-temperature-card-icon .dm-beta12-room-glyph{font-size:29px!important}
    #dm-visual-picker[data-dm-beta12-colored="true"] .dm-picker-visual{
      display:grid!important;place-items:center!important;min-height:58px!important;color:initial!important
    }
    #dm-visual-picker[data-kind="room"] .dm-picker-visual .dm-beta12-room-glyph,
    #dm-visual-picker[data-kind="action"] .dm-picker-visual .dm-beta12-action-glyph{font-size:38px!important}
    #dm-visual-picker[data-dm-beta12-colored="true"] .dm-picker-option{
      background:linear-gradient(180deg,var(--card-background-color,#fff),color-mix(in srgb,var(--info-color,#0ea5e9) 3%,var(--card-background-color,#fff)))!important
    }
    #dm-room-editor-modal [data-room-icon-preview][data-dm-beta12-colored="true"] .dm-beta12-room-glyph,
    #dm-action-editor-modal [data-action-icon-preview][data-dm-beta12-colored="true"] .dm-beta12-action-glyph{font-size:38px!important}

    /* Clima beta.12: segmented control always visible and visually separates
       cooling from heating, matching the supplied real-device reference. */
    #page-clima .clima-page-mode-switch[data-dm-beta12-climate="true"]{
      box-sizing:border-box!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;align-items:stretch!important;
      width:min(100%,900px)!important;min-width:0!important;margin:18px auto 30px!important;padding:6px!important;gap:4px!important;
      border:1px solid color-mix(in srgb,#94a3b8 22%,transparent)!important;border-radius:34px!important;
      background:color-mix(in srgb,#e8eef7 74%,var(--card-background-color,#fff))!important;box-shadow:inset 0 1px 2px rgba(15,23,42,.04),0 10px 28px rgba(15,23,42,.05)!important;overflow:hidden!important
    }
    #page-clima .clima-page-mode-switch[data-dm-beta12-climate="true"] .clima-page-mode-btn{
      box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:14px!important;width:100%!important;min-width:0!important;min-height:94px!important;
      margin:0!important;padding:14px 18px!important;border:0!important;border-radius:28px!important;background:transparent!important;color:#64748b!important;
      font-family:"Oswald",system-ui,sans-serif!important;font-size:22px!important;font-weight:700!important;letter-spacing:1.7px!important;text-transform:uppercase!important;box-shadow:none!important;transition:background .2s ease,color .2s ease,box-shadow .2s ease!important
    }
    #page-clima .clima-page-mode-switch .clima-page-mode-btn .icon{font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:34px!important;line-height:1!important}
    #page-clima #clima-page-mode-freddo.active-freddo{
      background:linear-gradient(135deg,#e0f7ff,#bdeaff)!important;color:#036995!important;box-shadow:0 8px 24px rgba(14,165,233,.16),inset 0 1px 0 rgba(255,255,255,.85)!important
    }
    #page-clima #clima-page-mode-caldo.active-caldo{
      background:linear-gradient(135deg,#fff2e6,#ffd9c2)!important;color:#c2410c!important;box-shadow:0 8px 24px rgba(249,115,22,.15),inset 0 1px 0 rgba(255,255,255,.88)!important
    }

    @media(max-width:760px){
      /* Il selettore Caldo/Freddo sul telefono lo misura beta16: le nove misure
         che stavano qui — margine, imbottitura, raggio, corpo, spaziatura —
         perdevano tutte contro le sue, scritte piu' avanti nella cascata. */
      #page-clima .clima-page-mode-switch .clima-page-mode-btn .icon{font-size:27px!important}
      #dm-visual-picker[data-kind="room"] .dm-picker-visual .dm-beta12-room-glyph,#dm-visual-picker[data-kind="action"] .dm-picker-visual .dm-beta12-action-glyph{font-size:34px!important}
    }
  `);
}

function install() {
  if (state.installed || !doc) return;
  state.installed = true;
  installStyles();
  installListeners();
  ensureOwners();
  subscribeStore();
  runImmediate();
  schedule();
}

install();
