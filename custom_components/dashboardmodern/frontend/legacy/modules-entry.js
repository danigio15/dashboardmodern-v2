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
});

function mountEnergyEditor(target) {
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
