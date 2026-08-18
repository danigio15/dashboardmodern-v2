import { clean, doc, installStyle, root, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENTITY_PICKER_GUARD__";
const state = (root[KEY] ||= { installed: false, frame: 0, subscribed: false });
const ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i;
// An entity_id can only be typed into a free-text field. Every other input type
// in the editors holds a duration, a threshold, a time or a flag, so a lens
// button next to it offers something the field cannot accept.
const PICKABLE_TYPES = new Set(["text", "search", "url"]);
// Editor ids that sit under an entity-shaped prefix but hold plain text: the
// Alerts form reuses ed-avv-* for entity, display name, comparison value and
// icon, and the camera / irrigation / shutter forms reuse their prefix for the
// name the user gives the device and for the go2rtc stream name.
const NON_ENTITY_IDS = new Set([
  "ed-avv-name",
  "ed-avv-val",
  "ed-avv-icon",
  "ed-cam-name",
  "ed-cam-stream",
  "ed-irr-name",
  "ed-tp-name",
]);

function isEntityInput(input) {
  if (!(input instanceof HTMLInputElement) || !PICKABLE_TYPES.has(input.type)) return false;
  const id = clean(input.id).toLowerCase();
  // Check the exclusions before the generic data-entity marker because an older
  // guard may already have decorated one of those text inputs during the
  // current render.
  if (NON_ENTITY_IDS.has(id)) return false;
  // Of the whole ed-avv-* family only ed-avv-ent is an entity_id.
  if (id.startsWith("ed-avv-")) return id === "ed-avv-ent";
  if (input.dataset.entityInput === "true" || input.closest("[data-entity-field]")) return true;
  if (input.matches(".ed-slot-in[data-ref],input[data-domain]")) return true;
  if (/^(?:luce|light)-add-ent$|^appl-ent-new$|^ed-(?:pl-|irr-|tp-|luce-|cam-)/.test(id)) return true;
  const reference = clean(input.dataset.ref);
  if (reference && /(?:entity|entita|sensore|sensor|switch|climate|light|cover|camera|power|energy|temp|humid|weather|rain|pump)/i.test(reference)) return true;
  const placeholder = clean(input.placeholder);
  if (/^(sensor|binary_sensor|switch|light|cover|climate|camera|weather|automation|script|scene|select|number|input_[a-z_]+)\./i.test(placeholder)) return true;
  if (ENTITY_ID.test(clean(input.value)) && input.classList.contains("mono")) return true;
  return Boolean(input.nextElementSibling?.matches?.(".dm-entity-picker,button[onclick*='wzPickEntity']"));
}

function cleanupFalsePicker(input) {
  if (!(input instanceof HTMLInputElement)) return false;
  const stale = NON_ENTITY_IDS.has(clean(input.id).toLowerCase()) || !PICKABLE_TYPES.has(input.type);
  if (!stale) return false;
  const parent = input.parentElement;
  const generated = input.nextElementSibling?.matches?.(".dm-entity-picker[data-dm-persistent-picker='true']")
    ? input.nextElementSibling
    : parent?.querySelector?.(`.dm-entity-picker[data-entity-target="${CSS.escape(input.id)}"][data-dm-persistent-picker="true"]`);
  generated?.remove();
  delete input.dataset.entityInput;
  if (parent?.classList.contains("dm-entity-picker-row") && !parent.querySelector("input[data-entity-input='true']")) {
    parent.classList.remove("dm-entity-picker-row");
  }
  return Boolean(generated);
}

function ensureId(input) {
  if (input.id) return input.id;
  input.id = `dm-entity-${Math.random().toString(36).slice(2, 10)}`;
  return input.id;
}

function choose(input) {
  if (!input?.isConnected) return;
  // Defensive cleanup only for stale overlays. There must never be two entity
  // picker dialogs with the same legacy id, otherwise selectors and focus break.
  const open = [...doc.querySelectorAll("#cd-entpick")];
  if (open.length > 1) open.slice(1).forEach((node) => node.remove());
  try {
    root.wzPickEntity?.(input);
  } catch (_error) {
    try { root.wzPickEntity?.(`#${input.id}`); } catch (_ignore) {}
  }
}

// .dm-entity-picker-row is display:flex with min-width:0 children, so it must
// only ever land on the little wrapper that holds the field and its button.
// The Tapparelle, Telecamere and Irrigazione forms put fields directly inside
// #ed-body, and flexing that laid the whole editor out as a row: the intro,
// every configured row, the inputs and the add button each collapsed into a
// column a few pixels wide, with the words broken one letter per line.
const NEVER_A_PICKER_ROW = "#ed-body,.ed-body,.ed-shell,#editor-modal,#setup-wizard,.ed-list,.dm-section-dialog,body";

function markPickerRow(parent) {
  if (!parent || !["LABEL", "SPAN", "DIV"].includes(parent.tagName)) return;
  if (parent.matches?.(NEVER_A_PICKER_ROW)) return;
  // A wrapper that holds more than the one field is a container, not a row.
  if (parent.querySelectorAll("input,select,textarea").length > 1) return;
  parent.classList.add("dm-entity-picker-row");
}

function mountOne(input) {
  cleanupFalsePicker(input);
  if (!isEntityInput(input)) return false;
  const id = ensureId(input);
  input.dataset.entityInput = "true";
  let button = input.nextElementSibling?.matches?.(".dm-entity-picker,button[onclick*='wzPickEntity']") ? input.nextElementSibling : null;
  if (!button) button = input.parentElement?.querySelector?.(`.dm-entity-picker[data-entity-target="${CSS.escape(id)}"]`) || null;

  // Existing buttons belong to the canonical editor and already own their
  // click handler. Never layer another listener on top: that was the source of
  // the intermittent double #cd-entpick dialog and the disappearing lens.
  const created = !button;
  if (created) {
    button = doc.createElement("button");
    button.type = "button";
    button.className = "dm-entity-picker";
    button.textContent = "🔍";
    button.dataset.dmPersistentPicker = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      choose(input);
    });
    input.insertAdjacentElement("afterend", button);
  }

  button.classList.add("dm-entity-picker");
  button.type = "button";
  button.dataset.entityTarget = id;
  button.setAttribute("aria-label", button.getAttribute("aria-label") || `Seleziona entità per ${input.getAttribute("aria-label") || input.name || id}`);
  markPickerRow(input.parentElement);
  return true;
}

export function reconcileEntityPickers(scope = doc) {
  if (!scope?.querySelectorAll) return 0;
  // Let the canonical renderer mount first. The guard only fills genuine gaps.
  try { root.DashboardModernModules?.render?.mountEntityPickers?.(scope); } catch (_error) {}
  // Take the flex row back off any container an earlier release flexed.
  for (const node of [scope, ...scope.querySelectorAll(NEVER_A_PICKER_ROW)]) {
    node?.classList?.remove?.("dm-entity-picker-row");
  }
  let count = 0;
  scope.querySelectorAll("input").forEach((input) => { if (mountOne(input)) count += 1; });
  return count;
}

function schedule() {
  // Energy Beta 27 can add a small group of entity fields synchronously during
  // editorSwitch(). Reconcile the active editor before returning so callers do
  // not observe a transient state with more picker buttons than entity inputs.
  const activeEditor = doc.getElementById("ed-body");
  if (activeEditor) reconcileEntityPickers(activeEditor);
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    for (const scope of [doc.getElementById("ed-body"), doc.getElementById("editor-modal"), doc.getElementById("setup-wizard"), ...doc.querySelectorAll(".dm-section-modal")].filter(Boolean)) {
      reconcileEntityPickers(scope);
    }
    const duplicates = [...doc.querySelectorAll("#cd-entpick")];
    if (duplicates.length > 1) duplicates.slice(1).forEach((node) => node.remove());
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function subscribeStore() {
  if (state.subscribed) return;
  const store = root.DashboardModernModules?.store;
  if (typeof store?.subscribe !== "function") return;
  state.subscribed = true;
  store.subscribe(() => schedule());
}

function installStyles() {
  installStyle("dm-entity-picker-guard-style", `
    .dm-entity-picker-row{display:flex!important;align-items:stretch!important;gap:8px!important;min-width:0!important}
    .dm-entity-picker-row>.ed-input,.dm-entity-picker-row>input{flex:1 1 auto!important;min-width:0!important}
    .dm-entity-picker{display:inline-grid!important;place-items:center!important;flex:0 0 50px!important;width:50px!important;min-width:50px!important;height:50px!important;min-height:50px!important;padding:0!important;border:0!important;border-radius:13px!important;background:linear-gradient(145deg,#12aee4,#047faf)!important;color:#fff!important;font-size:16px!important;cursor:pointer!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;box-shadow:0 7px 16px rgba(2,132,199,.17)!important}
    .dm-entity-picker:hover{transform:translateY(-1px)!important;filter:brightness(1.04)!important}
    .dm-entity-picker:focus-visible{outline:3px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 32%,transparent)!important;outline-offset:2px!important}
    @media(max-width:600px){.dm-entity-picker{flex-basis:46px!important;width:46px!important;min-width:46px!important;height:46px!important;min-height:46px!important}}
  `);
}

export function installEntityPickerGuardSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    for (const name of ["editorSwitch", "edFilterSez", "renderEditorTab", "renderEnergyEditorTab", "editorRenderLuci", "editorRenderStanze"]) {
      wrapFunction(name, `__dmPickerGuard_${name}`, schedule);
    }
    subscribeStore();
    schedule();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => { subscribeStore(); schedule(); });
  root.addEventListener?.("dashboardmodern:period-bundle", schedule);
  root.addEventListener?.("dashboardmodern:energy-bundle", schedule);
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.(".ed-tab,[data-tab],[data-dm-edit-kind],.ed-btn-add,.ed-save-btn,.ed-del")) root.setTimeout?.(schedule, 0);
  }, true);
  doc.addEventListener("change", (event) => {
    if (event.target?.closest?.("#editor-modal,#ed-body,.dm-section-modal,#setup-wizard")) root.setTimeout?.(schedule, 0);
  }, true);
  schedule();
}

installEntityPickerGuardSection();