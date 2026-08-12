import { roomCatalogMatch } from "../core/personalization-catalog.js";
import {
  clean,
  dashboardStore,
  doc,
  english,
  installStyle,
  readJson,
  root,
} from "./shared.js";

// beta.14 real-device hotfix.
//
// The build-info module is evaluated before DashboardStore.migrate(), so capture
// the legacy room projection immediately. This preserves the last valid room
// icon/temperature fields if an older dm_dashboard_state would otherwise rewrite
// cd_stanze during startup. Recovery is conservative: only missing canonical
// fields are restored, and missing rooms are appended.
const KEY = "__DASHBOARDMODERN_BETA14_REAL_DEVICE_HOTFIX__";
const capturedRooms = (() => {
  const value = readJson("cd_stanze", []);
  return Array.isArray(value) ? value.map((room) => ({ ...room })) : [];
})();
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  frame: 0,
  recovering: false,
  bootRecovered: false,
  capturedRooms,
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
const ROOM_FIELDS = Object.freeze(["name", "icon", "floor", "temp", "hum", "rgb"]);

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function roomIdentity(room, index) {
  const id = clean(room?.id);
  if (id) return `id:${id}`;
  const name = clean(room?.name).toLowerCase();
  return name ? `name:${name}` : `index:${index}`;
}

function matchingRoom(values, room, index) {
  const id = clean(room?.id);
  const name = clean(room?.name).toLowerCase();
  return values.find((candidate) => id && clean(candidate?.id) === id)
    || values.find((candidate) => name && clean(candidate?.name).toLowerCase() === name)
    || values[index]
    || null;
}

export function recoverRoomSnapshot(canonical = [], legacy = []) {
  const current = Array.isArray(canonical) ? canonical : [];
  const fallback = Array.isArray(legacy) ? legacy : [];
  if (!current.length) return fallback.map((room) => ({ ...room }));
  if (!fallback.length) return current.map((room) => ({ ...room }));

  const recovered = current.map((room, index) => {
    const old = matchingRoom(fallback, room, index);
    if (!old) return { ...room };
    const next = { ...room };
    ROOM_FIELDS.forEach((field) => {
      if (!clean(next[field]) && clean(old[field])) next[field] = old[field];
    });
    if (!next.metadata && old.metadata) next.metadata = { ...old.metadata };
    return next;
  });

  const known = new Set(recovered.map(roomIdentity));
  fallback.forEach((room, index) => {
    const identity = roomIdentity(room, index);
    if (known.has(identity)) return;
    recovered.push({ ...room });
    known.add(identity);
  });
  return recovered;
}

function canonicalRooms() {
  try {
    const values = dashboardStore()?.getSection?.("rooms");
    return Array.isArray(values) ? values : [];
  } catch (_error) {
    return [];
  }
}

function currentLegacyRooms() {
  const values = readJson("cd_stanze", []);
  return Array.isArray(values) ? values : [];
}

function resolvedRooms() {
  const canonical = canonicalRooms();
  const current = currentLegacyRooms();
  // A live legacy write that differs from the canonical projection is the edit
  // the user has just made. Otherwise prefer canonical and use the captured
  // pre-migration snapshot only to fill data that disappeared at boot.
  const base = current.length && !same(current, canonical)
    ? recoverRoomSnapshot(current, canonical)
    : canonical;
  return recoverRoomSnapshot(base, state.capturedRooms);
}

function reconcileRooms() {
  const store = dashboardStore();
  if (!store || state.recovering) return false;
  const canonical = canonicalRooms();
  const current = currentLegacyRooms();
  let next = canonical;

  if (!state.bootRecovered) {
    next = recoverRoomSnapshot(canonical, state.capturedRooms);
    state.bootRecovered = true;
  }
  // After startup, a legacy edit is authoritative until DashboardStore's write
  // bridge has reconciled it. This closes the small real-device race visible
  // when editing a room and immediately reopening Temperature/Rooms.
  if (current.length && !same(current, canonical) && state.bootRecovered)
    next = recoverRoomSnapshot(current, canonical);

  if (same(next, canonical)) return false;
  state.recovering = true;
  Promise.resolve(store.replaceSection?.("rooms", next))
    .catch((error) => root.console?.error?.("[DashboardModern] beta14 room recovery", error))
    .finally(() => {
      state.recovering = false;
      root.buildTempCards?.();
      root.renderTemperature?.();
      root.cdFillRoomSelects?.();
      schedule();
    });
  return true;
}

function directEmoji(value) {
  const token = clean(value);
  if (!token || token.startsWith("mdi:")) return "";
  return /[^\p{L}\p{N}\s:_-]/u.test(token) && token.length <= 12 ? token : "";
}

function roomGlyph(value) {
  const token = clean(value);
  const direct = directEmoji(token);
  if (direct) return direct;
  const item = roomCatalogMatch(token);
  return ROOM_GLYPHS[item?.id] || "🏠";
}

function setRoomGlyph(target, token) {
  if (!target) return false;
  const normalized = clean(token || "mdi:home") || "mdi:home";
  const glyph = roomGlyph(normalized);
  const existing = target.querySelector(":scope > .dm-beta12-room-glyph");
  if (
    target.children.length !== 1
    || !existing
    || clean(existing.dataset.token) !== normalized
    || clean(existing.textContent) !== glyph
    || existing.querySelector("svg,ha-icon")
  ) {
    const holder = doc.createElement("span");
    holder.className = "dm-beta12-room-glyph";
    holder.dataset.token = normalized;
    const visual = doc.createElement("span");
    visual.setAttribute("aria-hidden", "true");
    visual.textContent = glyph;
    holder.append(visual);
    target.replaceChildren(holder);
  }
  target.dataset.roomIcon = normalized;
  target.dataset.dmBeta12Room = "true";
  target.dataset.dmSingleGlyphOwner = "true";
  return true;
}

function repairRoomRows() {
  const rooms = resolvedRooms();
  if (!rooms.length) return false;
  doc?.querySelectorAll?.('#editor-modal #ed-body [data-dm-edit-kind="room"][data-dm-edit-index]').forEach((edit) => {
    const index = Number.parseInt(edit.dataset.dmEditIndex || "-1", 10);
    const room = index >= 0 ? rooms[index] : null;
    const row = edit.closest(".ed-row");
    if (!room || !row) return;
    let target = row.querySelector(":scope > .dm-room-list-icon");
    if (!target) {
      target = doc.createElement("span");
      target.className = "dm-room-list-icon";
      row.prepend(target);
    }
    setRoomGlyph(target, room.icon || room.name || "mdi:home");
  });
  return true;
}

function repairTemperatureRoomIcons() {
  const rooms = resolvedRooms();
  doc?.querySelectorAll?.("#temp-grid .temp-card[data-room-id]").forEach((card, index) => {
    const room = rooms.find((item) => clean(item?.id) === clean(card.dataset.roomId)) || rooms[index];
    const target = card.querySelector(".temp-room-icon,.dm-temperature-card-icon,.cp-icon");
    if (room && target) setRoomGlyph(target, room.icon || room.name || "mdi:home");
  });
}

function setOptionLabel(select, value, label) {
  const option = [...(select?.options || [])].find((item) => clean(item.value) === value);
  if (option && option.textContent !== label) option.textContent = label;
}

function repairClimateLabels() {
  const cold = english() ? "❄️ Cool" : "❄️ Freddo";
  const warm = english() ? "🔥 Heat" : "🔥 Caldo";
  for (const select of [
    doc?.getElementById?.("ed-cl-type"),
    doc?.querySelector?.('#dm-climate-editor-modal select[name="type"]'),
  ]) {
    if (!select) continue;
    setOptionLabel(select, "clima", cold);
    setOptionLabel(select, "termo", warm);
  }
  const modalTitle = doc?.getElementById?.("dm-climate-editor-title");
  if (modalTitle) {
    const icon = modalTitle.querySelector(".dm-editor-header-icon");
    const wanted = english() ? "Edit Cool / Heat" : "Modifica Freddo / Caldo";
    const textNode = [...modalTitle.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.textContent = ` ${wanted}`;
    else if (!icon) modalTitle.textContent = wanted;
  }
}

function runUiRepairs() {
  reconcileRooms();
  repairRoomRows();
  repairTemperatureRoomIcons();
  repairClimateLabels();
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    installOwners();
    runUiRepairs();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function wrapOwner(name) {
  const current = root[name];
  if (typeof current !== "function" || current.__dmBeta14RealDeviceHotfix) return false;
  function wrapped(...args) {
    const result = current.apply(this, args);
    const repair = () => {
      runUiRepairs();
      schedule();
    };
    if (result && typeof result.finally === "function") result.finally(repair);
    else repair();
    return result;
  }
  Object.assign(wrapped, current);
  wrapped.__dmBeta14RealDeviceHotfix = true;
  wrapped.__dmPrevious = current;
  root[name] = wrapped;
  return true;
}

function installOwners() {
  for (const name of [
    "editorSwitch",
    "buildTempCards",
    "renderTemperature",
    "buildQuickActions",
    "renderPiscina",
    "buildClimaCards",
  ]) wrapOwner(name);
}

function installStyles() {
  installStyle("dm-beta14-real-device-hotfix-style", `
    /* Quick Actions: beta.13's final glyph owner overrode the intended 34px
       size with 42px. Keep the colour emoji but return it to icon scale. */
    #page-home #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]{
      box-sizing:border-box!important;width:56px!important;height:56px!important;min-width:56px!important;min-height:56px!important
    }
    #page-home #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]>.dm-beta12-action-glyph{
      font-size:30px!important;line-height:1!important
    }

    /* Rooms and Temperature use the same single, coloured glyph contract. */
    #editor-modal #ed-body .dm-room-list-icon[data-room-icon]>.dm-beta12-room-glyph{font-size:31px!important}
    #temp-grid .temp-room-icon[data-room-icon]>.dm-beta12-room-glyph,
    #temp-grid .dm-temperature-card-icon[data-room-icon]>.dm-beta12-room-glyph,
    #temp-grid .cp-icon[data-room-icon]>.dm-beta12-room-glyph{
      display:grid!important;place-items:center!important;width:100%!important;height:100%!important;
      font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:23px!important;line-height:1!important;color:initial!important
    }

    /* Pool: on phones use an explicit top-down aspect ratio. beta.13 stretched
       the basin between top/bottom anchors and made its proportions depend on
       the hero height. */
    @media(max-width:760px){
      #page-home #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]>.dm-beta12-action-glyph{font-size:28px!important}
      #page-piscina .pool-hero[data-dm-beta12-pool="true"]{min-height:368px!important}
      #page-piscina .dm-beta12-pool-basin{
        left:50%!important;right:auto!important;top:40px!important;bottom:auto!important;
        width:calc(100% - 34px)!important;max-width:520px!important;height:auto!important;aspect-ratio:1.78 / 1!important;
        transform:translateX(-50%)!important;border-width:7px!important;border-radius:25px!important
      }
      #page-piscina .dm-beta12-pool-basin::before{border-radius:18px!important;background-size:26px 26px!important}
      #page-piscina .pool-hero[data-dm-beta12-pool="true"]>.pool-temp{
        left:9%!important;top:58px!important;width:72px!important;height:72px!important;font-size:25px!important
      }
      #page-piscina .pool-hero[data-dm-beta12-pool="true"]>.pool-sub{
        left:8%!important;top:137px!important;width:116px!important;max-width:34%!important;padding:5px 7px!important;font-size:9.5px!important
      }
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"]>.pool-chips{
        left:5%!important;right:5%!important;top:auto!important;bottom:16px!important;
        grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important
      }
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg,
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg[data-act="pump"],
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg[data-act="heat"],
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"] .pool-tg[data-act="light"]{
        position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;
        width:100%!important;max-width:none!important;min-width:0!important;min-height:54px!important;margin:0!important;padding:7px 5px!important;
        font-size:clamp(10px,2.7vw,12px)!important;line-height:1.15!important;white-space:normal!important
      }
      #page-piscina .dm-beta12-pool-depth.dm-shallow{left:86px!important}
      #page-piscina .dm-beta12-pool-depth.dm-deep{right:17px!important}
    }
    @media(max-width:390px){
      #page-piscina .pool-hero[data-dm-beta12-pool="true"]{min-height:350px!important}
      #page-piscina .dm-beta12-pool-basin{
        left:50%!important;right:auto!important;top:38px!important;bottom:auto!important;width:calc(100% - 28px)!important;aspect-ratio:1.74 / 1!important;transform:translateX(-50%)!important
      }
      #page-piscina #pool-wrap .pool-hero[data-dm-beta12-pool="true"]>.pool-chips{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important}
      #page-piscina .pool-hero[data-dm-beta12-pool="true"]>.pool-temp{width:66px!important;height:66px!important;top:54px!important}
      #page-piscina .pool-hero[data-dm-beta12-pool="true"]>.pool-sub{top:127px!important;width:108px!important}
    }
  `);
}

function installListeners() {
  if (state.listeners || !doc) return;
  state.listeners = true;
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
  ]) root.addEventListener?.(eventName, schedule);
  doc.addEventListener("click", (event) => {
    if (!event.target?.closest?.("#editor-modal,#dm-climate-editor-modal,#dm-room-editor-modal,#page-temp,#page-piscina,#qa-grid")) return;
    root.queueMicrotask?.(runUiRepairs);
    schedule();
  }, true);
}

export function installBeta14RealDeviceHotfix() {
  if (!doc) return;
  installStyles();
  installOwners();
  installListeners();
  runUiRepairs();
  schedule();
  state.installed = true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installBeta14RealDeviceHotfix, { once: true });
else installBeta14RealDeviceHotfix();
