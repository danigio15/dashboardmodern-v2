// DM-FIX-20260812B
import { directEmoji, roomGlyph } from "../core/personalization-catalog.js";
import { clean, dashboardStore, doc, readJson, root } from "./shared.js";

const capturedRooms = readJson("cd_stanze", []);
const state = (root.__DASHBOARDMODERN_BETA14_HOTFIX__ ||= { installed: false, queued: false, bootRecovered: false, reconcileWrites: 0 });
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const roomKey = (room) => clean(room?.id || room?.name).toLowerCase();

export function recoverRoomSnapshot(base, fallback, { appendMissing = false } = {}) {
  const source = Array.isArray(fallback) ? fallback : [];
  const result = (Array.isArray(base) ? base : []).map((room) => {
    const saved = source.find((candidate) => roomKey(candidate) === roomKey(room));
    if (!saved) return { ...room };
    const next = { ...room };
    for (const field of ["icon", "temp", "hum", "temperature", "humidity"])
      if (!clean(next[field]) && clean(saved[field])) next[field] = saved[field];
    return next;
  });
  if (appendMissing) {
    const keys = new Set(result.map(roomKey));
    for (const room of source) if (!keys.has(roomKey(room))) result.push({ ...room });
  }
  return result;
}

export function resolvedRooms(canonical, current, captured = capturedRooms) {
  if (!state.bootRecovered) {
    state.bootRecovered = true;
    return recoverRoomSnapshot(canonical, captured, { appendMissing: !Array.isArray(canonical) || canonical.length === 0 });
  }
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
  const select = doc?.getElementById?.("ed-cl-type");
  if (!select) return false;
  const cool = select.querySelector?.('option[value="clima"]');
  const heat = select.querySelector?.('option[value="termo"],option[value="termostato"]');
  if (cool) cool.textContent = "❄️ Freddo";
  if (heat) heat.textContent = "🔥 Caldo";
  return true;
}

export function repairTemperatureRoomIcons() {
  const rooms = readJson("cd_stanze", []);
  doc?.querySelectorAll?.("#temp-grid [data-room-id],#temp-grid .temp-card")?.forEach((card) => {
    const id = clean(card.dataset?.roomId);
    const name = clean(card.dataset?.roomName || card.querySelector?.("[data-room-name],.name")?.textContent);
    const room = rooms.find((item) => id && clean(item.id) === id)
      || rooms.find((item) => name && clean(item.name).toLowerCase() === name.toLowerCase());
    if (!room) return;
    const target = card.querySelector?.(".room-icon,.temp-icon,[data-room-icon]");
    if (target) target.textContent = directEmoji(room.icon) || roomGlyph(room.icon);
  });
}

function runUiRepairs() { reconcileRooms(); repairClimateLabels(); repairTemperatureRoomIcons(); }
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
function installOwners() { ["editorSwitch", "buildQuickActions", "buildTempCards"].forEach(wrapOwner); }
export function installBeta14RealDeviceHotfix() {
  installOwners();
  if (state.installed || !doc) return;
  state.installed = true;
  doc.addEventListener("click", (event) => { if (event.target?.closest?.("#page-piscina,[data-dm-edit-kind]")) schedule(); });
  schedule();
}
if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", installBeta14RealDeviceHotfix, { once: true });
else installBeta14RealDeviceHotfix();
