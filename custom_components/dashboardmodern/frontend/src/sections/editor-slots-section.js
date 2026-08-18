// DM-FIX-20260817E
/* Entity slots in the editor, made readable.
 *
 * Every section tab listed the same thing: a label, a bare text field asking
 * for an entity id and a lens button next to it. Sixteen of those in a row —
 * the EV tab — read as a form to fill in by hand, when the entity is really
 * picked from a list.
 *
 * The row now shows what it is worth reading: whether the slot is mapped, the
 * friendly name of the entity behind it and its id underneath. Tapping the row
 * opens the picker the dashboard already has. The raw field stays in the DOM,
 * hidden, and comes back with "Modifica manuale" for whoever wants to type an
 * id straight in.
 *
 * Contracts preserved on purpose:
 * - the input keeps its `.ed-slot-in[data-ref]` class and its `edSetSlot`
 *   handler, so a value chosen here saves exactly like a typed one;
 * - the picker is the legacy `wzPickEntity()`, called with the input element:
 *   `cdEpChoose()` then writes the value and fires `change`, which is what the
 *   editor listens to;
 *   the legacy lens button is only hidden, never removed, so
 *   `entity-picker-guard-section.js` keeps seeing the pair it reconciles;
 * - `edSaveSezione()` still reads the same inputs from `.ed-acc-body`.
 *
 * Nothing here reads or writes Home Assistant state beyond the friendly name of
 * an entity already in `_RAW_STATES`.
 */
import { clean, doc, root, installStyle, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_EDITOR_SLOTS__";
const STYLE_ID = "dm-editor-slots-style";
const state = (root[KEY] ||= { installed: false, frame: 0 });

/** Friendly name Home Assistant knows for an entity, "" when it knows none. */
export function entityLabel(entity, states = root._RAW_STATES || root.STATES || {}) {
  const id = clean(entity);
  if (!id) return "";
  const name = clean(states?.[id]?.attributes?.friendly_name);
  return name && name !== id ? name : "";
}

/** How many slots of a section are mapped, for the accordion header. */
export function slotCounts(scope) {
  const inputs = [...(scope?.querySelectorAll?.(".ed-slot-in[data-ref]") || [])];
  const mapped = inputs.filter((input) => clean(input.value)).length;
  return { total: inputs.length, mapped };
}

function isSlotRow(slot) {
  // The loads editor reuses .ed-slot for its own form; it owns its layout.
  if (slot.closest("[data-load-form]")) return false;
  return Boolean(slot.querySelector(":scope .ed-slot-in[data-ref]"));
}

function chipMarkup() {
  return `<span class="dm-slot-chip-copy"><b data-chip-name></b><small data-chip-id></small></span><span class="dm-slot-chip-go" aria-hidden="true">›</span>`;
}

function decorate(slot) {
  if (!isSlotRow(slot)) return false;
  const input = slot.querySelector(".ed-slot-in[data-ref]");
  slot.classList.add("dm-slot");
  let chip = slot.querySelector(":scope > .dm-slot-chip");
  if (!chip) {
    chip = doc.createElement("button");
    chip.type = "button";
    chip.className = "dm-slot-chip";
    chip.innerHTML = chipMarkup();
    // Appended at the end of the row: the lens stays the input's next sibling,
    // which is the pair the entity picker guard reconciles.
    slot.append(chip);
    chip.addEventListener("click", (event) => {
      event.preventDefault();
      try {
        root.wzPickEntity?.(input);
      } catch (_error) {}
    });
    input.addEventListener("change", () => paint(slot));
  }
  paint(slot);
  return true;
}

function paint(slot) {
  const input = slot.querySelector(".ed-slot-in[data-ref]");
  const chip = slot.querySelector(":scope > .dm-slot-chip");
  if (!input || !chip) return;
  const value = clean(input.value);
  const label = entityLabel(value);
  slot.dataset.dmSlot = value ? "mapped" : "empty";
  const name = chip.querySelector("[data-chip-name]");
  const id = chip.querySelector("[data-chip-id]");
  const nameText = value ? label || value : t("Scegli entità", "Choose entity");
  const idText = value && label ? value : "";
  if (name.textContent !== nameText) name.textContent = nameText;
  if (id.textContent !== idText) id.textContent = idText;
  chip.setAttribute(
    "aria-label",
    `${clean(slot.querySelector(".ed-slot-lbl input")?.value) || clean(slot.querySelector(".ed-slot-lbl")?.textContent)}: ${nameText}`,
  );
}

function decorateBody(body) {
  let count = 0;
  for (const slot of body.querySelectorAll(".ed-slot")) if (decorate(slot)) count += 1;
  if (!count) return false;
  body.classList.add("dm-slots");
  if (!body.querySelector(":scope > .dm-slots-manual")) {
    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "dm-slots-manual";
    toggle.textContent = t("Modifica manuale", "Edit by hand");
    toggle.setAttribute("aria-pressed", "false");
    toggle.addEventListener("click", () => {
      const on = body.classList.toggle("dm-slots-raw");
      toggle.setAttribute("aria-pressed", String(on));
    });
    body.prepend(toggle);
  }
  const counts = slotCounts(body);
  const badge = body.closest("details")?.querySelector(".ed-acc-n");
  if (badge && counts.total) {
    const text = t(`${counts.mapped} su ${counts.total} mappate`, `${counts.mapped} of ${counts.total} mapped`);
    if (badge.textContent !== text) badge.textContent = text;
  }
  return true;
}

export function decorateEditorSlots(scope = doc?.getElementById("ed-body")) {
  if (!scope) return 0;
  let count = 0;
  for (const body of scope.querySelectorAll(".ed-acc-body")) if (decorateBody(body)) count += 1;
  return count;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    decorateEditorSlots();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function installStyles() {
  installStyle(STYLE_ID, `
.dm-slots{display:grid!important;gap:8px!important}
.dm-slots-manual{
  justify-self:end!important;margin:0 0 2px!important;padding:6px 12px!important;border:1px solid var(--divider-color,#dbe4ee)!important;
  border-radius:999px!important;background:transparent!important;color:var(--secondary-text-color,#64748b)!important;
  font-size:11.5px!important;font-weight:750!important;cursor:pointer!important
}
.dm-slots-manual[aria-pressed="true"]{
  border-color:var(--primary-color,#0ea5e9)!important;color:var(--primary-color,#0ea5e9)!important;
  background:color-mix(in srgb,var(--primary-color,#0ea5e9) 8%,transparent)!important
}
.dm-slots .dm-slot{
  display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:6px!important;
  margin:0!important;padding:11px 13px!important;border:1px solid var(--divider-color,#dbe4ee)!important;
  border-radius:16px!important;background:var(--card-background-color,#fff)!important
}
.dm-slots .dm-slot[data-dm-slot="mapped"]{border-color:color-mix(in srgb,#16a34a 30%,var(--divider-color,#dbe4ee))!important}
.dm-slots .dm-slot>.ed-slot-lbl{margin:0!important;display:flex!important;align-items:center!important;gap:8px!important}
.dm-slots .dm-slot>.ed-slot-lbl::before{
  content:"";width:7px;height:7px;border-radius:50%;flex:0 0 7px;
  background:var(--divider-color,#cbd5e1)
}
.dm-slots .dm-slot[data-dm-slot="mapped"]>.ed-slot-lbl::before{background:#16a34a}
.dm-slots .dm-slot .wz-lbl-edit{
  border:0!important;background:transparent!important;padding:0!important;width:100%!important;
  font-size:13px!important;font-weight:800!important;color:var(--text,#0f172a)!important
}
.dm-slots .dm-slot .wz-lbl-edit:focus{
  outline:2px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 45%,transparent)!important;
  outline-offset:3px!important;border-radius:6px!important
}
/* the raw field and its lens stay in the DOM: hidden until "Modifica manuale" */
.dm-slots:not(.dm-slots-raw) .dm-slot>div:has(>.ed-slot-in){display:none!important}
.dm-slots.dm-slots-raw .dm-slot>.dm-slot-chip{display:none!important}
.dm-slot-chip{
  display:flex!important;align-items:center!important;gap:10px!important;width:100%!important;
  padding:9px 11px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:12px!important;
  background:var(--secondary-background-color,#f6f8fb)!important;color:var(--text,#0f172a)!important;
  font:inherit!important;text-align:left!important;cursor:pointer!important;min-width:0!important
}
.dm-slot-chip:hover{border-color:var(--primary-color,#0ea5e9)!important}
.dm-slot-chip:focus-visible{outline:2px solid var(--primary-color,#0ea5e9)!important;outline-offset:2px!important}
.dm-slot-chip-copy{display:grid!important;gap:2px!important;min-width:0!important;flex:1 1 auto!important}
.dm-slot-chip-copy b{font-size:13px!important;font-weight:750!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
.dm-slot-chip-copy small{
  font-size:10.5px!important;font-family:ui-monospace,Menlo,monospace!important;
  color:var(--secondary-text-color,#64748b)!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important
}
.dm-slot[data-dm-slot="empty"] .dm-slot-chip-copy b{color:var(--secondary-text-color,#64748b)!important;font-weight:650!important}
.dm-slot-chip-go{flex:0 0 auto!important;font-size:18px!important;color:var(--secondary-text-color,#94a3b8)!important;line-height:1!important}
  `);
}

/* The legacy entry points that print the editor. Wrapping is attempted as early
 * as this module loads and again whenever the runtime announces itself, because
 * `wrapFunction` is a no-op until the legacy global exists: whichever happens
 * first, opening the editor or switching tab always schedules a pass.
 *
 * The wrap used to be attached only on `legacy-ready`/`runtime-ready`, so an
 * editor opened before that event carried undecorated rows until the event
 * finally landed — visible as raw entity fields for a beat, and long enough to
 * be missed entirely under load. */
function bindLegacyEntryPoints() {
  wrapFunction("editorSwitch", "__dmEditorSlots_editorSwitch", schedule);
  wrapFunction("apriConfigEntita", "__dmEditorSlots_apriConfigEntita", schedule);
}

export function installEditorSlotsSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  for (const eventName of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"]) {
    root.addEventListener?.(eventName, () => {
      bindLegacyEntryPoints();
      schedule();
    });
  }
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.(".ed-tab,[data-tab],.ed-acc-head,.ed-save-btn,.ed-btn-add,.ed-del")) {
        root.setTimeout?.(schedule, 0);
      }
    },
    true,
  );
  bindLegacyEntryPoints();
  schedule();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installEditorSlotsSection, { once: true });
} else {
  installEditorSlotsSection();
}
