import { applianceArtwork } from "../core/appliance-artwork.js";
import {
  APPLIANCE_CATALOG,
  applianceCatalogLabel,
  canonicalApplianceVisualKey,
} from "../core/device-model.js";
import {
  clean,
  dashboardStore,
  doc,
  esc,
  readJson,
  root,
  section,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCE_EDITOR_SECTION__";
const state = (root[KEY] ||= { installed: false, previousEdit: null, previousPicker: null });

function locale() {
  return doc?.documentElement?.lang === "en" ? "en" : "it";
}

function appliances() {
  const stored = dashboardStore()?.getSection?.("appliances");
  return Array.isArray(stored) ? stored.slice() : readJson("cd_appliances", []);
}

function roomOptions(selected) {
  const rooms = section("rooms", readJson("cd_stanze", []));
  return [
    `<option value="">— ${t("Nessuna stanza", "No room")} —</option>`,
    ...rooms.map((room) => {
      const value = clean(room.id || room.name);
      const active = [room.id, room.name].map(clean).includes(clean(selected));
      return `<option value="${esc(value)}" ${active ? "selected" : ""}>${esc(room.icon || "🏠")} ${esc(room.name || value)}</option>`;
    }),
  ].join("");
}

function editorVisualKey(value) {
  return canonicalApplianceVisualKey(value) || "";
}

function deviceVisualKey(device = {}) {
  const explicit = [device.visual_key, device.device_type, device.icon, device.type]
    .map(editorVisualKey)
    .filter(Boolean);
  const specific = explicit.find((key) => key !== "generico");
  if (specific) return specific;
  // 0.15.19/0.15.20 could save the first select option (`generico`) when an
  // appliance type was absent from the short Edit-only list. Recover those
  // records from their human name without touching their entity links.
  const named = editorVisualKey(device.name);
  return named || explicit[0] || "generico";
}

function catalogItem(value) {
  const key = editorVisualKey(value) || "generico";
  return APPLIANCE_CATALOG.find((item) => item.key === key) || APPLIANCE_CATALOG.at(-1);
}

function typeIconMarkup(value, size = 42) {
  const key = editorVisualKey(value) || "generico";
  const legacy = root.cdApplianceIcon?.(key, size);
  if (legacy) return legacy;
  const artwork = applianceArtwork(key, size);
  if (artwork) return artwork;
  return `<span class="dm-appliance-editor-fallback">🔌</span>`;
}

function typeLabel(value) {
  return applianceCatalogLabel(value, locale());
}

function openTypePicker({ selected = "generico", onSelect } = {}) {
  doc?.getElementById("dm-applpick")?.remove();
  const selectedKey = editorVisualKey(selected) || "generico";
  const overlay = doc.createElement("div");
  overlay.id = "dm-applpick";
  overlay.className = "dm-appliance-type-picker";
  overlay.innerHTML = `<section class="dm-appliance-type-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-appliance-type-picker-title">
    <strong id="dm-appliance-type-picker-title">${t("Scegli l'elettrodomestico", "Choose appliance")}</strong>
    <div class="dm-appliance-type-grid" role="listbox"></div>
    <button type="button" class="dm-appliance-type-close">${t("Chiudi", "Close")}</button>
  </section>`;
  const grid = overlay.querySelector(".dm-appliance-type-grid");
  APPLIANCE_CATALOG.forEach((item) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "dm-appliance-type-option";
    button.dataset.applianceType = item.key;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(item.key === selectedKey));
    button.innerHTML = `<span class="dm-appliance-type-option-icon">${typeIconMarkup(item.key, 30)}</span><span>${esc(item[locale()] || item.it)}</span>`;
    button.addEventListener("click", () => {
      overlay.remove();
      onSelect?.(item.key);
    });
    grid.append(button);
  });
  overlay.querySelector(".dm-appliance-type-close")?.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  doc.body.append(overlay);
  return overlay;
}

function installPickerOverride() {
  const current = root.dmAppliancePicker;
  if (typeof current !== "function" || current.__dmCanonicalAppliancePicker) return false;
  state.previousPicker ||= current;
  function canonicalAppliancePicker() {
    const hidden = doc.getElementById("appl-icon");
    const button = doc.getElementById("appl-icon-btn");
    const name = doc.getElementById("appl-name");
    openTypePicker({
      selected: hidden?.value || "generico",
      onSelect(key) {
        if (hidden) hidden.value = key;
        if (button) {
          button.innerHTML = typeIconMarkup(key, 30);
          button.dataset.applianceType = key;
          button.setAttribute("aria-label", typeLabel(key));
        }
        if (name && !clean(name.value)) name.value = typeLabel(key);
      },
    });
  }
  canonicalAppliancePicker.__dmCanonicalAppliancePicker = true;
  canonicalAppliancePicker.__dmPrevious = current;
  root.dmAppliancePicker = canonicalAppliancePicker;
  return true;
}

function entityCandidates(device = {}) {
  return [...new Set([
    device.control_entity,
    device.switch_entity,
    device.switch,
    device.light,
    device.fan,
    device.power_entity,
    device.power,
    device.power_sensor,
    ...(device.entities || []).map((entry) =>
      clean(typeof entry === "string" ? entry : entry?.entity || entry?.entity_id),
    ),
  ].map(clean).filter(Boolean))];
}

function inferredControlEntity(device) {
  return entityCandidates(device).find((entity) => /^(switch|light|input_boolean|fan)\./i.test(entity)) || "";
}

function inferredPowerEntity(device) {
  const candidates = entityCandidates(device);
  return candidates.find((entity) => {
    const current = root.STATES?.[entity] || root._RAW_STATES?.[entity];
    const unit = clean(current?.attributes?.unit_of_measurement).toLowerCase();
    return ["w", "kw", "mw"].includes(unit);
  }) || "";
}

function cumulativeEntity(value) {
  const entity = clean(value);
  if (!entity) return false;
  const current = root.STATES?.[entity] || root._RAW_STATES?.[entity];
  const stateClass = clean(current?.attributes?.state_class).toLowerCase();
  if (stateClass === "total" || stateClass === "total_increasing") return true;
  if (current && stateClass) return false;
  return /(?:^|[._-])(total|totale|lifetime|meter|contatore)(?:[._-]|$)/i.test(entity);
}

function entityField(name, label, value, help = "") {
  return `<label class="ed-slot"><span class="ed-slot-lbl">${label}</span><span class="ed-form-row"><input class="ed-input mono" name="${name}" value="${esc(value)}"><button type="button" class="dm-entity-picker" data-pick="${name}" aria-label="${t("Seleziona entità", "Select entity")}">🔍</button></span>${help ? `<small>${help}</small>` : ""}</label>`;
}

function normalizeEntities(device, values) {
  return [...new Set([
    values.control_entity,
    values.power_entity,
    values.energy_entity,
    values.daily_energy_entity,
    values.monthly_energy_entity,
    values.total_energy_entity,
    values.history_entity,
    values.report_entity,
    ...(device.entities || []).map((entry) => clean(typeof entry === "string" ? entry : entry?.entity || entry?.entity_id)),
  ].filter(Boolean))];
}

async function saveAppliance(index, next) {
  const list = appliances();
  list[index] = next;
  const store = dashboardStore();
  if (store?.replaceSection) await store.replaceSection("appliances", list);
  else {
    writeJsonIfChanged("cd_appliances", list);
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
  root.renderAppliances?.();
  root.renderApplianceSection?.(true);
  root.cdRebuildReportDevices?.();
  root.buildReportSelect?.();
}

function updateEditType(modal, key) {
  const canonical = editorVisualKey(key) || "generico";
  const hidden = modal.querySelector('input[name="icon"]');
  const preview = modal.querySelector("[data-icon-preview]");
  const trigger = modal.querySelector("[data-type-trigger]");
  if (hidden) hidden.value = canonical;
  if (preview) {
    preview.innerHTML = typeIconMarkup(canonical, 58);
    preview.dataset.dmPreviewSource = "canonical-picker";
    preview.setAttribute("aria-label", typeLabel(canonical));
  }
  if (trigger) {
    trigger.dataset.applianceType = canonical;
    trigger.innerHTML = `<span class="dm-appliance-type-trigger-icon">${typeIconMarkup(canonical, 30)}</span><span class="dm-appliance-type-trigger-label">${esc(typeLabel(canonical))}</span><span class="dm-appliance-type-chevron" aria-hidden="true">⌄</span>`;
    trigger.setAttribute("aria-label", `${t("Tipo / immagine", "Type / artwork")}: ${typeLabel(canonical)}`);
  }
}

export function openApplianceEditor(index) {
  const device = appliances()[index];
  if (!device) return false;
  doc?.getElementById("dm-appliance-editor-modal")?.remove();
  const visual = deviceVisualKey(device);
  const totalInitial = [device.total_energy_entity, device.history_entity, device.report_entity]
    .map(clean)
    .find(cumulativeEntity) || "";
  const controlInitial = clean(device.control_entity || device.switch_entity) || inferredControlEntity(device);
  const powerInitial = clean(device.power_entity || device.power || device.power_sensor) || inferredPowerEntity(device);
  const modal = doc.createElement("div");
  modal.id = "dm-appliance-editor-modal";
  modal.className = "dm-section-modal";
  modal.innerHTML = `<section class="dm-section-dialog dm-appliance-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-appliance-editor-title">
    <header><strong id="dm-appliance-editor-title">🔌 ${t("Modifica elettrodomestico", "Edit appliance")}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <form data-form>
      <div class="dm-modal-grid dm-appliance-main-fields">
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(device.name)}" required></label>
        <label class="ed-slot dm-appliance-icon-field"><span class="ed-slot-lbl">${t("Tipo / immagine", "Type / artwork")}</span><input type="hidden" name="icon" value="${esc(visual)}"><span class="dm-appliance-icon-row"><span class="dm-appliance-icon-preview" data-icon-preview data-dm-preview-source="canonical-picker" aria-hidden="false"></span><button type="button" class="ed-input dm-appliance-type-trigger" data-type-trigger aria-haspopup="listbox"></button></span><small>${t("Usa lo stesso catalogo e la stessa icona azzurra della prima configurazione.", "Uses the same catalog and blue icon as the first configuration.")}</small></label>
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><select class="ed-input" name="room_id">${roomOptions(device.room_id || device.room)}</select></label>
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Soglia in funzione", "Running threshold")}</span><input class="ed-input" type="number" step="0.1" min="0" name="threshold_run" value="${esc(device.threshold_run ?? device.metadata?.threshold_run ?? 5)}"><small>${t("Potenza in watt oltre la quale la card risulta accesa.", "Power in watts above which the card is shown as running.")}</small></label>
      </div>
      <section class="dm-appliance-entity-grid">
        ${entityField("control_entity", t("Entità comando", "Control entity"), controlInitial, t("Switch, light, fan o input_boolean usato dal pulsante Accendi/Spegni.", "Switch, light, fan or input_boolean used by the On/Off button."))}
        ${entityField("power_entity", t("Potenza istantanea", "Instant power"), powerInitial, t("Sensore W o kW mostrato nella card.", "W or kW sensor shown on the card."))}
        ${entityField("daily_energy_entity", t("Energia giornaliera", "Daily energy"), device.daily_energy_entity, t("Facoltativa: sostituisce il calcolo del giorno.", "Optional: overrides the daily calculation."))}
        ${entityField("monthly_energy_entity", t("Energia mensile", "Monthly energy"), device.monthly_energy_entity, t("Facoltativa: sostituisce il calcolo del mese corrente.", "Optional: overrides the current-month calculation."))}
        ${entityField("total_energy_entity", t("Energia totale per storico e Report", "Total energy for history and Report"), totalInitial, t("Deve essere un contatore cumulativo kWh con state_class total o total_increasing. Non usare qui il sensore mensile: questo campo serve per ricostruire anche i mesi precedenti.", "This must be a cumulative kWh meter with state_class total or total_increasing. Do not use the monthly sensor here: this field is required to reconstruct previous months."))}
      </section>
      <output data-error></output>
      <footer><button type="button" class="ed-btn-add" data-cancel>${t("Annulla", "Cancel")}</button><button type="submit" class="ed-save-btn">💾 ${t("Salva modifiche", "Save changes")}</button></footer>
    </form>
  </section>`;
  doc.body.append(modal);
  const form = modal.querySelector("[data-form]");
  const close = () => modal.remove();
  updateEditType(modal, visual);
  modal.querySelector("[data-type-trigger]")?.addEventListener("click", () => {
    openTypePicker({
      selected: form.elements.icon.value,
      onSelect: (key) => updateEditType(modal, key),
    });
  });
  modal.querySelectorAll("[data-close],[data-cancel]").forEach((button) => button.addEventListener("click", close));
  modal.querySelectorAll("[data-pick]").forEach((button) => button.addEventListener("click", () => root.wzPickEntity?.(form.elements[button.dataset.pick])));
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const name = clean(values.name);
    const total = clean(values.total_energy_entity);
    const totalState = root.STATES?.[total] || root._RAW_STATES?.[total];
    const stateClass = clean(totalState?.attributes?.state_class).toLowerCase();
    if (!name) { form.querySelector("[data-error]").textContent = t("Inserisci il nome.", "Enter a name."); return; }
    if (total && totalState && !["total", "total_increasing"].includes(stateClass)) {
      form.querySelector("[data-error]").textContent = t("Il sensore Energia totale deve avere state_class total o total_increasing.", "The Total energy sensor must have state_class total or total_increasing.");
      return;
    }
    const visualKey = editorVisualKey(values.icon) || deviceVisualKey(device);
    const existingReport = clean(device.report_entity);
    const next = {
      ...device,
      name,
      icon: visualKey,
      visual_key: visualKey,
      device_type: visualKey,
      visual_type: "asset",
      room_id: clean(values.room_id),
      threshold_run: Number.isFinite(Number(values.threshold_run)) ? Number(values.threshold_run) : 5,
      control_entity: clean(values.control_entity),
      power_entity: clean(values.power_entity),
      daily_energy_entity: clean(values.daily_energy_entity),
      monthly_energy_entity: clean(values.monthly_energy_entity),
      total_energy_entity: total,
      history_entity: total,
      // Report can intentionally use a monthly/current-period sensor. Editing
      // the lifetime meter must not overwrite that independent Report choice.
      report_entity: existingReport || total,
    };
    next.energy_entity = clean(device.energy_entity) || next.total_energy_entity || next.monthly_energy_entity || next.daily_energy_entity;
    next.entities = normalizeEntities(device, next);
    try {
      await saveAppliance(index, next);
      close();
      root.editorSwitch?.("appliances");
    } catch (error) {
      form.querySelector("[data-error]").textContent = error?.message || String(error);
    }
  });
  return true;
}

function installStyles() {
  if (doc.getElementById("dm-appliance-editor-preview-style")) return;
  const style = doc.createElement("style");
  style.id = "dm-appliance-editor-preview-style";
  style.textContent = `
    .dm-appliance-icon-row{display:grid!important;grid-template-columns:84px minmax(0,1fr)!important;gap:12px!important;align-items:center!important}
    .dm-appliance-icon-preview{display:grid!important;place-items:center!important;width:84px!important;height:84px!important;border-radius:18px!important;background:var(--secondary-background-color,#eef3f8)!important;border:1px solid var(--divider-color,#dbe4ee)!important;overflow:hidden!important;color:#0ea5e9!important}
    .dm-appliance-icon-preview svg{display:block!important;width:58px!important;height:58px!important;max-width:58px!important;max-height:58px!important}
    .dm-appliance-editor-fallback{font-size:36px!important;line-height:1!important}
    .dm-appliance-type-trigger{display:grid!important;grid-template-columns:38px minmax(0,1fr) 22px!important;align-items:center!important;gap:10px!important;width:100%!important;min-height:58px!important;padding:8px 12px!important;text-align:left!important;cursor:pointer!important;color:var(--primary-text-color,#0f172a)!important;background:var(--card-background-color,#fff)!important}
    .dm-appliance-type-trigger-icon{display:grid!important;place-items:center!important;width:36px!important;height:36px!important;color:#0ea5e9!important}.dm-appliance-type-trigger-icon svg{width:30px!important;height:30px!important}.dm-appliance-type-trigger-label{min-width:0!important;font-weight:750!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.dm-appliance-type-chevron{font-size:20px!important;justify-self:end!important}
    .dm-appliance-editor-dialog{max-height:min(92dvh,920px)!important;overflow:hidden!important}
    .dm-appliance-type-picker{position:fixed!important;inset:0!important;z-index:100002!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:16px!important;background:rgba(15,23,42,.60)!important}
    .dm-appliance-type-picker-dialog{display:flex!important;flex-direction:column!important;box-sizing:border-box!important;width:min(460px,100%)!important;max-height:80dvh!important;padding:18px!important;border-radius:22px!important;background:var(--card-background-color,#fff)!important;color:var(--primary-text-color,#0f172a)!important;box-shadow:0 20px 60px rgba(0,0,0,.35)!important}
    .dm-appliance-type-picker-dialog>strong{margin-bottom:10px!important;font-size:14.5px!important;font-weight:900!important}.dm-appliance-type-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(88px,1fr))!important;gap:8px!important;overflow-y:auto!important;min-height:0!important}
    .dm-appliance-type-option{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;min-height:92px!important;padding:10px 4px!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:14px!important;background:color-mix(in srgb,var(--secondary-background-color,#f1f5f9) 70%,transparent)!important;color:inherit!important;cursor:pointer!important}.dm-appliance-type-option[aria-selected="true"]{border-color:#0ea5e9!important;box-shadow:0 0 0 2px color-mix(in srgb,#0ea5e9 18%,transparent)!important}.dm-appliance-type-option-icon{display:grid!important;place-items:center!important;height:34px!important;color:#0ea5e9!important}.dm-appliance-type-option-icon svg{width:30px!important;height:30px!important}.dm-appliance-type-option>span:last-child{font-size:10px!important;font-weight:800!important;line-height:1.15!important;text-align:center!important}
    .dm-appliance-type-close{margin-top:10px!important;min-height:44px!important;padding:11px!important;border:0!important;border-radius:12px!important;background:#94a3b8!important;color:#fff!important;font-weight:800!important;cursor:pointer!important}
    @media(max-width:520px){.dm-appliance-icon-row{grid-template-columns:84px minmax(0,1fr)!important}.dm-appliance-type-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}.dm-appliance-type-option{min-width:0!important;min-height:92px!important}}
  `;
  doc.head.append(style);
}

function installOverride() {
  if (typeof root.edApplEdit !== "function" || root.edApplEdit.__dmModalEditor) return false;
  state.previousEdit ||= root.edApplEdit;
  function modalApplianceEditor(index) { return openApplianceEditor(Number(index)); }
  modalApplianceEditor.__dmModalEditor = true;
  modalApplianceEditor.__dmPrevious = state.previousEdit;
  root.edApplEdit = modalApplianceEditor;
  return true;
}

function installRuntimeOverrides() {
  installOverride();
  installPickerOverride();
}

export function installApplianceEditorSection() {
  if (!doc) return;
  installStyles();
  installRuntimeOverrides();
  if (!state.installed) {
    state.installed = true;
    root.addEventListener?.("dashboardmodern:legacy-ready", installRuntimeOverrides);
    root.addEventListener?.("dashboardmodern:runtime-ready", installRuntimeOverrides);
    root.addEventListener?.("pageshow", installRuntimeOverrides);
  }
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", installApplianceEditorSection, { once: true });
else installApplianceEditorSection();
