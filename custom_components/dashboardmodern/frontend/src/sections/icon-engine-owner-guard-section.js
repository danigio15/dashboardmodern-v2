// DM-FIX-20260813G
import { clean, doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ICON_ENGINE_OWNER_GUARD__";
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

function syncTemperatureIcons() {
  const engine = root.DashboardModernIconEngine;
  if (!engine?.render || !doc) return false;
  const rooms = configuredRooms();
  let changed = false;
  doc.querySelectorAll("#temp-grid .dm-temperature-card[data-room-id]").forEach((card) => {
    const target = card.querySelector(".dm-temperature-card-icon,.temp-room-icon,.cp-icon");
    if (!target) return;
    const room = rooms.find((item) => clean(item?.id) === clean(card.dataset.roomId));
    const token = clean(target.dataset.roomIcon || room?.icon || room?.name || "mdi:home");
    target.dataset.roomIcon = token;
    engine.render(target, "room", token, { size: 31 });
    changed = true;
  });
  return changed;
}

function syncOwnedSurfaces() {
  state.queued = false;
  const engine = root.DashboardModernIconEngine;
  if (!engine) return;
  engine.syncQuickActions?.();
  engine.syncEditor?.();
  syncTemperatureIcons();
}

function queueSync() {
  if (state.queued) return;
  state.queued = true;
  const run = () => syncOwnedSurfaces();
  if (typeof root.queueMicrotask === "function") root.queueMicrotask(run);
  else Promise.resolve().then(run);
}

function observeRoot(node) {
  if (!node || state.observed.has(node) || typeof root.MutationObserver !== "function") return false;
  state.observed.add(node);
  const observer = new root.MutationObserver(() => queueSync());
  observer.observe(node, { childList: true, subtree: true });
  state.observers.push(observer);
  return true;
}

function installScopedObservers() {
  if (!doc) return false;
  let installed = false;
  for (const id of ["ed-body", "qa-grid", "temp-grid"]) {
    installed = observeRoot(doc.getElementById(id)) || installed;
  }
  return installed;
}

function reconcile() {
  installScopedObservers();
  queueSync();
}

export function installIconEngineOwnerGuard() {
  if (!doc || state.installed) return;
  state.installed = true;
  reconcile();

  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
  ]) root.addEventListener?.(eventName, reconcile);

  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("#editor-modal,.ed-tab,[data-dm-edit-kind],[data-temperature-edit]")) {
        queueSync();
      }
    },
    true,
  );
}

installIconEngineOwnerGuard();
