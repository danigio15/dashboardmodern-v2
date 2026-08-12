import {
  ACTION_ICON_CATALOG,
  ROOM_CATALOG,
  actionCatalogMatch,
  roomCatalogMatch,
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
// climate mode separation and the pool scene reading as a generic blue panel.
// All repairs are bounded to the existing render owners; no polling or global
// MutationObserver is introduced here.
const KEY = "__DASHBOARDMODERN_BETA12_REAL_DEVICE_POLISH__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  listeners: false,
  storeUnsubscribe: null,
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

function directEmoji(value) {
  const token = clean(value);
  if (!token || token.startsWith("mdi:")) return "";
  // Configured emoji/glyphs remain authoritative. Textual room names are not
  // treated as glyphs, otherwise legacy names would be rendered literally.
  return /[^\p{L}\p{N}\s:_-]/u.test(token) && token.length <= 12 ? token : "";
}

function roomGlyph(value) {
  const direct = directEmoji(value);
  if (direct) return direct;
  const item = roomCatalogMatch(value);
  return ROOM_GLYPHS[item?.id] || "🏠";
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
  const actions = configuredQuickActions();
  const nodes = [...(doc?.querySelectorAll?.("#qa-grid .qa-btn .icon") || [])];
  nodes.forEach((target, index) => {
    const action = actions[index] || {};
    const token = actionToken(action);
    const glyph = actionGlyphFromToken(token);
    const signature = `${token}|${glyph}`;
    if (target.dataset.dmBeta12Action === signature && target.querySelector(".dm-beta12-action-glyph")) return;
    target.dataset.dmBeta12Action = signature;
    target.dataset.dmActionStyle = "beta12-color";
    target.innerHTML = nativeGlyphMarkup(glyph, "dm-beta12-action-glyph", token);
  });
  return nodes.length > 0;
}

function repairQuickActionRows() {
  const actions = configuredQuickActions();
  const edits = [...(doc?.querySelectorAll?.('#ed-body [data-dm-edit-kind="action"][data-dm-edit-index]') || [])];
  edits.forEach((edit) => {
    const row = edit.closest(".ed-row");
    if (!row) return;
    const index = Number.parseInt(edit.dataset.dmEditIndex || "-1", 10);
    const action = index >= 0 ? actions[index] || {} : {};
    const token = actionToken(action);
    let target = row.querySelector(".dm-beta7-existing-action-icon");
    if (!target) {
      target = doc.createElement("span");
      target.className = "dm-beta7-existing-action-icon";
      row.prepend(target);
    }
    target.dataset.dmBeta12Action = token;
    target.innerHTML = nativeGlyphMarkup(actionGlyphFromToken(token), "dm-beta12-action-glyph", token);
  });

  const trigger = doc?.querySelector?.("#ed-body .dm-beta6-qa-icon-trigger");
  const iconInput = doc?.getElementById?.("ed-qa-icon");
  const type = doc?.getElementById?.("ed-qa-type");
  if (trigger && iconInput && type) {
    const rawType = clean(type.value).toLowerCase();
    const action = {
      type: rawType.startsWith("builtin_") ? "builtin" : rawType,
      builtin: rawType.startsWith("builtin_") ? rawType.slice(8) : "",
      icon: clean(iconInput.value),
    };
    const token = actionToken(action);
    trigger.dataset.dmBeta12Action = token;
    trigger.innerHTML = nativeGlyphMarkup(actionGlyphFromToken(token), "dm-beta12-action-glyph", token);
  }
  return edits.length > 0 || Boolean(trigger);
}

function repairRoomRows() {
  const rooms = mergedRooms();
  if (!rooms.length) return false;
  const edits = [...(doc?.querySelectorAll?.('#ed-body [data-dm-edit-kind="room"][data-dm-edit-index]') || [])];
  edits.forEach((edit) => {
    const row = edit.closest(".ed-row");
    if (!row) return;
    const index = Number.parseInt(edit.dataset.dmEditIndex || "-1", 10);
    const room = index >= 0 ? rooms[index] : null;
    if (!room) return;
    row.classList.add("dm-beta12-room-row");
    let target = row.querySelector(":scope > .dm-room-list-icon");
    if (!target) {
      target = doc.createElement("span");
      target.className = "dm-room-list-icon";
      row.prepend(target);
    }
    const token = clean(room.icon || room.name || "mdi:home");
    target.dataset.roomIcon = token;
    target.dataset.dmBeta12Room = "true";
    target.innerHTML = nativeGlyphMarkup(roomGlyph(token), "dm-beta12-room-glyph", token);
  });
  return edits.length > 0;
}

function repairRoomCards() {
  const rooms = mergedRooms();
  if (!rooms.length) return false;
  doc?.querySelectorAll?.(".dm-temperature-card[data-room-id]").forEach((card) => {
    const room = rooms.find((item) => clean(item?.id) === clean(card.dataset.roomId));
    const target = card.querySelector(".dm-temperature-card-icon");
    if (!room || !target) return;
    const token = clean(room.icon || room.name || "mdi:home");
    target.dataset.roomIcon = token;
    target.innerHTML = nativeGlyphMarkup(roomGlyph(token), "dm-beta12-room-glyph", token);
  });
  return true;
}

function decorateVisualPicker() {
  const picker = doc?.getElementById?.("dm-visual-picker");
  if (!picker) return false;
  const kind = clean(picker.dataset.kind);
  if (kind !== "room" && kind !== "action") return false;
  const catalog = kind === "room" ? ROOM_CATALOG : ACTION_ICON_CATALOG;
  picker.dataset.dmBeta12Colored = "true";
  picker.querySelectorAll(".dm-picker-option[data-index]").forEach((button) => {
    const index = Number.parseInt(button.dataset.index || "-1", 10);
    const item = index >= 0 ? catalog[index] : null;
    const target = button.querySelector(".dm-picker-visual");
    if (!item || !target) return;
    const glyph = kind === "room" ? (ROOM_GLYPHS[item.id] || "🏠") : (item.glyph || "⭐");
    const token = item.mdi || item.id;
    target.innerHTML = nativeGlyphMarkup(glyph, kind === "room" ? "dm-beta12-room-glyph" : "dm-beta12-action-glyph", token);
  });
  return true;
}

function bindPreview(input, preview, kind) {
  if (!input || !preview) return false;
  const refresh = () => {
    const token = clean(input.value || (kind === "room" ? "mdi:home" : "mdi:star"));
    const glyph = kind === "room" ? roomGlyph(token) : actionGlyphFromToken(token);
    preview.dataset.dmBeta12Colored = "true";
    preview.innerHTML = nativeGlyphMarkup(glyph, kind === "room" ? "dm-beta12-room-glyph" : "dm-beta12-action-glyph", token);
  };
  if (preview.dataset.dmBeta12Bound !== "true") {
    preview.dataset.dmBeta12Bound = "true";
    input.addEventListener("input", refresh);
    input.addEventListener("change", refresh);
  }
  refresh();
  return true;
}

function repairModalPreviews() {
  const roomModal = doc?.getElementById?.("dm-room-editor-modal");
  if (roomModal) bindPreview(roomModal.querySelector('input[name="icon"]'), roomModal.querySelector("[data-room-icon-preview]"), "room");
  const actionModal = doc?.getElementById?.("dm-action-editor-modal");
  if (actionModal) {
    const form = actionModal.querySelector("form");
    bindPreview(form?.elements?.icon, form?.querySelector?.("[data-action-icon-preview]"), "action");
  }
  return Boolean(roomModal || actionModal);
}

function repairClimateSwitch() {
  const page = doc?.getElementById?.("page-clima");
  const sw = page?.querySelector?.(".clima-page-mode-switch");
  const cold = doc?.getElementById?.("clima-page-mode-freddo");
  const warm = doc?.getElementById?.("clima-page-mode-caldo");
  if (!sw || !cold || !warm) return false;
  // Legacy intentionally hid the switch when one family was empty. The page is
  // clearer when the two climate families remain explicit, exactly as the Home
  // Assistant reference supplied for beta.12.
  sw.style.setProperty("display", "grid", "important");
  sw.dataset.dmBeta12Climate = "true";
  const coldActive = cold.classList.contains("active-freddo");
  const warmActive = warm.classList.contains("active-caldo");
  cold.setAttribute("aria-pressed", String(coldActive));
  warm.setAttribute("aria-pressed", String(warmActive));
  return true;
}

function poolSceneMarkup() {
  return `<div class="dm-beta12-pool-scene" aria-hidden="true">
    <div class="dm-beta12-pool-basin">
      <span class="dm-beta12-pool-caustics"></span>
      <span class="dm-beta12-pool-lane lane-a"></span>
      <span class="dm-beta12-pool-lane lane-b"></span>
      <span class="dm-beta12-pool-steps"><i></i><i></i><i></i></span>
      <span class="dm-beta12-pool-ladder"><i></i><i></i><i></i></span>
      <span class="dm-beta12-pool-depth dm-shallow">1.2 m</span>
      <span class="dm-beta12-pool-depth dm-deep">1.8 m</span>
    </div>
  </div>`;
}

function decoratePool() {
  const hero = doc?.querySelector?.("#page-piscina #pool-wrap .pool-hero");
  if (!hero) return false;
  if (!hero.querySelector(":scope > .dm-beta12-pool-scene")) hero.insertAdjacentHTML("afterbegin", poolSceneMarkup());
  hero.dataset.dmBeta12Pool = "true";
  const pump = hero.querySelector('.pool-tg[data-act="pump"]');
  const heat = hero.querySelector('.pool-tg[data-act="heat"]');
  const light = hero.querySelector('.pool-tg[data-act="light"]');
  pump?.setAttribute("data-dm-pool-equipment", "pump");
  heat?.setAttribute("data-dm-pool-equipment", "heat");
  light?.setAttribute("data-dm-pool-equipment", "light");
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
  decoratePool();
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
    "renderPiscina",
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
      "#dm-visual-picker,#dm-room-editor-modal,#dm-action-editor-modal,.dm-beta6-qa-icon-trigger,.dm-beta5-room-icon-trigger,.clima-page-mode-switch,#page-piscina",
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

    /* Piscina beta.12: a top-down tiled basin rather than a generic blue panel. */
    #page-piscina #pool-wrap{width:min(100%,1000px)!important;max-width:1000px!important}
    #page-piscina .pool-hero[data-dm-beta12-pool="true"]{
      position:relative!important;min-height:438px!important;padding:0!important;overflow:hidden!important;border-radius:30px!important;
      border:1px solid rgba(14,165,233,.18)!important;background:linear-gradient(145deg,#fbfdff 0%,#f7fbff 58%,#f2f7fb 100%)!important;
      box-shadow:0 18px 45px rgba(15,23,42,.09),inset 0 1px 0 rgba(255,255,255,.92)!important
    }
    #page-piscina .pool-hero[data-dm-beta12-pool="true"]::before,#page-piscina .pool-hero[data-dm-beta12-pool="true"]::after{content:none!important;display:none!important}
    #page-piscina .pool-hero[data-dm-beta12-pool="true"] .pool-wave{display:none!important}
    #page-piscina .dm-beta12-pool-scene{position:absolute!important;inset:0!important;z-index:1!important;pointer-events:none!important}
    #page-piscina .dm-beta12-pool-basin{
      position:absolute!important;left:5%!important;right:31%!important;top:68px!important;bottom:54px!important;overflow:hidden!important;border-radius:34px 48px 38px 30px!important;
      border:10px solid #dff6fb!important;outline:2px solid rgba(14,165,233,.24)!important;
      background:
        radial-gradient(ellipse at 18% 18%,rgba(255,255,255,.48) 0 4%,transparent 20%),
        radial-gradient(ellipse at 70% 72%,rgba(255,255,255,.24),transparent 30%),
        repeating-linear-gradient(112deg,rgba(255,255,255,.14) 0 2px,transparent 2px 34px),
        linear-gradient(145deg,#43d5e5 0%,#10b9df 42%,#0788cf 100%)!important;
      box-shadow:inset 0 0 0 4px rgba(255,255,255,.36),inset 0 -34px 54px rgba(3,105,161,.22),0 18px 32px rgba(14,165,233,.18)!important
    }
    #page-piscina .dm-beta12-pool-basin::before{
      content:""!important;display:block!important;position:absolute!important;inset:7px!important;border-radius:24px 38px 28px 20px!important;opacity:.52!important;
      background-image:linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px)!important;background-size:30px 30px!important
    }
    #page-piscina .dm-beta12-pool-basin::after{
      content:""!important;display:block!important;position:absolute!important;inset:-15% -8%!important;opacity:.72!important;
      background:radial-gradient(ellipse at 20% 35%,transparent 0 16%,rgba(255,255,255,.22) 17% 18%,transparent 19% 100%),radial-gradient(ellipse at 66% 62%,transparent 0 13%,rgba(255,255,255,.18) 14% 15%,transparent 16% 100%)!important;transform:rotate(-8deg)!important
    }
    #page-piscina .dm-beta12-pool-caustics{position:absolute!important;inset:0!important;background:linear-gradient(165deg,rgba(255,255,255,.22),transparent 32%,rgba(255,255,255,.08) 54%,transparent 76%)!important}
    #page-piscina .dm-beta12-pool-lane{position:absolute!important;left:14%!important;right:12%!important;height:2px!important;background:rgba(236,254,255,.48)!important;box-shadow:0 0 8px rgba(255,255,255,.4)!important}
    #page-piscina .dm-beta12-pool-lane.lane-a{top:38%!important}#page-piscina .dm-beta12-pool-lane.lane-b{top:67%!important}
    #page-piscina .dm-beta12-pool-steps{position:absolute!important;left:15px!important;bottom:18px!important;display:grid!important;gap:5px!important;width:78px!important}
    #page-piscina .dm-beta12-pool-steps i{display:block!important;height:10px!important;border-radius:0 12px 12px 0!important;background:rgba(224,247,250,.70)!important;border:1px solid rgba(255,255,255,.62)!important}
    #page-piscina .dm-beta12-pool-steps i:nth-child(2){width:63px!important}#page-piscina .dm-beta12-pool-steps i:nth-child(3){width:47px!important}
    #page-piscina .dm-beta12-pool-ladder{position:absolute!important;right:18px!important;top:20px!important;width:42px!important;height:82px!important;border-left:4px solid rgba(226,245,250,.92)!important;border-right:4px solid rgba(226,245,250,.92)!important;border-radius:18px 18px 0 0!important}
    #page-piscina .dm-beta12-pool-ladder i{display:block!important;width:100%!important;height:3px!important;margin-top:17px!important;background:rgba(226,245,250,.92)!important}
    #page-piscina .dm-beta12-pool-depth{position:absolute!important;bottom:12px!important;padding:3px 7px!important;border-radius:8px!important;background:rgba(3,105,161,.34)!important;color:#ecfeff!important;font:800 10px/1 system-ui!important;letter-spacing:.4px!important;text-shadow:0 1px 2px rgba(3,105,161,.35)!important}
    #page-piscina .dm-beta12-pool-depth.dm-shallow{left:105px!important}#page-piscina .dm-beta12-pool-depth.dm-deep{right:24px!important}
    #page-piscina .pool-hero[data-dm-beta12-pool="true"]>.pool-temp{position:absolute!important;z-index:6!important;left:9%!important;top:102px!important;display:grid!important;place-items:center!important;width:118px!important;height:118px!important;margin:0!important;border:1px solid rgba(255,255,255,.76)!important;border-radius:50%!important;background:rgba(3,105,161,.22)!important;color:#fff!important;backdrop-filter:blur(8px)!important;-webkit-backdrop-filter:blur(8px)!important;text-shadow:0 2px 10px rgba(3,105,161,.34)!important;box-shadow:0 10px 24px rgba(3,105,161,.14)!important}
    #page-piscina .pool-hero[data-dm-beta12-pool="true"]>.pool-sub{position:absolute!important;z-index:6!important;left:7.5%!important;top:230px!important;margin:0!important;color:#fff!important;font-weight:900!important;text-shadow:0 2px 8px rgba(3,105,161,.52)!important}
    #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"]>.pool-chips{position:absolute!important;inset:0!important;z-index:7!important;display:block!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important;pointer-events:none!important}
    #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg{pointer-events:auto!important;position:absolute!important;box-sizing:border-box!important;display:grid!important;min-height:66px!important;border-radius:20px!important;background:rgba(255,255,255,.94)!important;box-shadow:0 10px 24px rgba(15,23,42,.10)!important;backdrop-filter:blur(10px)!important;-webkit-backdrop-filter:blur(10px)!important}
    #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg[data-act="pump"]{right:3%!important;top:112px!important;width:25%!important}
    #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg[data-act="heat"]{right:3%!important;top:190px!important;width:25%!important}
    #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg[data-act="light"]{left:8%!important;bottom:75px!important;width:31%!important;border-color:rgba(245,158,11,.34)!important}
    #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg.on{background:linear-gradient(135deg,#ecfeff,#dff7ff)!important;border-color:rgba(14,165,233,.38)!important;box-shadow:0 10px 24px rgba(14,165,233,.16)!important}

    @media(max-width:760px){
      #page-clima .clima-page-mode-switch[data-dm-beta12-climate="true"]{margin:14px auto 22px!important;padding:5px!important;border-radius:26px!important}
      #page-clima .clima-page-mode-switch[data-dm-beta12-climate="true"] .clima-page-mode-btn{min-height:72px!important;padding:10px 8px!important;gap:9px!important;border-radius:21px!important;font-size:16px!important;letter-spacing:1.2px!important}
      #page-clima .clima-page-mode-switch .clima-page-mode-btn .icon{font-size:27px!important}
      #page-piscina .pool-hero[data-dm-beta12-pool="true"]{min-height:410px!important;border-radius:25px!important}
      #page-piscina .dm-beta12-pool-basin{left:5%!important;right:5%!important;top:48px!important;bottom:138px!important;border-width:8px!important;border-radius:27px 35px 29px 24px!important}
      #page-piscina .pool-hero[data-dm-beta12-pool="true"]>.pool-temp{left:8%!important;top:69px!important;width:88px!important;height:88px!important;font-size:clamp(20px,7vw,31px)!important}
      #page-piscina .pool-hero[data-dm-beta12-pool="true"]>.pool-sub{box-sizing:border-box!important;left:7%!important;top:164px!important;width:126px!important;max-width:34%!important;margin:0!important;padding:6px 8px!important;border:1px solid rgba(255,255,255,.46)!important;border-radius:11px!important;background:rgba(3,105,161,.32)!important;color:#fff!important;font-size:10.5px!important;font-weight:850!important;line-height:1.2!important;text-align:center!important;white-space:normal!important;text-shadow:0 1px 5px rgba(3,105,161,.48)!important;backdrop-filter:blur(6px)!important;-webkit-backdrop-filter:blur(6px)!important}
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"]>.pool-chips{left:5%!important;right:5%!important;top:auto!important;bottom:18px!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;width:auto!important;max-width:none!important;min-width:0!important;height:auto!important;pointer-events:auto!important}
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg{position:static!important;display:grid!important;place-items:center!important;width:100%!important;max-width:none!important;min-width:0!important;min-height:60px!important;margin:0!important;padding:8px 6px!important;border-radius:17px!important;text-align:center!important;overflow:hidden!important}
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg[data-act="pump"],
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg[data-act="heat"],
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg[data-act="light"]{position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important;max-width:none!important;min-width:0!important;margin:0!important}
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg[data-act="light"]{grid-column:auto!important;border-color:rgba(245,158,11,.34)!important}
      #page-piscina .dm-beta12-pool-depth{font-size:9px!important}.dm-beta12-pool-ladder{transform:scale(.82)!important;transform-origin:top right!important}
      #dm-visual-picker[data-kind="room"] .dm-picker-visual .dm-beta12-room-glyph,#dm-visual-picker[data-kind="action"] .dm-picker-visual .dm-beta12-action-glyph{font-size:34px!important}
    }
    @media(max-width:390px){
      #page-piscina .pool-hero[data-dm-beta12-pool="true"]{min-height:474px!important}
      #page-piscina .dm-beta12-pool-basin{bottom:204px!important}
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"]>.pool-chips{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg[data-act="light"]{grid-column:auto!important}
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
