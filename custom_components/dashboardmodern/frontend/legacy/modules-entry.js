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
import { createRenderCoordinator, renderDeviceCard, renderEnergyEditor } from "../src/core/renderers.js";

export const MODULES_VERSION = 4;

const store = new DashboardStore({
  sync: async () => {
    globalThis.cdMarkDirty?.();
    return globalThis.cdSyncPush?.();
  },
  onStatus: (status) => globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:status", { detail: status })),
});
store.migrate();

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
  render: Object.freeze({ createRenderCoordinator, renderDeviceCard, renderEnergyEditor }),
});

globalThis.DashboardModernModules = DashboardModernModules;
export default DashboardModernModules;
