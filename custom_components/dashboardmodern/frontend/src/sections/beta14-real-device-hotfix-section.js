// DM-FIX-20260813L
import { directEmoji, roomGlyph } from "../core/personalization-catalog.js";
import {
  clean,
  dashboardStore,
  doc,
  english,
  installStyle,
  readJson,
  root,
  t,
} from "./shared.js";

const capturedRooms = readJson("cd_stanze", []);
const state = (root.__DASHBOARDMODERN_BETA14_HOTFIX__ ||= { installed: false, queued: false, bootRecovered: false, reconcileWrites: 0 });
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function matchingRoom(room, candidates) {
  const id = clean(room?.id);
  const name = clean(room?.name).toLowerCase();
  return (
    candidates.find((candidate) => id && clean(candidate?.id) === id) ||
    candidates.find(
      (candidate) => name && clean(candidate?.name).toLowerCase() === name,
    )
  );
}

export function recoverRoomSnapshot(base, fallback, { appendMissing = false } = {}) {
  const source = Array.isArray(fallback) ? fallback : [];
  const result = (Array.isArray(base) ? base : []).map((room) => {
    const saved = matchingRoom(room, source);
    if (!saved) return { ...room };
    const next = { ...room };
    for (const field of ["icon", "temp", "hum", "temperature", "humidity"])
      if (!clean(next[field]) && clean(saved[field])) next[field] = saved[field];
    return next;
  });
  if (appendMissing) {
    for (const room of source) {
      if (!matchingRoom(room, result)) result.push({ ...room });
    }
  }
  return result;
}

export function resolvedRooms(canonical, current, captured = capturedRooms) {
  if (!state.bootRecovered) {
    state.bootRecovered = true;
    return recoverRoomSnapshot(canonical, captured, { appendMissing: !Array.isArray(canonical) || canonical.length === 0 });
  }
  if (!Array.isArray(current) || current.length === 0) return canonical;
  return recoverRoomSnapshot(current, canonical, { appendMissing: false });
}

export function reconcileRooms() {
  const store = dashboardStore();
  if (!store?.getSection) return [];
  const canonical = store.getSection("rooms") || [];
  const next = resolvedRooms(canonical, readJson("cd_stanze", []));
  if (same(next, canonical)) { state.reconcileWrites = 0; return next; }
  if (state.reconcileWrites >= 3) {
    console.warn("[DashboardModern beta14] room reconciliation circuit breaker open");
    return next;
  }
  state.reconcileWrites += 1;
  store.replaceSection?.("rooms", next);
  return next;
}

export function repairClimateLabels() {
  let repaired = false;
  // Anche il select del wizard: il tipo e' lo stesso, le voci pure.
  for (const id of ["ed-cl-type", "wz-cl-type"]) {
    const select = doc?.getElementById?.(id);
    if (!select) continue;
    const cool = select.querySelector?.('option[value="clima"]');
    const heat = select.querySelector?.('option[value="termo"],option[value="termostato"]');
    if (cool) cool.textContent = t("❄️ Freddo", "❄️ Cool");
    if (heat) heat.textContent = t("🔥 Caldo", "🔥 Heat");
    // La pompa di calore (#195) e' un tipo che il markup vendored non conosce:
    // la voce si aggiunge qui, cosi' tutti e tre gli editor offrono le stesse.
    let pump = select.querySelector?.('option[value="pompa"]');
    if (!pump && doc?.createElement) {
      pump = doc.createElement("option");
      pump.value = "pompa";
      select.append?.(pump);
    }
    if (pump) pump.textContent = t("♨️ Pompa di calore", "♨️ Heat pump");
    repaired = true;
  }
  return repaired;
}

function installTemperatureCompatibleIconEngine() {
  const engine = root.DashboardModernIconEngine;
  if (!engine?.render || engine.render.__dmTemperatureFallbackCompatible) return;
  const render = function (target, kind, value, options = {}) {
    const canonicalTemperature =
      clean(kind).toLowerCase() === "room"
      && target?.closest?.('.dm-temperature-card[data-dm-temperature-canonical="true"]');
    if (!canonicalTemperature) return engine.render(target, kind, value, options);

    const token = clean(value || target?.dataset?.roomIcon || "mdi:home");
    const glyph = engine.glyph?.("room", token) || directEmoji(token) || roomGlyph(token);
    target.dataset.roomIcon = token;
    let fallback = target.querySelector(":scope > .dm-temperature-icon-fallback");
    if (!fallback) {
      fallback = doc.createElement("span");
      fallback.className = "dm-temperature-icon-fallback";
    }
    if (clean(fallback.textContent) !== glyph) fallback.textContent = glyph;
    if (target.children.length !== 1 || target.firstElementChild !== fallback) {
      target.replaceChildren(fallback);
    }
    return true;
  };
  render.__dmTemperatureFallbackCompatible = true;
  root.DashboardModernIconEngine = Object.freeze({ ...engine, render });
}

function setRoomGlyph(target, room) {
  const token = clean(room?.icon || "mdi:home");
  target.dataset.roomIcon = token;
  target.setAttribute("title", clean(room?.name));
  const engine = root.DashboardModernIconEngine;
  if (engine?.render) {
    engine.render(target, "room", token, { size: 31 });
    return;
  }
  const glyph = directEmoji(token) || roomGlyph(token);
  let visual = target.querySelector(".dm-beta14-room-glyph");
  if (!visual) {
    visual = doc.createElement("span");
    visual.className = "dm-beta14-room-glyph";
    target.replaceChildren(visual);
  }
  if (clean(visual.textContent) !== glyph) visual.textContent = glyph;
}

export function repairRoomRows() {
  const body = doc?.getElementById?.("ed-body");
  const activeTab = clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
  if (!body || (activeTab && activeTab !== "stanze")) return false;
  const rooms = readJson("cd_stanze", []);
  const rows = [...body.querySelectorAll(".ed-row")];
  let repaired = false;
  rows.forEach((row, rowIndex) => {
    const edit = row.querySelector(
      '[data-dm-edit-kind="room"][data-dm-edit-index]',
    );
    const index = Number.parseInt(edit?.dataset?.dmEditIndex ?? rowIndex, 10);
    const label = clean(row.querySelector(".ed-row-new")?.textContent).toLowerCase();
    const room = rooms[index] || rooms.find((item) =>
      label.includes(clean(item?.name).toLowerCase()),
    );
    if (!room) return;
    row.classList.add("dm-room-config-row");
    let target = row.querySelector(".dm-room-list-icon");
    if (!target) {
      target = doc.createElement("span");
      target.className = "dm-room-list-icon";
      row.prepend(target);
    }
    setRoomGlyph(target, room);
    repaired = true;
  });
  return repaired;
}

export function repairTemperatureRoomIcons() {
  const rooms = readJson("cd_stanze", []);
  doc?.querySelectorAll?.("#temp-grid [data-room-id],#temp-grid .temp-card")?.forEach((card) => {
    if (card.dataset?.dmTemperatureCanonical === "true") return;
    const id = clean(card.dataset?.roomId);
    const name = clean(card.dataset?.roomName || card.querySelector?.("[data-room-name],.name")?.textContent);
    const room = rooms.find((item) => id && clean(item.id) === id)
      || rooms.find((item) => name && clean(item.name).toLowerCase() === name.toLowerCase());
    if (!room) return;
    const target = card.querySelector?.(".room-icon,.temp-icon,[data-room-icon]");
    if (target) target.textContent = directEmoji(room.icon) || roomGlyph(room.icon);
  });
}

function runUiRepairs() {
  installTemperatureCompatibleIconEngine();
  reconcileRooms();
  repairClimateLabels();
  repairRoomRows();
  repairTemperatureRoomIcons();
}

function installStyles() {
  installStyle("dm-beta14-real-device-hotfix-style", `
    #page-home #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]{
      width:56px!important;height:56px!important;min-width:56px!important;min-height:56px!important
    }
    #page-home #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]>.dm-beta12-action-glyph{
      font-size:30px!important
    }
    #editor-modal #ed-body .dm-room-list-icon[data-room-icon]>.dm-beta12-room-glyph,
    #editor-modal #ed-body .dm-room-list-icon[data-room-icon]>.dm-beta14-room-glyph{
      display:grid!important;place-items:center!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:31px!important;line-height:1!important
    }
    #temp-grid .room-icon,#temp-grid .temp-icon,#temp-grid [data-room-icon]{
      display:grid!important;place-items:center!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:23px!important;line-height:1!important
    }
    @media(max-width:760px){
      #page-home #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]>.dm-beta12-action-glyph{font-size:28px!important}
    }
  `);
}
function schedule() {
  if (state.queued) return;
  state.queued = true;
  const run = () => { state.queued = false; runUiRepairs(); };
  if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(run);
  else root.setTimeout?.(run, 0);
}
function wrapOwner(name) {
  const current = root[name];
  if (typeof current !== "function" || current.__dmBeta14Owner) return;
  function wrapped(...args) {
    const result = current.apply(this, args);
    const repair = () => name === "editorSwitch" ? runUiRepairs() : schedule();
    if (result?.finally) result.finally(repair); else repair();
    return result;
  }
  Object.assign(wrapped, current); wrapped.__dmBeta14Owner = true; wrapped.__dmPrevious = current; root[name] = wrapped;
}
/* Anche il wizard: `#wz-cl-type` nasce quando il wizard si apre, cioe' molto
 * dopo la riparazione d'avvio e fuori dai giri dell'editor. Senza questi due
 * la prima configurazione offriva solo Freddo e Caldo, e la pompa di calore
 * si poteva scegliere soltanto tornandoci dalla configurazione. */
function installOwners() {
  ["editorSwitch", "buildQuickActions", "buildTempCards", "apriSetupWizard", "wzRender"].forEach(
    wrapOwner,
  );
}
export function installBeta14RealDeviceHotfix() {
  installTemperatureCompatibleIconEngine();
  installOwners();
  if (state.installed || !doc) return;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", (event) => { if (event.target?.closest?.("[data-dm-edit-kind]")) schedule(); });
  schedule();
}
if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", installBeta14RealDeviceHotfix, { once: true });
else installBeta14RealDeviceHotfix();
