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

export const MODULES_VERSION = 3;

const DashboardModernModules = Object.freeze({
  version: MODULES_VERSION,
  data: Object.freeze({
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
});

globalThis.DashboardModernModules = DashboardModernModules;
export default DashboardModernModules;
