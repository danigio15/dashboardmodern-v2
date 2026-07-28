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
import { createEnergyReportRows, createRenderCoordinator, renderDeviceCard, renderEnergyEditor } from "../src/core/renderers.js";

export const MODULES_VERSION = 4;

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
      appliances: "appliances", cameras: "sezioni", energy: "sezioni", rooms: "stanze",
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
    } else if (tab === "stanze") body.innerHTML = globalThis.editorRenderStanze();
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

function installEnergyEditorStyles(document) {
  if (!document?.head || document.getElementById("dm-energy-editor-styles")) return;
  const style = document.createElement("style");
  style.id = "dm-energy-editor-styles";
  style.textContent = `.dm-energy-editor{gap:10px}.dm-energy-editor__group{border:1px solid var(--card-border);border-radius:15px;background:var(--surface-2);overflow:hidden}.dm-energy-editor__heading{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;font-size:16px;font-weight:800;cursor:pointer;list-style:none}.dm-energy-editor__heading::-webkit-details-marker{display:none}.dm-energy-editor__heading small,.dm-energy-editor__badges small{font-size:10px;font-style:normal;color:var(--text-dim);background:var(--surface-3);padding:3px 7px;border-radius:999px;white-space:nowrap}.dm-energy-editor__body{display:flex;flex-direction:column;gap:9px;padding:12px 14px;border-top:1px solid var(--card-border)}.dm-energy-editor__field{display:flex;flex-direction:column;gap:4px;margin:0}.dm-energy-editor__label{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:14px;font-weight:750}.dm-energy-editor__badges{display:flex;gap:4px}.dm-energy-editor__field>em{font-size:11.5px;line-height:1.25;color:var(--text-dim);font-style:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.dm-energy-editor__input-row{display:grid;grid-template-columns:minmax(0,1fr) 44px auto;gap:6px;align-items:center}.dm-energy-editor__input-row input,.dm-energy-editor__input-row button{height:44px;margin:0}.dm-energy-editor__input-row output{font-size:11px;color:var(--text-dim);white-space:nowrap}.dm-energy-editor__report{padding:12px 14px}.dm-energy-editor__report h3{font-size:16px;margin:0 0 8px}.dm-energy-editor__report .ed-btn-add{width:auto;padding:8px 12px;font-size:12px}@media(max-width:560px){.dm-energy-editor__input-row{grid-template-columns:minmax(0,1fr) 44px}.dm-energy-editor__input-row output{grid-column:1/-1;text-align:right}.dm-energy-editor__heading{padding:12px;font-size:15px}.dm-energy-editor__body{padding:12px}}`;
  document.head.append(style);
}

function mountEnergyEditor(target) {
  installEnergyEditorStyles(globalThis.document);
  const model = store.getSection("energy");
  renderEnergyEditor(globalThis.document, target, model, store.getSection("appliances"), globalThis.STATES || {},
    globalThis.document?.documentElement?.lang === "en" ? "en" : "it", {
      onPick: (input) => globalThis.wzPickEntity?.(input),
      onChange: (group, key, value) => {
        const next = store.getSection("energy"); next[group] ||= {}; next[group][key] = value;
        store.replaceSection("energy", next).catch((error) => globalThis.alert?.(`Energy save failed: ${error.message}`));
      },
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
  render: Object.freeze({ createEnergyReportRows, createRenderCoordinator, mountEnergyEditor, renderDeviceCard, renderEnergyEditor }),
});

globalThis.DashboardModernModules = DashboardModernModules;
export default DashboardModernModules;
