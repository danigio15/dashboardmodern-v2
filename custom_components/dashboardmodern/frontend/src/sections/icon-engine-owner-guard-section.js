// DM-FIX-20260813I
import { clean, doc, root } from "./shared.js";

// Final beta18 compatibility owner.
// beta14 still performs historical room/temperature repairs after some render
// owners. Keep those repairs for the unrelated layout/data fixes, but make the
// icon engine the last writer for room/action surfaces and preserve the
// canonical Temperature fallback node contract. Everything is scoped to the
// three icon roots and runs in microtasks / the same animation frame: no polling,
// timers or document-wide observer.
const KEY = "__DASHBOARDMODERN_ICON_ENGINE_FINAL_OWNER_GUARD__";
const LEGACY_GUARD_KEY = "__DASHBOARDMODERN_ICON_ENGINE_OWNER_GUARD__";
const state = (root[KEY] ||= {
  installed: false,
  queued: false,
  observed: new WeakSet(),
  observers: [],
});

function configuredRooms() {
  try {
    const values = root.DashboardModernModules?.store?.getSection?.("rooms");
    if (Array.isArray(values) && values.length) return values;
  } catch (_error) {}
  try {
    const values = JSON.parse(root.localStorage?.getItem("cd_stanze") || "[]");
    return Array.isArray(values) ? values : [];
  } catch (_error) {
    return [];
  }
}

function roomForCard(card, rooms) {
  const id = clean(card?.dataset?.roomId);
  if (id) {
    const match = rooms.find((room) => clean(room?.id) === id);
    if (match) return match;
  }
  const name = clean(
    card?.dataset?.roomName ||
      card?.querySelector?.(".temp-room-name,[data-room-name],.name")?.textContent,
  ).toLowerCase();
  return name ? rooms.find((room) => clean(room?.name).toLowerCase() === name) || null : null;
}

function syncRoomRows(rooms) {
  const engine = root.DashboardModernIconEngine;
  if (!doc || !engine?.render) return false;
  let changed = false;
  doc.querySelectorAll('#ed-body [data-dm-edit-kind="room"][data-dm-edit-index]').forEach((edit) => {
    const row = edit.closest(".ed-row");
    const index = Number.parseInt(edit.dataset.dmEditIndex || "-1", 10);
    const room = index >= 0 ? rooms[index] : null;
    const target = row?.querySelector(":scope > .dm-room-list-icon");
    if (!room || !target) return;
    const token = clean(room.icon || room.name || "mdi:home");
    target.dataset.roomIcon = token;
    engine.render(target, "room", token, { size: 31 });
    changed = true;
  });
  return changed;
}

function syncTemperatureFallbacks(rooms) {
  const engine = root.DashboardModernIconEngine;
  if (!doc || !engine?.glyph) return false;
  let changed = false;
  doc.querySelectorAll(
    '#temp-grid .temp-card[data-dm-temperature-canonical="true"][data-room-id]',
  ).forEach((card) => {
    const room = roomForCard(card, rooms);
    const target = card.querySelector(".temp-room-icon,.cp-icon,[data-room-icon]");
    if (!room || !target) return;
    const token = clean(room.icon || room.name || target.dataset.roomIcon || "mdi:home");
    const glyph = engine.glyph("room", token);
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

    // This surface belongs to temperature-section, not to the generic icon
    // engine visual wrapper. Remove stale ownership markers left by the older
    // beta-entry guard after restoring the canonical fallback child.
    delete target.dataset.dmIconEngineSignature;
    delete target.dataset.dmIconEngineOwner;
    delete target.dataset.dmIconEngineGlyphValue;
    delete target.dataset.dmSingleGlyphOwner;
    delete target.dataset.dmBeta12Colored;
    delete target.dataset.dmBeta12DisplayGlyph;
    changed = true;
  });
  return changed;
}

export function syncFinalOwnedIconSurfaces() {
  const engine = root.DashboardModernIconEngine;
  if (!doc || !engine) return false;
  const rooms = configuredRooms();
  engine.syncQuickActions?.();
  engine.syncEditor?.();
  syncRoomRows(rooms);
  syncTemperatureFallbacks(rooms);
  return true;
}

function disableSupersededEntryGuard() {
  const legacy = root[LEGACY_GUARD_KEY];
  if (!legacy) return;
  for (const observer of legacy.observers || []) observer?.disconnect?.();
  legacy.observers = [];
  // Its closures read these properties dynamically. Keeping queued=true and a
  // has-always-true observed set prevents the superseded guard from reattaching
  // or repainting Temperature icons on later legacy/runtime events.
  legacy.observed = {
    has() {
      return true;
    },
    add() {
      return this;
    },
  };
  legacy.queued = true;
}

function queueFinalSync() {
  if (state.queued) return;
  state.queued = true;
  const run = () => {
    state.queued = false;
    disableSupersededEntryGuard();
    installOwners();
    installScopedObservers();
    syncFinalOwnedIconSurfaces();
  };
  if (typeof root.queueMicrotask === "function") root.queueMicrotask(run);
  else Promise.resolve().then(run);
}

function scheduleSameFrameFinalSync() {
  queueFinalSync();
  if (typeof root.requestAnimationFrame === "function") {
    root.requestAnimationFrame(() => {
      disableSupersededEntryGuard();
      installOwners();
      installScopedObservers();
      syncFinalOwnedIconSurfaces();
    });
  }
}

function observeRoot(node) {
  if (!node || state.observed.has(node) || typeof MutationObserver !== "function") return;
  state.observed.add(node);
  const observer = new MutationObserver(queueFinalSync);
  observer.observe(node, { childList: true, subtree: true });
  state.observers.push(observer);
}

function installScopedObservers() {
  if (!doc) return;
  for (const id of ["ed-body", "qa-grid", "temp-grid"]) observeRoot(doc.getElementById(id));
}

function wrapAfter(name) {
  const current = root[name];
  const marker = `__dmFinalIconOwner_${name}`;
  if (typeof current !== "function" || current[marker]) return false;
  function wrapped(...args) {
    const result = current.apply(this, args);
    if (result && typeof result.finally === "function") result.finally(scheduleSameFrameFinalSync);
    else scheduleSameFrameFinalSync();
    return result;
  }
  Object.assign(wrapped, current);
  wrapped[marker] = true;
  wrapped.__dmPrevious = current;
  root[name] = wrapped;
  return true;
}

function installOwners() {
  for (const name of ["editorSwitch", "buildQuickActions", "buildTempCards", "renderTemperature"]) {
    wrapAfter(name);
  }
}

export function installFinalIconOwnerGuard() {
  if (!doc) return;
  disableSupersededEntryGuard();
  installOwners();
  installScopedObservers();
  scheduleSameFrameFinalSync();
  if (state.installed) return;
  state.installed = true;
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
  ]) {
    root.addEventListener?.(eventName, scheduleSameFrameFinalSync);
  }
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installFinalIconOwnerGuard, { once: true });
} else {
  installFinalIconOwnerGuard();
}
