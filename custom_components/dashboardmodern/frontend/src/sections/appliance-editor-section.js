import { applianceArtwork, canonicalArtworkType } from "../core/appliance-artwork.js";
import {
  clean,
  dashboardStore,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  section,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCE_EDITOR_SECTION__";
const state = (root[KEY] ||= { installed: false, previousEdit: null });
const ARTWORK_TYPES = [
  "generico",
  "lavatrice",
  "asciugatrice",
  "lavastoviglie",
  "frigorifero",
  "forno",
  "microonde",
  "boiler",
  "clima",
  "televisore",
  "computer",
  "presa",
];

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

function entityField(name, label, value, help = "") {
  return `<label class="ed-slot"><span class="ed-slot-lbl">${label}</span><span class="ed-form-row"><input class="ed-input mono" name="${name}" value="${esc(value)}"><button type="button" class="dm-entity-picker" data-pick="${name}" aria-label="${t("Seleziona entità", "Select entity")}">🔍</button></span>${help ? `<small>${help}</small>` : ""}</label>`;
}

function iconValue(device) {
  return clean(device.icon || device.visual_key || device.device_type || device.type || "generico");
}

function iconPreviewMarkup(value) {
  const kind = canonicalArtworkType(clean(value)) || "generico";
  return applianceArtwork(kind, 112) || `<span class="dm-appliance-preview-fallback">🔌</span>`;
}

function normalizeEntities(device, values) {
  return [
    ...new Set(
      [
        values.control_entity,
        values.power_entity,
        values.energy_entity,
        values.daily_energy_entity,
        values.monthly_energy_entity,
        values.total_energy_entity,
        values.history_entity,
        values.report_entity,
        ...(device.entities || []).map((entry) =>
          clean(typeof entry === "string" ? entry : entry?.entity || entry?.entity_id),
        ),
      ].filter(Boolean),
    ),
  ];
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

function installEditorStyles() {
  installStyle(
    "dm-appliance-editor-section-style",
    `
      #dm-appliance-editor-modal .dm-appliance-editor-dialog{width:min(760px,calc(100vw - 24px))!important;max-height:calc(100dvh - 24px)!important}
      #dm-appliance-editor-modal .dm-appliance-icon-field{display:grid!important;grid-template-columns:132px minmax(0,1fr)!important;align-items:center!important;gap:14px!important;grid-column:1/-1!important}
      #dm-appliance-editor-modal .dm-appliance-icon-preview{display:grid!important;place-items:center!important;box-sizing:border-box!important;width:132px!important;height:116px!important;overflow:hidden!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:18px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 9%,var(--ha-card-background,#fff))!important}
      #dm-appliance-editor-modal .dm-appliance-icon-preview .dm-appliance-art,#dm-appliance-editor-modal .dm-appliance-icon-preview svg{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important}
      #dm-appliance-editor-modal .dm-appliance-icon-control{display:grid!important;gap:8px!important;min-width:0!important}
      #dm-appliance-editor-modal .dm-appliance-icon-control small{color:var(--secondary-text-color,#64748b)!important;line-height:1.35!important}
      #dm-appliance-editor-modal .dm-appliance-preview-fallback{font-size:54px!important}
      #dm-appliance-editor-modal form{overflow:auto!important;padding-bottom:max(18px,env(safe-area-inset-bottom))!important}
      #dm-appliance-editor-modal footer{position:sticky!important;bottom:0!important;z-index:3!important;padding-top:12px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      @media(max-width:560px){#dm-appliance-editor-modal .dm-appliance-icon-field{grid-template-columns:104px minmax(0,1fr)!important}#dm-appliance-editor-modal .dm-appliance-icon-preview{width:104px!important;height:96px!important}#dm-appliance-editor-modal .dm-appliance-editor-dialog{width:calc(100vw - 16px)!important;max-height:calc(100dvh - 16px)!important}}
    `,
  );
}

export function openApplianceEditor(index) {
  const device = appliances()[index];
  if (!device) return false;
  doc?.getElementById("dm-appliance-editor-modal")?.remove();
  const currentIcon = iconValue(device);
  const modal = doc.createElement("div");
  modal.id = "dm-appliance-editor-modal";
  modal.className = "dm-section-modal";
  modal.innerHTML = `<section class="dm-section-dialog dm-appliance-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-appliance-editor-title">
    <header><strong id="dm-appliance-editor-title">🔌 ${t("Modifica elettrodomestico", "Edit appliance")}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <form data-form>
      <div class="dm-modal-grid dm-appliance-main-fields">
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(device.name)}" required></label>
        <div class="dm-appliance-icon-field">
          <div class="dm-appliance-icon-preview" data-icon-preview aria-label="${t("Anteprima icona", "Icon preview")}">${iconPreviewMarkup(currentIcon)}</div>
          <label class="ed-slot dm-appliance-icon-control"><span class="ed-slot-lbl">${t("Tipo / icona", "Type / icon")}</span><input class="ed-input" name="icon" list="dm-appliance-icon-types" value="${esc(currentIcon)}" autocomplete="off"><datalist id="dm-appliance-icon-types">${ARTWORK_TYPES.map((type) => `<option value="${type}"></option>`).join("")}</datalist><small>${t("Scrivi o scegli il tipo: l’anteprima mostra l’icona che verrà usata nella card.", "Type or select a category: the preview shows the icon used on the card.")}</small></label>
        </div>
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><select class="ed-input" name="room_id">${roomOptions(device.room_id || device.room)}</select></label>
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Soglia in funzione", "Running threshold")}</span><input class="ed-input" type="number" step="0.1" min="0" name="threshold_run" value="${esc(device.threshold_run ?? 5)}"><small>${t("Potenza in watt oltre la quale la card risulta accesa.", "Power in watts above which the card is shown as running.")}</small></label>
      </div>
      <section class="dm-appliance-entity-grid">
        ${entityField("control_entity", t("Entità comando", "Control entity"), device.control_entity || device.switch_entity, t("Switch, light o input_boolean usato dal pulsante Accendi/Spegni.", "Switch, light or input_boolean used by the On/Off button."))}
        ${entityField("power_entity", t("Potenza istantanea", "Instant power"), device.power_entity, t("Sensore W o kW mostrato nella card.", "W or kW sensor shown on the card."))}
        ${entityField("daily_energy_entity", t("Energia giornaliera", "Daily energy"), device.daily_energy_entity, t("Facoltativa: sostituisce il calcolo del giorno.", "Optional: overrides the daily calculation."))}
        ${entityField("monthly_energy_entity", t("Energia mensile", "Monthly energy"), device.monthly_energy_entity, t("Facoltativa: sostituisce il calcolo del mese corrente.", "Optional: overrides the current-month calculation."))}
        ${entityField("total_energy_entity", t("Energia totale per storico e Report", "Total energy for history and Report"), device.total_energy_entity || device.history_entity, t("Contatore cumulativo kWh con state_class total o total_increasing: calcola anche i mesi precedenti.", "Cumulative kWh meter with state_class total or total_increasing: also calculates previous months."))}
      </section>
      <output data-error></output>
      <footer><button type="button" class="ed-btn-add" data-cancel>${t("Annulla", "Cancel")}</button><button type="submit" class="ed-save-btn">💾 ${t("Salva modifiche", "Save changes")}</button></footer>
    </form>
  </section>`;
  doc.body.append(modal);
  const form = modal.querySelector("[data-form]");
  const iconInput = form.elements.icon;
  const preview = modal.querySelector("[data-icon-preview]");
  const updatePreview = () => {
    preview.innerHTML = iconPreviewMarkup(iconInput.value);
    preview.dataset.icon = canonicalArtworkType(clean(iconInput.value)) || "generico";
  };
  iconInput.addEventListener("input", updatePreview);
  iconInput.addEventListener("change", updatePreview);
  updatePreview();
  const close = () => modal.remove();
  modal.querySelectorAll("[data-close],[data-cancel]").forEach((button) => button.addEventListener("click", close));
  modal.querySelectorAll("[data-pick]").forEach((button) =>
    button.addEventListener("click", () => root.wzPickEntity?.(form.elements[button.dataset.pick])),
  );
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const name = clean(values.name);
    const total = clean(values.total_energy_entity);
    const totalState = root.STATES?.[total] || root._RAW_STATES?.[total];
    const stateClass = clean(totalState?.attributes?.state_class).toLowerCase();
    if (!name) {
      form.querySelector("[data-error]").textContent = t("Inserisci il nome.", "Enter a name.");
      return;
    }
    if (total && totalState && !["total", "total_increasing"].includes(stateClass)) {
      form.querySelector("[data-error]").textContent = t(
        "Il sensore Energia totale deve avere state_class total o total_increasing.",
        "The Total energy sensor must have state_class total or total_increasing.",
      );
      return;
    }
    const selectedIcon = clean(values.icon) || "generico";
    const next = {
      ...device,
      name,
      icon: selectedIcon,
      visual_type: "asset",
      visual_key: canonicalArtworkType(selectedIcon) || selectedIcon,
      device_type: canonicalArtworkType(selectedIcon) || device.device_type || selectedIcon,
      room_id: clean(values.room_id),
      threshold_run: Number.isFinite(Number(values.threshold_run)) ? Number(values.threshold_run) : 5,
      control_entity: clean(values.control_entity),
      power_entity: clean(values.power_entity),
      daily_energy_entity: clean(values.daily_energy_entity),
      monthly_energy_entity: clean(values.monthly_energy_entity),
      total_energy_entity: total,
      history_entity: total || clean(values.monthly_energy_entity),
      report_entity: total || clean(values.monthly_energy_entity),
    };
    next.energy_entity =
      clean(device.energy_entity) ||
      next.total_energy_entity ||
      next.monthly_energy_entity ||
      next.daily_energy_entity;
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

function installOverride() {
  if (typeof root.edApplEdit !== "function" || root.edApplEdit.__dmModalEditor) return false;
  state.previousEdit ||= root.edApplEdit;
  function modalApplianceEditor(index) {
    return openApplianceEditor(Number(index));
  }
  modalApplianceEditor.__dmModalEditor = true;
  modalApplianceEditor.__dmPrevious = state.previousEdit;
  root.edApplEdit = modalApplianceEditor;
  return true;
}

export function installApplianceEditorSection() {
  if (!doc) return;
  installEditorStyles();
  installOverride();
  if (!state.installed) {
    state.installed = true;
    root.addEventListener?.("dashboardmodern:legacy-ready", installOverride);
    root.addEventListener?.("dashboardmodern:runtime-ready", installOverride);
    root.addEventListener?.("pageshow", installOverride);
  }
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installApplianceEditorSection, { once: true });
else installApplianceEditorSection();
