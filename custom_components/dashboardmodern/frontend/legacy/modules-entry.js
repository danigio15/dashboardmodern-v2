/* Canonical runtime helpers consumed directly by both vendored dashboards. */
import {
  applianceGroups,
  applianceEnergyReport,
  applianceMedia,
  applianceName,
  applianceRoomId,
  applianceState,
  controllableEntity,
  normalizeCamera,
  normalizeCameras,
  normalizeRooms,
  removeCamera,
  saveCamera,
  stableRoomId,
} from "../src/legacy/dashboard-data.js";
import { DashboardStore } from "../src/core/dashboard-store.js";
import { getDeviceDisplayName, getDeviceVisual, normalizeDevice } from "../src/core/device-model.js";
import { createEnergyReportRows, createRenderCoordinator, loadPopupMetrics, renderDeviceCard, renderEnergyEditor } from "../src/core/renderers.js";

export const MODULES_VERSION = 5;

const store = new DashboardStore({
  sync: async () => {
    globalThis.cdMarkDirty?.();
    return globalThis.cdSyncPush?.();
  },
  onStatus: (status) => globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:status", { detail: status })),
});
store.migrate();
store.installLegacyWriteBridge();

// The vendored UI keeps its established markup/CSS. This is the single bridge
// that translates canonical store changes into its existing partial renderers.
createRenderCoordinator(store, {
  renderSection(section) {
    if (section === "appliances") {
      globalThis.renderAppliances?.(); globalThis.renderApplianceSection?.(true);
    } else if (section === "cameras") {
      const grid = globalThis.document?.getElementById?.("cam-grid"); if (grid) grid._sig = "";
      globalThis.buildCamCards?.(); globalThis.refreshCameras?.();
    }
  },
  renderEnergyReport() { globalThis.cdRebuildReportDevices?.(); },
  renderNavbar() { globalThis.cdApplyNavVis?.(); },
  renderRoomSelectors() { globalThis.cdFillRoomSelects?.(); },
  renderCurrentEditor(section) {
    const tab = globalThis.document?.querySelector?.(".ed-tab.active")?.dataset?.tab;
    const sectionTabs = {
      appliances: "appliances", loads: "load", cameras: "sezioni", energy: "sezioni", rooms: "stanze",
      ev: "sezioni", lights: "luci", climate: "sezioni", covers: "tapp",
      pool: "pool", irrigation: "irr",
    };
    const expected = sectionTabs[section];
    const matches = expected === tab || (expected === "sezioni" && tab?.startsWith("sez"));
    if (!globalThis.document?.getElementById?.("ed-body") || !matches) return;
    // Re-render the active body directly; editorSwitch is navigation and was
    // the accidental refresh mechanism that left confirmed deletes visible.
    const body = globalThis.document.getElementById("ed-body");
    if (tab === "appliances") {
      body.innerHTML = globalThis.cdSecToggleHtml("appliances") + globalThis.editorRenderAppliances() + '<button class="ed-btn-add" style="width:100%; margin-top:10px;" onclick="edSecSave()">💾 Salva sezione</button>';
      globalThis.edApplRenderEnts?.();
    } else if (tab === "load") mountLoadsEditor(body);
    else if (tab === "stanze") body.innerHTML = globalThis.editorRenderStanze();
    else if (tab === "luci") body.innerHTML = globalThis.editorRenderLuci();
    else if (tab === "tapp") body.innerHTML = globalThis.cdSecToggleHtml("tapparelle") + globalThis.editorRenderTapparelle();
    else if (tab === "pool") body.innerHTML = globalThis.cdSecToggleHtml("piscina") + globalThis.editorRenderPiscina();
    else if (tab === "irr") body.innerHTML = globalThis.cdSecToggleHtml("irrigazione") + globalThis.editorRenderIrrigazione();
    else if (tab?.startsWith("sez") && tab !== "sezioni") {
      body.innerHTML = globalThis.editorRenderSezioni();
      globalThis.edFilterSez?.(body, Number(tab.slice(3)));
    }
  },
  renderDropdowns() { globalThis.cdFillRoomSelects?.(); },
  renderDashboard() { globalThis.render?.(); },
});

function mountEnergyEditor(target) {
  const model = store.getSection("energy");
  renderEnergyEditor(globalThis.document, target, model, store.getSection("appliances"), globalThis.STATES || {},
    globalThis.document?.documentElement?.lang === "en" ? "en" : "it", {
      onPick: (input) => globalThis.wzPickEntity?.(input),
      renderSettings: (settings) => {
        settings.innerHTML = `${globalThis.cdEnViewsHtml?.() || ""}
          <div class="ed-sec-title">💶 Costo energia</div>
          <div class="ed-hint">Tariffe usate dal Report Energia.</div>
          <div class="ed-form-row"><input id="ed-costo-kwh" class="ed-input" type="number" step="0.001" min="0" placeholder="€/kWh prelevato" value="${globalThis.cdCfg?.("cd_costo_kwh") || ""}"><input id="ed-prezzo-imm" class="ed-input" type="number" step="0.001" min="0" placeholder="€/kWh immesso" value="${globalThis.cdCfg?.("cd_prezzo_immissione") || ""}"></div>
          <button class="ed-save-btn" onclick="edSaveCosti()">💾 Salva costi</button>
          <div class="ed-sec-title">📊 Report</div><div class="ed-intro">Il report usa Elettrodomestici, Carichi secondari e voci manuali configurati nella sezione Carichi.</div>`;
      },
      onChange: (group, key, value) => {
        const next = store.getSection("energy"); next[group] ||= {}; next[group][key] = value;
        store.replaceSection("energy", next).catch((error) => globalThis.alert?.(`Energy save failed: ${error.message}`));
      },
    });
}

const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
function entityField(id, label, value = "", placeholder = "sensor.entity") {
  return `<label class="ed-slot"><span class="ed-slot-lbl">${label} <span class="ed-acc-n">Facoltativo</span></span><span class="ed-form-row"><input id="${id}" class="ed-input ed-slot-in mono" value="${esc(value)}" placeholder="${placeholder}"><button type="button" class="dm-entity-picker" onclick="wzPickEntity('#${id}')" aria-label="Seleziona ${label}">🔍</button></span></label>`;
}
function mountLoadsEditor(target, editId = "") {
  const loads = store.getSection("loads");
  const appliances = store.getSection("appliances");
  const current = loads.find((item) => item.id === editId) || {};
  const cards = (items, manual, readOnly = false) => items.map((item) => `<div class="ed-row" data-load-id="${esc(item.id)}"><div class="ed-row-main"><div class="ed-row-new">${esc(item.icon || "🔌")} ${esc(item.name || "Carico")}</div><div class="ed-row-old">${esc(item.category || (manual ? "Voce report" : "Carico secondario"))}</div></div>${readOnly ? "" : `<button class="ed-del" data-edit-load="${esc(item.id)}" title="Modifica">✏️</button><button class="ed-del" data-delete-load="${esc(item.id)}" title="Elimina">🗑️</button>`}</div>`).join("") || '<div class="ed-empty">Nessuna voce configurata</div>';
  target.innerHTML = `<details class="ed-acc" open><summary class="ed-acc-head">A. DISPOSITIVI / ELETTRODOMESTICI <span class="ed-acc-n">${appliances.length}</span></summary><div class="ed-acc-body"><div class="ed-intro">Collegati al modello canonico Elettrodomestici; si modificano una sola volta nella sezione dedicata.</div>${cards(appliances, false, true)}</div></details>
    <details class="ed-acc" open><summary class="ed-acc-head">B. CARICHI SECONDARI <span class="ed-acc-n">${loads.filter((x) => x.category !== "manual-report").length}</span></summary><div class="ed-acc-body">${cards(loads.filter((x) => x.category !== "manual-report"), false)}</div></details>
    <details class="ed-acc"><summary class="ed-acc-head">C. VOCI REPORT MANUALI <span class="ed-acc-n">${loads.filter((x) => x.category === "manual-report").length}</span></summary><div class="ed-acc-body">${cards(loads.filter((x) => x.category === "manual-report"), true)}</div></details>
    <div class="ed-form" data-load-form><div class="ed-sec-title">${editId ? "Modifica carico" : "Nuovo carico secondario"}</div><div class="ed-form-row"><input id="dm-load-name" class="ed-input" placeholder="Nome" value="${esc(current.name)}"><input id="dm-load-icon" class="ed-input ed-icon-input" placeholder="🔌 / mdi:power-plug" value="${esc(current.icon)}"></div><div class="ed-form-row"><input id="dm-load-category" class="ed-input" placeholder="Categoria" value="${esc(current.category || "secondary")}"><select id="dm-load-room" class="ed-input">${globalThis.cdRoomOptions?.(current.room_id) || ""}</select></div>${entityField("dm-load-power", "Entità potenza", current.power_entity, "sensor.carico_power")}${entityField("dm-load-day", "Energia giornaliera", current.daily_energy_entity)}${entityField("dm-load-month", "Energia mensile", current.monthly_energy_entity)}${entityField("dm-load-total", "Energia totale", current.total_energy_entity)}${entityField("dm-load-history", "Storico", current.history_entity)}${entityField("dm-load-state", "Stato", current.state_entity)}${entityField("dm-load-control", "Comando ON/OFF", current.control_entity, "switch.carico")}<label class="ed-intro"><input id="dm-load-report" type="checkbox" ${current.show_in_report !== false ? "checked" : ""}> Visibile nel report</label><label class="ed-intro"><input id="dm-load-dashboard" type="checkbox" ${current.show_in_dashboard !== false ? "checked" : ""}> Visibile nella dashboard</label><button class="ed-btn-add" data-save-load>💾 ${editId ? "Salva modifiche" : "Aggiungi carico"}</button></div>`;
  target.querySelectorAll?.("[data-edit-load]").forEach((button) => button.addEventListener("click", () => mountLoadsEditor(target, button.dataset.editLoad)));
  target.querySelectorAll?.("[data-delete-load]").forEach((button) => button.addEventListener("click", () => store.removeItem("loads", button.dataset.deleteLoad)));
  target.querySelector?.("[data-save-load]")?.addEventListener("click", () => {
    const value = (id) => target.querySelector(`#${id}`)?.value?.trim() || "";
    const item = { name: value("dm-load-name"), icon: value("dm-load-icon"), category: value("dm-load-category") || "secondary", room_id: value("dm-load-room"), power_entity: value("dm-load-power"), daily_energy_entity: value("dm-load-day"), monthly_energy_entity: value("dm-load-month"), total_energy_entity: value("dm-load-total"), history_entity: value("dm-load-history"), state_entity: value("dm-load-state"), control_entity: value("dm-load-control"), show_in_report: !!target.querySelector("#dm-load-report")?.checked, show_in_dashboard: !!target.querySelector("#dm-load-dashboard")?.checked, order: current.order ?? loads.length };
    if (!item.name) return globalThis.alert?.("Inserisci il nome del carico");
    (editId ? store.updateItem("loads", editId, item) : store.addItem("loads", item)).catch((error) => globalThis.alert?.(error.message));
  });
}

const DashboardModernModules = Object.freeze({
  version: MODULES_VERSION,
  data: Object.freeze({
    getDeviceDisplayName,
    getDeviceVisual,
    normalizeDevice,
    stableRoomId,
    normalizeRooms,
    applianceRoomId,
    applianceGroups,
    applianceEnergyReport,
    applianceMedia,
    applianceName,
    applianceState,
    controllableEntity,
    normalizeCamera,
    normalizeCameras,
    saveCamera,
    removeCamera,
  }),
  store,
  render: Object.freeze({ createEnergyReportRows, createRenderCoordinator, loadPopupMetrics, mountEnergyEditor, mountLoadsEditor, renderDeviceCard, renderEnergyEditor }),
});

globalThis.DashboardModernModules = DashboardModernModules;
export default DashboardModernModules;
