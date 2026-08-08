import { applianceArtwork } from "../core/appliance-artwork.js";
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
const state = (root[KEY] ||= { installed: false, previousEdit: null });

const ICONS = Object.freeze([
  ["generico", "🔌"], ["forno", "♨️"], ["microonde", "〰️"], ["frigorifero", "❄️"],
  ["lavatrice", "🧺"], ["lavastoviglie", "🍽️"], ["asciugatrice", "💨"], ["boiler", "🚿"],
  ["televisore", "📺"], ["climatizzatore", "❄️"], ["ventilatore", "🌀"], ["caffe", "☕"],
]);

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

function iconOptions(selected) {
  const value = clean(selected).toLowerCase();
  return ICONS.map(([key, glyph]) => `<option value="${key}" ${key === value ? "selected" : ""}>${glyph} ${key}</option>`).join("");
}

function iconGlyph(value) {
  const key = clean(value).toLowerCase();
  return ICONS.find(([name]) => name === key)?.[1] || (key.startsWith("mdi:") ? "⚡" : "🔌");
}

function artworkPreview(value) {
  return applianceArtwork(value, 72) || `<span class="dm-appliance-editor-fallback">${iconGlyph(value)}</span>`;
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

export function openApplianceEditor(index) {
  const device = appliances()[index];
  if (!device) return false;
  doc?.getElementById("dm-appliance-editor-modal")?.remove();
  const visual = clean(device.visual_key || device.device_type || device.icon || "generico").toLowerCase();
  const totalInitial = [device.total_energy_entity, device.history_entity, device.report_entity]
    .map(clean)
    .find(cumulativeEntity) || "";
  const modal = doc.createElement("div");
  modal.id = "dm-appliance-editor-modal";
  modal.className = "dm-section-modal";
  modal.innerHTML = `<section class="dm-section-dialog dm-appliance-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-appliance-editor-title">
    <header><strong id="dm-appliance-editor-title">🔌 ${t("Modifica elettrodomestico", "Edit appliance")}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <form data-form>
      <div class="dm-modal-grid dm-appliance-main-fields">
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(device.name)}" required></label>
        <label class="ed-slot dm-appliance-icon-field"><span class="ed-slot-lbl">${t("Tipo / immagine", "Type / artwork")}</span><span class="dm-appliance-icon-row"><span class="dm-appliance-icon-preview" data-icon-preview aria-hidden="true">${artworkPreview(visual)}</span><select class="ed-input" name="icon">${iconOptions(visual)}</select></span><small>${t("L’anteprima usa esattamente l’immagine renderizzata nella card.", "The preview uses exactly the artwork rendered in the card.")}</small></label>
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><select class="ed-input" name="room_id">${roomOptions(device.room_id || device.room)}</select></label>
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Soglia in funzione", "Running threshold")}</span><input class="ed-input" type="number" step="0.1" min="0" name="threshold_run" value="${esc(device.threshold_run ?? 5)}"><small>${t("Potenza in watt oltre la quale la card risulta accesa.", "Power in watts above which the card is shown as running.")}</small></label>
      </div>
      <section class="dm-appliance-entity-grid">
        ${entityField("control_entity", t("Entità comando", "Control entity"), device.control_entity || device.switch_entity, t("Switch, light o input_boolean usato dal pulsante Accendi/Spegni.", "Switch, light or input_boolean used by the On/Off button."))}
        ${entityField("power_entity", t("Potenza istantanea", "Instant power"), device.power_entity, t("Sensore W o kW mostrato nella card.", "W or kW sensor shown on the card."))}
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
  const preview = modal.querySelector("[data-icon-preview]");
  form.elements.icon.addEventListener("change", () => {
    preview.innerHTML = artworkPreview(form.elements.icon.value);
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
    const visualKey = clean(values.icon) || "generico";
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
  style.textContent = `.dm-appliance-icon-row{display:grid!important;grid-template-columns:84px minmax(0,1fr)!important;gap:12px!important;align-items:center!important}.dm-appliance-icon-preview{display:grid!important;place-items:center!important;width:84px!important;height:84px!important;border-radius:18px!important;background:var(--secondary-background-color,#eef3f8)!important;border:1px solid var(--divider-color,#dbe4ee)!important;overflow:hidden!important}.dm-appliance-icon-preview .dm-appliance-art,.dm-appliance-icon-preview svg{display:block!important;width:84px!important;height:84px!important;max-width:84px!important;max-height:84px!important}.dm-appliance-editor-fallback{font-size:36px!important;line-height:1!important}.dm-appliance-editor-dialog{max-height:min(92dvh,920px)!important;overflow:hidden!important}`;
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

export function installApplianceEditorSection() {
  if (!doc) return;
  installStyles();
  installOverride();
  if (!state.installed) {
    state.installed = true;
    root.addEventListener?.("dashboardmodern:legacy-ready", installOverride);
    root.addEventListener?.("dashboardmodern:runtime-ready", installOverride);
    root.addEventListener?.("pageshow", installOverride);
  }
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", installApplianceEditorSection, { once: true });
else installApplianceEditorSection();