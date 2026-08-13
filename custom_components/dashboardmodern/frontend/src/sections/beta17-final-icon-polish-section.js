// DM-FIX-20260813C
import {
  ROOM_CATALOG,
  ROOM_GLYPHS,
  actionCatalogMatch,
  directEmoji,
  roomGlyph,
} from "../core/personalization-catalog.js";
import { clean, doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA17_FINAL_ICON_POLISH__";
const state = (root[KEY] ||= {
  installed: false,
  temperaturePage: null,
  temperatureObserver: null,
  modalObserver: null,
});

// Kept as public compatibility exports for diagnostics/tests. Picker ownership
// moved to icon-engine-section in Beta18.
export const ROOM_ICON_CHOICES = Object.freeze(
  ROOM_CATALOG.map((item) =>
    Object.freeze([ROOM_GLYPHS[item.id] || roomGlyph(item.mdi), item.keywords, item.mdi]),
  ),
);

export function isTemperatureProgressText(value) {
  const text = clean(value).replaceAll("…", "...").toLowerCase();
  return /^(?:aggiornamento in corso|update in progress|updating)(?:\s*\.*)?$/.test(text);
}

export function actionPickerGlyph(value) {
  const token = clean(value);
  return directEmoji(token) || actionCatalogMatch(token)?.glyph || "⭐";
}

function hideTemperatureProgressCopy() {
  const page = doc?.getElementById("page-temp");
  if (!page) return false;
  let hidden = false;
  page.querySelectorAll("div,span,p,small").forEach((node) => {
    if (!isTemperatureProgressText(node.textContent)) {
      if (node.dataset.dmBeta17TemperatureProgressHidden === "true") {
        delete node.dataset.dmBeta17TemperatureProgressHidden;
        node.hidden = false;
        node.removeAttribute("aria-hidden");
        node.style.removeProperty("display");
      }
      return;
    }
    node.dataset.dmBeta17TemperatureProgressHidden = "true";
    node.hidden = true;
    node.setAttribute("aria-hidden", "true");
    node.style.setProperty("display", "none", "important");
    hidden = true;
  });
  return hidden;
}

function bindTemperatureProgressGuard() {
  const page = doc?.getElementById("page-temp");
  if (!page) return false;
  hideTemperatureProgressCopy();
  if (state.temperaturePage === page && state.temperatureObserver) return true;
  state.temperatureObserver?.disconnect?.();
  state.temperaturePage = page;
  if (typeof root.MutationObserver === "function") {
    state.temperatureObserver = new root.MutationObserver(hideTemperatureProgressCopy);
    state.temperatureObserver.observe(page, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }
  return true;
}

// Beta18 owns Room/Action preview DOM through DashboardModernIconEngine. The
// legacy personalization decorator still schedules a later refresh after an
// edit click. Claim the modal before that scheduled frame so personalization
// never becomes a second writer.
function claimCanonicalModalIconOwner() {
  const engine = root.DashboardModernIconEngine;
  if (typeof engine?.syncEditor !== "function") return false;
  let claimed = false;
  for (const id of ["dm-action-editor-modal", "dm-room-editor-modal"]) {
    const modal = doc?.getElementById(id);
    if (!modal) continue;
    modal.dataset.dmPersonalized = "true";
    modal.dataset.dmSingleGlyphOwner = "true";
    claimed = true;
  }
  if (claimed) engine.syncEditor();
  return claimed;
}

function scheduleCanonicalModalClaim(event) {
  if (!event.target?.closest?.('[data-dm-edit-kind="action"],[data-dm-edit-kind="room"]')) return;
  if (typeof root.queueMicrotask === "function") root.queueMicrotask(claimCanonicalModalIconOwner);
  else Promise.resolve().then(claimCanonicalModalIconOwner);
}

function addedEditorModal(node) {
  if (!node || node.nodeType !== 1) return false;
  if (node.id === "dm-action-editor-modal" || node.id === "dm-room-editor-modal") return true;
  return Boolean(node.querySelector?.("#dm-action-editor-modal,#dm-room-editor-modal"));
}

function bindCanonicalModalObserver() {
  if (state.modalObserver || typeof root.MutationObserver !== "function" || !doc?.documentElement) return false;
  state.modalObserver = new root.MutationObserver((records) => {
    const inserted = records.some((record) => [...record.addedNodes].some(addedEditorModal));
    if (inserted) claimCanonicalModalIconOwner();
  });
  state.modalObserver.observe(doc.documentElement, { childList: true, subtree: true });
  claimCanonicalModalIconOwner();
  return true;
}

function install() {
  if (!doc || state.installed) return;
  state.installed = true;
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
  ]) root.addEventListener?.(eventName, bindTemperatureProgressGuard);
  root.addEventListener?.("dashboardmodern:state-changed", hideTemperatureProgressCopy);
  doc.addEventListener("click", scheduleCanonicalModalClaim, true);
  bindCanonicalModalObserver();
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", bindTemperatureProgressGuard, { once: true });
  } else {
    bindTemperatureProgressGuard();
  }
}

install();
