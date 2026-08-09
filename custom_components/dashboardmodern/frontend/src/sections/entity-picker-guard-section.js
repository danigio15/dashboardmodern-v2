import { clean, doc, installStyle, root, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENTITY_PICKER_GUARD__";
const state = (root[KEY] ||= { installed: false, frame: 0, subscribed: false });
const ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i;

function isEntityInput(input) {
  if (!(input instanceof HTMLInputElement) || input.type === "hidden") return false;
  if (input.dataset.entityInput === "true" || input.closest("[data-entity-field]")) return true;
  if (input.matches(".ed-slot-in[data-ref],input[data-domain]")) return true;
  const id = clean(input.id).toLowerCase();
  if (/^(?:luce|light)-add-ent$|^appl-ent-new$|^ed-(?:pl-|irr-|tp-|luce-|cam-|avv-)/.test(id)) return true;
  const reference = clean(input.dataset.ref);
  if (reference && /(?:entity|entita|sensore|sensor|switch|climate|light|cover|camera|power|energy|temp|humid|weather|rain|pump)/i.test(reference)) return true;
  const placeholder = clean(input.placeholder);
  if (/^(sensor|binary_sensor|switch|light|cover|climate|camera|weather|automation|script|scene|select|number|input_[a-z_]+)\./i.test(placeholder)) return true;
  if (ENTITY_ID.test(clean(input.value)) && input.classList.contains("mono")) return true;
  return Boolean(input.nextElementSibling?.matches?.(".dm-entity-picker,button[onclick*='wzPickEntity']"));
}

function ensureId(input) {
  if (input.id) return input.id;
  input.id = `dm-entity-${Math.random().toString(36).slice(2, 10)}`;
  return input.id;
}

function choose(input) {
  if (!input?.isConnected) return;
  try {
    root.wzPickEntity?.(input);
  } catch (_error) {
    try { root.wzPickEntity?.(`#${input.id}`); } catch (_ignore) {}
  }
}

function mountOne(input) {
  if (!isEntityInput(input)) return false;
  const id = ensureId(input);
  input.dataset.entityInput = "true";
  let button = input.nextElementSibling?.matches?.(".dm-entity-picker,button[onclick*='wzPickEntity']") ? input.nextElementSibling : null;
  if (!button) {
    button = input.parentElement?.querySelector?.(`.dm-entity-picker[data-entity-target="${CSS.escape(id)}"]`) || null;
  }
  if (!button) {
    button = doc.createElement("button");
    button.type = "button";
    button.className = "dm-entity-picker";
    button.textContent = "🔍";
    input.insertAdjacentElement("afterend", button);
  }
  button.classList.add("dm-entity-picker");
  button.type = "button";
  button.dataset.entityTarget = id;
  button.setAttribute("aria-label", `Seleziona entità per ${input.getAttribute("aria-label") || input.name || id}`);
  button.removeAttribute("onclick");
  button.onclick = null;
  if (button.dataset.dmPersistentPicker !== "true") {
    button.dataset.dmPersistentPicker = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      choose(input);
    });
  }
  const parent = input.parentElement;
  if (parent && ["LABEL", "SPAN", "DIV"].includes(parent.tagName)) parent.classList.add("dm-entity-picker-row");
  return true;
}

export function reconcileEntityPickers(scope = doc) {
  if (!scope?.querySelectorAll) return 0;
  try { root.DashboardModernModules?.render?.mountEntityPickers?.(scope); } catch (_error) {}
  let count = 0;
  scope.querySelectorAll("input").forEach((input) => { if (mountOne(input)) count += 1; });
  return count;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    for (const scope of [doc.getElementById("ed-body"), doc.getElementById("editor-modal"), doc.getElementById("setup-wizard"), ...doc.querySelectorAll(".dm-section-modal")].filter(Boolean)) {
      reconcileEntityPickers(scope);
    }
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
