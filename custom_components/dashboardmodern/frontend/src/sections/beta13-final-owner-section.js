import {
  ACTION_ICON_CATALOG,
  actionCatalogMatch,
  roomCatalogMatch,
} from "../core/personalization-catalog.js";
import {
  clean,
  doc,
  installStyle,
  readJson,
  root,
} from "./shared.js";

// Beta 13 final owner. Older compatibility sections still run bounded delayed
// repairs for historical WebViews. Instead of racing those repairs with more
// timers, keep each visible glyph node locally owned: a scoped child observer
// restores the canonical single emoji child before the next paint whenever an
// older owner rewrites that exact node. No document-wide observer or polling.
const KEY = "__DASHBOARDMODERN_BETA13_FINAL_OWNER__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  observed: new WeakSet(),
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

function directEmoji(value) {
  const token = clean(value);
  if (!token || token.startsWith("mdi:")) return "";
  return /[^\p{L}\p{N}\s:_-]/u.test(token) && token.length <= 12 ? token : "";
}

function roomGlyph(value) {
  const direct = directEmoji(value);
  if (direct) return direct;
  const item = roomCatalogMatch(value);
  return ROOM_GLYPHS[item?.id] || "🏠";
}

function actionGlyph(value) {
  const direct = directEmoji(value);
  if (direct) return direct;
  return actionCatalogMatch(value)?.glyph || "⭐";
}

function quickActions() {
  const stored = readJson("cd_quick_actions", []);
  if (Array.isArray(stored) && stored.length) return stored;
  try {
    const values = root.getQuickActions?.();
    return Array.isArray(values) ? values : [];
  } catch (_error) {
    return [];
  }
}

function actionToken(action = {}, node = null) {
  const configured = clean(action.icon);
  if (configured) return configured;
  const builtin = clean(action.builtin).toLowerCase();
  const type = clean(action.type).toLowerCase();
  return ACTION_BUILTINS[builtin]
    || ACTION_BUILTINS[type.replace(/^builtin_/, "")]
    || clean(node?.dataset?.dmBeta12DisplayToken)
    || "mdi:star";
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

function exactGlyph(node, className, token, glyph) {
  if (!node) return false;
  const children = [...node.children];
  const current = children.length === 1 && children[0].classList.contains(className)
    ? children[0]
    : null;
  return Boolean(
    current
    && clean(current.dataset.token) === token
    && clean(current.textContent) === glyph
    && !current.querySelector("svg,ha-icon"),
  );
}

function ownNode(node, className, token, glyph) {
  if (!node) return false;
  node.dataset.dmBeta13FinalGlyph = "true";
  node.dataset.dmSingleGlyphOwner = "true";
  if (!exactGlyph(node, className, token, glyph)) {
    node.replaceChildren(makeGlyph(className, token, glyph));
  }
  return true;
}

function observeNode(node, repair) {
  if (!node || state.observed.has(node) || typeof root.MutationObserver !== "function") return;
  state.observed.add(node);
  const observer = new root.MutationObserver(() => repair(node));
  observer.observe(node, { childList: true, subtree: true });
}

function repairQuickNode(node) {
  const nodes = [...(doc?.querySelectorAll?.("#qa-grid .qa-btn .icon") || [])];
  const index = nodes.indexOf(node);
  if (index < 0) return false;
  const action = quickActions()[index] || {};
  const token = actionToken(action, node);
  const glyph = actionGlyph(token);
  node.dataset.dmBeta12DisplayToken = token;
  node.dataset.dmBeta12DisplayGlyph = glyph;
  ownNode(node, "dm-beta12-action-glyph", token, glyph);
  observeNode(node, repairQuickNode);
  return true;
}

function repairQuickActions() {
  doc?.querySelectorAll?.("#qa-grid .qa-btn .icon").forEach(repairQuickNode);
}

function repairRoomNode(node) {
  const token = clean(node?.dataset?.roomIcon || "mdi:home");
  const glyph = roomGlyph(token);
  ownNode(node, "dm-beta12-room-glyph", token, glyph);
  observeNode(node, repairRoomNode);
  return true;
}

function repairRoomRows() {
  doc?.querySelectorAll?.("#editor-modal #ed-body .dm-room-list-icon[data-room-icon]").forEach(repairRoomNode);
}

function repairPickerNode(node) {
  const picker = node?.closest?.("#dm-visual-picker");
  const button = node?.closest?.(".dm-picker-option[data-index]");
  const index = Number.parseInt(button?.dataset?.index || "-1", 10);
  const kind = clean(picker?.dataset?.kind);
  if (!picker || !button || index < 0 || !["room", "action"].includes(kind)) return false;

  if (kind === "room") {
    const item = root.DashboardModernModules?.personalization?.ROOM_CATALOG?.[index] || null;
    const fallback = item || null;
    const token = clean(fallback?.mdi || fallback?.id || button.dataset.value || "mdi:home");
    ownNode(node, "dm-beta12-room-glyph", token, roomGlyph(token));
  } else {
    const item = ACTION_ICON_CATALOG[index];
    if (!item) return false;
    const token = clean(item.mdi || item.id || "mdi:star");
    ownNode(node, "dm-beta12-action-glyph", token, item.glyph || actionGlyph(token));
  }
  picker.dataset.dmSingleGlyphOwner = "true";
  observeNode(node, repairPickerNode);
  return true;
}

function repairPicker() {
  doc?.querySelectorAll?.("#dm-visual-picker[data-kind='room'] .dm-picker-visual,#dm-visual-picker[data-kind='action'] .dm-picker-visual")
    .forEach(repairPickerNode);
}

function repairRoomPreview() {
  const preview = doc?.querySelector?.("#dm-room-editor-modal [data-room-icon-preview]");
  const input = doc?.querySelector?.('#dm-room-editor-modal input[name="icon"]');
  if (!preview || !input) return false;
  const repair = (node) => {
    const token = clean(input.value || "mdi:home");
    ownNode(node, "dm-beta12-room-glyph", token, roomGlyph(token));
  };
  repair(preview);
  observeNode(preview, repair);
  return true;
}

function repairActionPreview() {
  const preview = doc?.querySelector?.("#dm-action-editor-modal [data-action-icon-preview]");
  const input = doc?.querySelector?.('#dm-action-editor-modal input[name="icon"]');
  if (!preview || !input) return false;
  const repair = (node) => {
    const token = clean(input.value || "mdi:star");
    ownNode(node, "dm-beta12-action-glyph", token, actionGlyph(token));
  };
  repair(preview);
  observeNode(preview, repair);
  return true;
}

function repairAll() {
  repairQuickActions();
  repairRoomRows();
  repairPicker();
  repairRoomPreview();
  repairActionPreview();
}

function canonicalClimateType(value) {
  const token = clean(value).toLowerCase();
  return ["termo", "termostato", "thermostat", "heat", "heating", "caldo"].includes(token)
    ? "termo"
    : "clima";
}

function normalizePersistedClimateTypes() {
  const stored = readJson("cd_clima_units", []);
  if (!Array.isArray(stored) || !stored.length) return false;
  let changed = false;
  const normalized = stored.map((item) => {
    const type = canonicalClimateType(item?.type);
    if (clean(item?.type) !== type) changed = true;
    return { ...item, type };
  });
  if (changed) root.localStorage?.setItem?.("cd_clima_units", JSON.stringify(normalized));
  return changed;
}

function wrapOwner(name) {
  const current = root[name];
  if (typeof current !== "function" || current.__dmBeta13FinalOwner) return false;
  function wrapped(...args) {
    const result = current.apply(this, args);
    const repair = () => repairAll();
    if (result && typeof result.finally === "function") result.finally(repair);
    else repair();
    return result;
  }
  Object.assign(wrapped, current);
  wrapped.__dmBeta13FinalOwner = true;
  wrapped.__dmPrevious = current;
  root[name] = wrapped;
  return true;
}

function installOwners() {
  for (const name of ["buildQuickActions", "editorSwitch", "render"]) wrapOwner(name);
}

function scheduleAfterEvent() {
  root.queueMicrotask?.(() => {
    installOwners();
    repairAll();
  });
  root.requestAnimationFrame?.(() => {
    installOwners();
    repairAll();
  });
}

function install() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle("dm-beta13-final-owner-style", `
    [data-dm-beta13-final-glyph="true"]{position:relative!important;color:initial!important}
    [data-dm-beta13-final-glyph="true"]::before,[data-dm-beta13-final-glyph="true"]::after{content:none!important;display:none!important}
    [data-dm-beta13-final-glyph="true"]>.dm-beta12-room-glyph,
    [data-dm-beta13-final-glyph="true"]>.dm-beta12-action-glyph{
      display:grid!important;place-items:center!important;width:100%!important;height:100%!important;
      font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;
      font-style:normal!important;font-weight:400!important;line-height:1!important;color:initial!important
    }
    [data-dm-beta13-final-glyph="true"]>.dm-beta12-room-glyph>span,
    [data-dm-beta13-final-glyph="true"]>.dm-beta12-action-glyph>span{display:block!important;line-height:1!important}
    #page-home #qa-grid .qa-btn .icon[data-dm-beta13-final-glyph="true"]>.dm-beta12-action-glyph{font-size:42px!important}
    #editor-modal #ed-body .dm-room-list-icon[data-dm-beta13-final-glyph="true"]>.dm-beta12-room-glyph{font-size:31px!important}
    #dm-visual-picker [data-dm-beta13-final-glyph="true"]>.dm-beta12-room-glyph,
    #dm-visual-picker [data-dm-beta13-final-glyph="true"]>.dm-beta12-action-glyph{font-size:38px!important}
  `);

  installOwners();
  repairAll();

  if (!state.listeners) {
    state.listeners = true;
    // Window capture runs before the older document-capture editor handlers.
    // Normalize legacy thermostat values before either editor reads them.
    root.addEventListener?.("click", (event) => {
      if (event.target?.closest?.('[data-dm-edit-kind="climate"]')) normalizePersistedClimateTypes();
      if (event.target?.closest?.("#qa-grid,.ed-tab,[data-dm-edit-kind],#dm-visual-picker,#dm-room-editor-modal,#dm-action-editor-modal,.dm-visual-trigger,.dm-icon-preview-button"))
        scheduleAfterEvent();
    }, true);

    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:states-ready",
    ]) root.addEventListener?.(eventName, () => {
      normalizePersistedClimateTypes();
      installOwners();
      scheduleAfterEvent();
    });
  }
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
else install();
