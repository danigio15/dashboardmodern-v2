// DM-FIX-20260813C
import {
  ROOM_CATALOG,
  ROOM_GLYPHS,
  actionCatalogMatch,
  directEmoji,
  roomGlyph,
} from "../core/personalization-catalog.js";
import { clean, doc, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA17_FINAL_ICON_POLISH__";
const state = (root[KEY] ||= {
  installed: false,
  temperaturePage: null,
  temperatureObserver: null,
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

function bindCanonicalPreview(modal, kind, engine) {
  const selector = kind === "action" ? "[data-action-icon-preview]" : "[data-room-icon-preview]";
  const preview = modal.querySelector(selector);
  const input = modal.querySelector('input[name="icon"]');
  if (!preview || !input) return false;

  preview.classList.add("dm-visual-trigger");
  preview.setAttribute("role", "button");
  preview.setAttribute("tabindex", "0");
  preview.removeAttribute("aria-hidden");
  preview.setAttribute(
    "aria-label",
    kind === "action" ? t("Scegli icona azione", "Choose action icon") : t("Scegli icona stanza", "Choose room icon"),
  );

  if (preview.dataset.dmCanonicalPickerBound !== "true") {
    preview.dataset.dmCanonicalPickerBound = "true";
    const open = () => engine.openPicker?.(input, kind, { autofocus: false });
    preview.addEventListener("click", open);
    preview.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    });
  }
  return true;
}

// Beta18 owns Room/Action preview DOM through DashboardModernIconEngine. The
// unified editor is created by a document-capture listener that can stop
// propagation. Listen one level earlier (window capture), but defer the claim
// to the next task: by then the modal exists, while the legacy personalization
// repaint scheduled by that same click has not taken ownership of the preview.
function claimCanonicalModalIconOwner() {
  const engine = root.DashboardModernIconEngine;
  if (typeof engine?.syncEditor !== "function") return false;
  let claimed = false;
  for (const [id, kind] of [
    ["dm-action-editor-modal", "action"],
    ["dm-room-editor-modal", "room"],
  ]) {
    const modal = doc?.getElementById(id);
    if (!modal) continue;
    modal.dataset.dmPersonalized = "true";
    modal.dataset.dmSingleGlyphOwner = "true";
    bindCanonicalPreview(modal, kind, engine);
    claimed = true;
  }
  if (claimed) engine.syncEditor();
  return claimed;
}

function scheduleCanonicalModalClaim(event) {
  if (!event.target?.closest?.('[data-dm-edit-kind="action"],[data-dm-edit-kind="room"]')) return;
  root.setTimeout?.(claimCanonicalModalIconOwner, 0);
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
  root.addEventListener?.("click", scheduleCanonicalModalClaim, true);
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", bindTemperatureProgressGuard, { once: true });
  } else {
    bindTemperatureProgressGuard();
  }
}

install();
