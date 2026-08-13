// DM-FIX-20260813A
import {
  ACTION_ICON_CATALOG,
  ROOM_CATALOG,
  ROOM_GLYPHS,
  actionCatalogMatch,
  directEmoji,
  roomGlyph,
} from "../core/personalization-catalog.js";
import { clean, doc, esc, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA17_FINAL_ICON_POLISH__";
const state = (root[KEY] ||= {
  installed: false,
  temperaturePage: null,
  temperatureObserver: null,
  repairQueued: false,
});

// The same canonical room catalog now owns both first insertion and edit. Keep
// this exported compact representation for regression tests and diagnostics.
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

function emitChange(input) {
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function stableGlyphClass(kind) {
  return kind === "room" ? "dm-beta12-room-glyph" : "dm-beta12-action-glyph";
}

function makeStableGlyph(kind, token, glyph) {
  const holder = doc.createElement("span");
  holder.className = stableGlyphClass(kind);
  holder.dataset.token = token;
  const visual = doc.createElement("span");
  visual.setAttribute("aria-hidden", "true");
  visual.textContent = glyph;
  holder.append(visual);
  return holder;
}

function hasStableGlyph(preview, kind, token, glyph) {
  const className = stableGlyphClass(kind);
  const child = preview?.children?.length === 1 ? preview.firstElementChild : null;
  return Boolean(
    child
      && child.classList.contains(className)
      && clean(child.dataset.token) === token
      && clean(child.textContent) === glyph
      && !child.querySelector("svg,ha-icon"),
  );
}

function stabilizePreview(modalId, selector, kind) {
  const modal = doc?.getElementById(modalId);
  const input = modal?.querySelector('input[name="icon"]');
  const preview = modal?.querySelector(selector);
  if (!input || !preview) return false;
  const token = clean(input.value || (kind === "room" ? "mdi:home" : "mdi:star"));
  const glyph = kind === "room" ? roomGlyph(token) : actionPickerGlyph(token);
  if (!hasStableGlyph(preview, kind, token, glyph)) {
    preview.replaceChildren(makeStableGlyph(kind, token, glyph));
  }
  preview.dataset.dmBeta17StableGlyph = `${token}|${glyph}`;
  preview.dataset.dmBeta12Colored = "true";
  preview.dataset.dmSingleGlyphOwner = "true";
  return true;
}

export function stabilizeEditorIconPreviews() {
  if (!doc) return false;
  const action = stabilizePreview(
    "dm-action-editor-modal",
    "[data-action-icon-preview]",
    "action",
  );
  const room = stabilizePreview(
    "dm-room-editor-modal",
    "[data-room-icon-preview]",
    "room",
  );
  return action || room;
}

function queuePreviewRepair() {
  if (state.repairQueued) return;
  state.repairQueued = true;
  const finalRepair = () => {
    state.repairQueued = false;
    stabilizeEditorIconPreviews();
  };
  // Existing editor handlers still write legacy SVG markup on input. Repair in
  // a nested microtask so their work is overwritten before the browser paints.
  root.queueMicrotask?.(() => root.queueMicrotask?.(finalRepair));
  root.requestAnimationFrame?.(finalRepair);
}

function closePicker(id) {
  doc?.getElementById(id)?.remove();
}

function closeConflictingPickers() {
  for (const id of ["dm-beta5-room-picker", "dm-icon-picker", "dm-visual-picker"]) {
    closePicker(id);
  }
}

function pickerShell(kind, title, searchPlaceholder, body) {
  const modal = doc.createElement("div");
  // Preserve the mature picker DOM contract so beta9/beta12 code and existing
  // regression tests keep working. The difference is that its initial DOM is
  // already the final coloured glyph DOM: no SVG-to-emoji replacement pass.
  modal.id = "dm-visual-picker";
  modal.className = `dm-section-modal dm-visual-picker dm-beta17-icon-picker dm-beta17-${kind}-picker`;
  modal.dataset.kind = kind;
  modal.dataset.dmBeta17Picker = kind;
  modal.dataset.dmBeta12Colored = "true";
  modal.dataset.dmSingleGlyphOwner = "true";
  modal.innerHTML = `<section class="dm-section-dialog dm-picker-dialog" role="dialog" aria-modal="true"><header><strong>${title}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header><div class="dm-picker-search"><input class="ed-input" type="search" placeholder="${esc(searchPlaceholder)}" data-search></div>${body}</section>`;
  doc.body.append(modal);
  const close = () => modal.remove();
  modal.querySelector("[data-close]")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  return { modal, close };
}

function stableGlyphMarkup(kind, token, glyph) {
  const className = stableGlyphClass(kind);
  return `<span class="${className}" data-token="${esc(token)}"><span aria-hidden="true">${glyph}</span></span>`;
}

export function openStableRoomPicker(input) {
  if (!doc || !input) return false;
  closeConflictingPickers();
  const english = doc.documentElement.lang === "en";
  const rows = ROOM_CATALOG.map((item) => ({
    value: item.mdi,
    label: english ? item.en : item.it,
    glyph: ROOM_GLYPHS[item.id] || roomGlyph(item.mdi),
    search: `${item.it} ${item.en} ${item.keywords} ${item.mdi}`.toLowerCase(),
  }));
  const buttons = rows
    .map(
      (item, index) => `<button type="button" class="dm-picker-option dm-beta17-room-option" data-index="${index}" data-search-text="${esc(item.search)}" aria-label="${esc(item.label)}" title="${esc(item.label)}"><span class="dm-picker-visual">${stableGlyphMarkup("room", item.value, item.glyph)}</span></button>`,
    )
    .join("");
  const { modal, close } = pickerShell(
    "room",
    english ? "😀 Choose icon" : "😀 Scegli l'icona",
    english ? "🔍 Search (e.g. water, door, fire)…" : "🔍 Cerca (es. acqua, porta, fuoco)…",
    `<div class="dm-picker-grid dm-beta17-room-grid">${buttons}</div>`,
  );
  const search = modal.querySelector("[data-search]");
  search?.addEventListener("input", () => {
    const query = clean(search.value).toLowerCase();
    modal.querySelectorAll(".dm-beta17-room-option").forEach((button) => {
      button.hidden = Boolean(query) && !clean(button.dataset.searchText).includes(query);
    });
  });
  modal.querySelectorAll(".dm-beta17-room-option").forEach((button) => {
    button.addEventListener("click", () => {
      const item = rows[Number(button.dataset.index)];
      if (!item) return;
      input.value = item.value;
      emitChange(input);
      stabilizeEditorIconPreviews();
      close();
    });
  });
  root.setTimeout?.(() => search?.focus(), 20);
  return true;
}

export function openStableActionPicker(input) {
  if (!doc || !input) return false;
  closeConflictingPickers();
  const english = doc.documentElement.lang === "en";
  const rows = ACTION_ICON_CATALOG.map((item) => ({
    value: item.mdi,
    label: english ? item.en : item.it,
    glyph: item.glyph || actionPickerGlyph(item.mdi),
    search: `${item.it} ${item.en} ${item.id} ${item.mdi}`.toLowerCase(),
  }));
  const buttons = rows
    .map(
      (item, index) => `<button type="button" class="dm-picker-option dm-beta17-action-option" data-index="${index}" data-search-text="${esc(item.search)}"><span class="dm-picker-visual">${stableGlyphMarkup("action", item.value, item.glyph)}</span><b>${esc(item.label)}</b></button>`,
    )
    .join("");
  const { modal, close } = pickerShell(
    "action",
    english ? "⚡ Choose action icon" : "⚡ Scegli icona azione",
    english ? "🔍 Search…" : "🔍 Cerca…",
    `<div class="dm-picker-grid dm-beta17-action-grid">${buttons}</div>`,
  );
  const search = modal.querySelector("[data-search]");
  search?.addEventListener("input", () => {
    const query = clean(search.value).toLowerCase();
    modal.querySelectorAll(".dm-beta17-action-option").forEach((button) => {
      button.hidden = Boolean(query) && !clean(button.dataset.searchText).includes(query);
    });
  });
  modal.querySelectorAll(".dm-beta17-action-option").forEach((button) => {
    button.addEventListener("click", () => {
      const item = rows[Number(button.dataset.index)];
      if (!item) return;
      input.value = item.value;
      emitChange(input);
      stabilizeEditorIconPreviews();
      close();
    });
  });
  root.setTimeout?.(() => search?.focus(), 20);
  return true;
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
    // Scoped to the Temperature page only. If old runtime code writes the
    // meaningless status again, the observer hides it in the mutation microtask
    // before the next paint instead of polling the whole document.
    state.temperatureObserver = new root.MutationObserver(hideTemperatureProgressCopy);
    state.temperatureObserver.observe(page, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }
  return true;
}

function roomInputForActivation(target) {
  if (target?.closest?.(".dm-beta5-room-icon-trigger")) {
    return doc.getElementById("ed-room-icon");
  }
  const preview = target?.closest?.("#dm-room-editor-modal [data-room-icon-preview]");
  return preview?.closest?.("#dm-room-editor-modal")?.querySelector?.('input[name="icon"]') || null;
}

function actionInputForActivation(target) {
  const preview = target?.closest?.("#dm-action-editor-modal [data-action-icon-preview]");
  return preview?.closest?.("#dm-action-editor-modal")?.querySelector?.('input[name="icon"]') || null;
}

function handlePickerActivation(event) {
  if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
  const target = event.target;
  const roomInput = roomInputForActivation(target);
  if (roomInput) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openStableRoomPicker(roomInput);
    return;
  }
  const actionInput = actionInputForActivation(target);
  if (actionInput) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openStableActionPicker(actionInput);
  }
}

function installStyle() {
  if (!doc?.head || doc.getElementById("dm-beta17-final-icon-polish-style")) return;
  const style = doc.createElement("style");
  style.id = "dm-beta17-final-icon-polish-style";
  style.textContent = `
    [data-dm-beta17-temperature-progress-hidden="true"]{display:none!important}
    #dm-action-editor-modal [data-action-icon-preview] svg,
    #dm-room-editor-modal [data-room-icon-preview] svg{display:none!important}
    #dm-visual-picker.dm-beta17-icon-picker .dm-picker-search{padding:12px 18px 8px!important}
    #dm-visual-picker.dm-beta17-icon-picker .dm-picker-search .ed-input{width:100%!important;box-sizing:border-box!important}
    #dm-visual-picker.dm-beta17-icon-picker[data-kind="room"] .dm-picker-dialog{width:min(880px,calc(100vw - 28px))!important}
    #dm-visual-picker.dm-beta17-icon-picker[data-kind="room"] .dm-beta17-room-grid{display:grid!important;grid-template-columns:repeat(7,minmax(0,1fr))!important;gap:8px!important;padding:4px 18px 20px!important;max-height:58vh!important;overflow:auto!important}
    #dm-visual-picker.dm-beta17-icon-picker[data-kind="room"] .dm-beta17-room-option{display:grid!important;place-items:center!important;box-sizing:border-box!important;min-width:0!important;min-height:54px!important;padding:6px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:14px!important;background:var(--ha-card-background,var(--card-background-color,#fff))!important;cursor:pointer!important;transform:none!important;transition:border-color .12s ease,box-shadow .12s ease!important}
    #dm-visual-picker.dm-beta17-icon-picker[data-kind="room"] .dm-picker-visual{display:grid!important;place-items:center!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:30px!important;line-height:1!important}
    #dm-visual-picker.dm-beta17-icon-picker[data-kind="room"] .dm-beta17-room-option:focus-visible{outline:2px solid var(--primary-color,#0ea5e9)!important;outline-offset:2px!important}
    #dm-visual-picker.dm-beta17-icon-picker .dm-picker-option[hidden]{display:none!important}
    #dm-visual-picker.dm-beta17-icon-picker[data-kind="action"] .dm-picker-dialog{width:min(760px,calc(100vw - 24px))!important}
    #dm-visual-picker.dm-beta17-icon-picker[data-kind="action"] .dm-beta17-action-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;padding:4px 14px 18px!important;max-height:58vh!important;overflow:auto!important}
    #dm-visual-picker.dm-beta17-icon-picker[data-kind="action"] .dm-beta17-action-option{display:grid!important;place-items:center!important;align-content:center!important;gap:10px!important;box-sizing:border-box!important;min-width:0!important;min-height:108px!important;padding:12px 8px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;background:var(--ha-card-background,var(--card-background-color,#fff))!important;color:var(--primary-text-color,#0f172a)!important;cursor:pointer!important;transform:none!important;transition:border-color .12s ease,box-shadow .12s ease!important}
    #dm-visual-picker.dm-beta17-icon-picker[data-kind="action"] .dm-picker-visual{display:grid!important;place-items:center!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:34px!important;line-height:1!important}
    #dm-visual-picker.dm-beta17-icon-picker[data-kind="action"] .dm-beta17-action-option b{font-size:13px!important;line-height:1.15!important;text-align:center!important;white-space:normal!important}
    @media(max-width:560px){
      #dm-visual-picker.dm-beta17-icon-picker .dm-picker-dialog{width:calc(100vw - 18px)!important}
      #dm-visual-picker.dm-beta17-icon-picker[data-kind="room"] .dm-beta17-room-grid{gap:6px!important;padding:4px 10px 16px!important}
      #dm-visual-picker.dm-beta17-icon-picker[data-kind="room"] .dm-beta17-room-option{min-height:48px!important;border-radius:12px!important}
      #dm-visual-picker.dm-beta17-icon-picker[data-kind="room"] .dm-picker-visual{font-size:27px!important}
      #dm-visual-picker.dm-beta17-icon-picker[data-kind="action"] .dm-beta17-action-grid{gap:6px!important;padding:4px 10px 16px!important}
      #dm-visual-picker.dm-beta17-icon-picker[data-kind="action"] .dm-beta17-action-option{min-height:96px!important;padding:10px 5px!important;border-radius:14px!important}
      #dm-visual-picker.dm-beta17-icon-picker[data-kind="action"] .dm-picker-visual{font-size:31px!important}
      #dm-visual-picker.dm-beta17-icon-picker[data-kind="action"] .dm-beta17-action-option b{font-size:12px!important}
    }
  `;
  doc.head.append(style);
}

function install() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle();
  // This module is generated before beta-entry, therefore its capture listener
  // wins before the historical first-insert picker can stop propagation.
  doc.addEventListener("click", handlePickerActivation, true);
  doc.addEventListener("keydown", handlePickerActivation, true);
  doc.addEventListener("click", queuePreviewRepair, true);
  doc.addEventListener("input", queuePreviewRepair, true);
  doc.addEventListener("change", queuePreviewRepair, true);
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
  ]) {
    root.addEventListener?.(eventName, () => {
      bindTemperatureProgressGuard();
      queuePreviewRepair();
    });
  }
  root.addEventListener?.("dashboardmodern:state-changed", hideTemperatureProgressCopy);
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", bindTemperatureProgressGuard, { once: true });
  } else {
    bindTemperatureProgressGuard();
  }
  queuePreviewRepair();
}

install();
