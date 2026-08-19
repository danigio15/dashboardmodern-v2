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
import { isRetiredEditorSlot } from "../core/editor-slots.js";
import { clean, doc, root, installStyle, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_EDITOR_SLOTS__";
const STYLE_ID = "dm-editor-slots-style";
const state = (root[KEY] ||= { installed: false, frame: 0, pending: 0, retries: 0 });

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

/* Rows the configuration no longer offers, taken out of the form.
 *
 * The runtime tries to hide these two itself, with an inline `display:none`
 * that the row skin below overrides — an inline declaration cannot beat
 * `!important`, so they came back. Taking the whole row out is the one answer
 * that holds whichever owner paints last. The editor's save walks the rows that
 * are present, so a row that is gone simply stops being written, and the
 * override already stored behind it is never touched.
 *
 * Only a complete `.ed-slot` row is ever removed. A bare field with no row of
 * its own belongs to some other form and is left exactly where it is — the
 * fields this section decorates are never removed, only hidden. */
export function dropRetiredSlots(scope = doc?.getElementById("ed-body")) {
  if (!scope?.querySelectorAll) return 0;
  let dropped = 0;
  for (const input of scope.querySelectorAll(".ed-slot-in[data-ref]")) {
    if (!isRetiredEditorSlot(input.dataset.ref)) continue;
    const row = input.closest(".ed-slot");
    if (!row) continue;
    row.remove();
    dropped += 1;
  }
  return dropped;
}

/* The same readable row, on every entity field in the configuration.
 *
 * The accordions of the Sezioni tab were the only place that got it. Everywhere
 * else — Luci, Telecamere, Report, Temperature, Irrigazione — a field still
 * asked for an entity id in a text box with a lens beside it, so the same job
 * was done two different ways depending on which tab you happened to open.
 *
 * The rule for what is an entity field is not restated here: the picker guard
 * already decides that, and marks what it decides with `data-entity-input`.
 * This turns each of those into the same row: what is chosen, or an invitation
 * to choose. The field and its lens stay in the document, one tap away under
 * the pencil, because they are what the editors read when they save.
 */
const CHIP_MARKER = "dmEntityChip";

const NEVER_A_HOST = "#ed-body,.ed-body,.ed-list,.ed-form,.ed-shell,#editor-modal,#setup-wizard,.dm-section-dialog,form,body";

/** The lens the editors put next to an entity field, if it is there. */
function lensOf(input) {
  return input.nextElementSibling?.matches?.(".dm-entity-picker") ? input.nextElementSibling : null;
}

/* Where the row goes.
 *
 * The lens has to stay exactly where it is — it is the input's next sibling,
 * and that pair is what the picker guard and the editors' own mount step
 * reconcile; moving it makes them mount a second lens. So the row is built
 * around it: the host is the element that already holds the pair. */
function chipHost(input, lens) {
  const wrapper = input.parentElement;
  if (!wrapper || wrapper.matches(NEVER_A_HOST) || !wrapper.contains(lens)) return null;
  return wrapper;
}

function paintFieldChip(host) {
  const input = host.querySelector("input[data-entity-input]");
  const chip = host.querySelector(".dm-entity-picker.dm-slot-chip");
  if (!input || !chip) return;
  const value = clean(input.value);
  const label = entityLabel(value);
  // Only ever write what actually changed. The editors watch their own panels
  // for mutations and re-render when they see one, and a re-render throws away
  // the draft the open form is collecting — so a row that repaints itself with
  // identical content would quietly cost the user the value being typed.
  const mapped = value ? "mapped" : "empty";
  if (host.dataset.dmSlot !== mapped) host.dataset.dmSlot = mapped;
  const name = chip.querySelector("[data-chip-name]");
  const id = chip.querySelector("[data-chip-id]");
  if (!name || !id) return;
  const nameText = value ? label || value : t("Scegli entità", "Choose entity");
  const idText = value && label ? value : "";
  if (name.textContent !== nameText) name.textContent = nameText;
  if (id.textContent !== idText) id.textContent = idText;
  const fieldName =
    clean(input.closest(".ed-slot,[data-entity-field]")?.querySelector(".ed-slot-lbl")?.textContent) ||
    clean(input.getAttribute("aria-label")) ||
    t("Entità", "Entity");
  chip.setAttribute("aria-label", `${fieldName}: ${nameText}`);
}

/* One entity field, made readable.
 *
 * The lens becomes the row: same button, same handler, same
 * `data-entity-target` — it simply stops being a 50px square with a magnifier
 * in it and starts saying what is chosen, or inviting a choice. The raw id
 * field goes behind the pencil next to it, which is where the Sezioni tab has
 * kept it since it got these rows. */
function decorateField(input) {
  // A slot of a section accordion belongs to the row decorator above, which
  // builds its own chip: giving it a second one leaves two rows saying the same
  // thing, and the one the editor repaints is then anyone's guess.
  if (input.closest(".dm-slot") || input.matches(".ed-slot-in[data-ref]")) return false;
  const lens = lensOf(input);
  if (!lens) return false;
  const host = chipHost(input, lens);
  if (!host) return false;
  if (host.dataset[CHIP_MARKER] === "true") {
    paintFieldChip(host);
    return false;
  }
  host.dataset[CHIP_MARKER] = "true";
  input.classList.add("dm-chip-raw");
  lens.classList.add("dm-slot-chip");
  lens.innerHTML = chipMarkup();

  const manual = doc.createElement("button");
  manual.type = "button";
  manual.className = "dm-chip-manual";
  manual.textContent = "✎";
  manual.setAttribute("aria-label", t("Modifica manuale", "Edit by hand"));
  manual.setAttribute("aria-pressed", "false");
  manual.addEventListener("click", (event) => {
    event.preventDefault();
    const on = host.dataset.dmEntityRaw !== "true";
    host.dataset.dmEntityRaw = on ? "true" : "false";
    manual.setAttribute("aria-pressed", String(on));
    if (on) input.focus();
  });
  // After the lens, never between the field and the lens: that pair is a
  // contract every other owner of these forms reconciles.
  lens.insertAdjacentElement("afterend", manual);

  // After the form's own change handlers, never during them.
  input.addEventListener("change", () => {
    if (typeof root.requestAnimationFrame !== "function") {
      paintFieldChip(host);
      return;
    }
    root.requestAnimationFrame(() => paintFieldChip(host));
  });
  paintFieldChip(host);
  return true;
}

/* Returns how many fields are still waiting for their row.
 *
 * The lens is mounted by the picker guard on its own frame, and the row is
 * built around the lens — so a field reached before its lens exists has to be
 * come back for, or it stays a bare id box while every other field is a row. */
export function decorateEntityFields(scope = doc?.getElementById("ed-body")) {
  if (!scope?.querySelectorAll) return 0;
  let pending = 0;
  for (const input of scope.querySelectorAll('input[data-entity-input="true"]')) {
    if (
      input.closest(".dm-slot") ||
      input.matches(".ed-slot-in[data-ref]") ||
      input.closest('[data-dm-entity-chip="true"]')
    ) {
      continue;
    }
    if (!decorateField(input)) pending += 1;
  }
  return pending;
}

export function decorateEditorSlots(scope = doc?.getElementById("ed-body")) {
  if (!scope) return 0;
  dropRetiredSlots(scope);
  let count = 0;
  for (const body of scope.querySelectorAll(".ed-acc-body")) if (decorateBody(body)) count += 1;
  state.pending = decorateEntityFields(scope);
  return count;
}

const MAX_RETRIES = 6;

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    let pending = 0;
    for (const scope of [
      doc?.getElementById("ed-body"),
      doc?.getElementById("editor-modal"),
      doc?.getElementById("setup-wizard"),
      ...(doc?.querySelectorAll?.(".dm-section-modal") || []),
    ].filter(Boolean)) {
      decorateEditorSlots(scope);
      pending += state.pending;
    }
    // A field whose lens has not been mounted yet gets one more frame, a
    // bounded number of times, instead of staying a bare id box for good.
    if (pending && (state.retries || 0) < MAX_RETRIES) {
      state.retries = (state.retries || 0) + 1;
      schedule();
      return;
    }
    state.retries = 0;
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

/* the same row, on every other entity field in the configuration */
[data-dm-entity-chip="true"]{min-width:0!important;flex-wrap:wrap!important}
[data-dm-entity-chip="true"]>.dm-entity-picker.dm-slot-chip{
  display:flex!important;align-items:center!important;gap:10px!important;
  flex:1 1 auto!important;width:auto!important;min-width:0!important;
  height:auto!important;min-height:44px!important;padding:9px 11px!important;
  border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:12px!important;
  background:var(--secondary-background-color,#f6f8fb)!important;color:var(--text,#0f172a)!important;
  box-shadow:none!important;font:inherit!important;font-size:inherit!important;text-align:left!important
}
[data-dm-entity-chip="true"]>.dm-entity-picker.dm-slot-chip:hover{
  transform:none!important;filter:none!important;border-color:var(--primary-color,#0ea5e9)!important
}
[data-dm-entity-chip="true"] .dm-chip-manual{
  flex:0 0 44px!important;width:44px!important;min-width:44px!important;height:44px!important;padding:0!important;
  border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:12px!important;
  background:var(--secondary-background-color,#f6f8fb)!important;color:var(--secondary-text-color,#64748b)!important;
  font-size:14px!important;line-height:1!important;cursor:pointer!important
}
[data-dm-entity-chip="true"] .dm-chip-manual[aria-pressed="true"]{
  border-color:var(--primary-color,#0ea5e9)!important;color:var(--primary-color,#0ea5e9)!important;
  background:color-mix(in srgb,var(--primary-color,#0ea5e9) 8%,transparent)!important
}
[data-dm-entity-chip="true"]:not([data-dm-entity-raw="true"])>.dm-chip-raw{display:none!important}
[data-dm-entity-chip="true"][data-dm-entity-raw="true"]>.dm-chip-raw{flex:1 1 100%!important;order:9!important;grid-column:1/-1!important}

/* Some forms lay their entity row out themselves — the "Aggiungi luce" form
 * pins its own two column grid and its own id'd field to display:block, which
 * outweighs the rules above and left that one row showing the raw id next to a
 * chip squeezed into a 58px column. The id is repeated so the row that carries
 * a chip is laid out by the chip's own rules wherever it is, and the raw field
 * stays behind the pencil on every tab. */
#ed-body#ed-body [data-dm-entity-chip="true"]{
  display:flex!important;align-items:center!important;gap:9px!important;flex-wrap:wrap!important;
  grid-template-columns:none!important;min-width:0!important
}
#ed-body#ed-body [data-dm-entity-chip="true"]>.dm-entity-picker.dm-slot-chip{
  flex:1 1 auto!important;width:auto!important;min-width:0!important;max-width:none!important;
  height:auto!important;min-height:44px!important
}
#ed-body#ed-body [data-dm-entity-chip="true"] .dm-chip-manual{
  flex:0 0 44px!important;width:44px!important;min-width:44px!important;max-width:44px!important;height:44px!important
}
#ed-body#ed-body [data-dm-entity-chip="true"]:not([data-dm-entity-raw="true"])>.dm-chip-raw{display:none!important}
#ed-body#ed-body [data-dm-entity-chip="true"][data-dm-entity-raw="true"]>.dm-chip-raw{
  display:block!important;flex:1 1 100%!important;order:9!important;width:100%!important;max-width:100%!important
}
  `);
}

/* The legacy entry points that print the editor.
 *
 * Attached when this module loads, and again on the ready events for the
 * opposite order — `wrapFunction` is a no-op while the legacy global is still
 * undefined, so trying twice costs nothing.
 *
 * Attaching only inside the ready handlers, as before, meant never attaching at
 * all whenever the bundle finished loading after the runtime had already
 * announced itself: the handler simply never ran. The editor then printed rows
 * that nothing scheduled a pass for, and they stayed raw entity fields until
 * the next click. `editorSwitch` carried the markers of a dozen other owners
 * and none of this one, which is what gave it away.
 *
 * Opening the editor is wrapped too, not just the tab switch: it is the moment
 * the rows appear, so it is the moment they need decorating. */
function bindLegacyEntryPoints() {
  wrapFunction("editorSwitch", "__dmEditorSlots_editorSwitch", schedule);
  wrapFunction("apriConfigEntita", "__dmEditorSlots_apriConfigEntita", schedule);
}

export function installEditorSlotsSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  /* A panel printed after the last pass would keep the raw field and the lens:
   * the Temperatura form is drawn by its own owner and lands late on a phone.
   * Whoever notices the editor changing can ask for another pass through this,
   * so the rows follow the tab however slowly it finishes drawing. */
  root.__DASHBOARDMODERN_DECORATE_ENTITY_FIELDS__ = () => schedule();
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
