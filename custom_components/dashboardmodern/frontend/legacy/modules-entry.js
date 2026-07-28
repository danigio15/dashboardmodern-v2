/*
 * The logic the shipped dashboard calls.
 *
 * The dashboard document stays the interface — that is what keeps the graphics
 * identical, by construction rather than by effort. What moves out of it is the
 * logic: unit conversion, appliance cycles, light and cover capabilities, pool
 * chemistry, long-term statistics. Each lives in a module with tests, and the
 * document calls it.
 *
 * The document loads this file the same way it already loads config.js. It is a
 * module, so it imports the same sources the rest of the integration uses:
 * there is one implementation of each rule, not one here and one in a renderer
 * somewhere else.
 *
 * Everything is attached to a single namespace so the document has exactly one
 * name to check for, and a section can degrade gracefully when an older
 * integration is serving an older set of modules.
 */

import {
  DEFAULT_PAUSE_GRACE_MS,
  DEFAULT_RUN_WATTS,
  DEFAULT_STANDBY_WATTS,
  advanceRun,
  applianceStatus,
  emptyRun,
  formatDuration,
  runDurationMs,
  runEnergyKwh,
  toKilowattHours,
  toWatts,
} from "../src/modules/appliance-run.js";
import {
  DEFAULT_RANGES,
  assessFilter,
  assessReading,
  assessWater,
  formatReading,
  resolveRanges,
} from "../src/modules/pool.js";
import {
  comparePeriods,
  fetchStatistics,
  hasStatistics,
  listStatisticIds,
  sumDelta,
  summarizeMeasurement,
  windowFor,
} from "../src/modules/statistics.js";
import {
  brightnessPercent,
  lightControls,
  lightDisplayColor,
} from "../src/cards/light-controls.js";
import {
  applianceGroups,
  applianceRoomId,
  controllableEntity,
  normalizeCamera,
  normalizeCameras,
  normalizeRooms,
  removeCamera,
  saveCamera,
  stableRoomId,
} from "../src/legacy/dashboard-data.js";

// Bumped when a module gains something a section may want to rely on. A
// section can check it instead of feature-detecting each function.
export const MODULES_VERSION = 2;

const DashboardModernModules = Object.freeze({
  version: MODULES_VERSION,

  units: Object.freeze({ toWatts, toKilowattHours }),

  appliances: Object.freeze({
    DEFAULT_RUN_WATTS,
    DEFAULT_STANDBY_WATTS,
    DEFAULT_PAUSE_GRACE_MS,
    emptyRun,
    advanceRun,
    runDurationMs,
    runEnergyKwh,
    applianceStatus,
    formatDuration,
  }),

  pool: Object.freeze({
    DEFAULT_RANGES,
    resolveRanges,
    assessReading,
    assessWater,
    assessFilter,
    formatReading,
  }),

  statistics: Object.freeze({
    listStatisticIds,
    fetchStatistics,
    sumDelta,
    summarizeMeasurement,
    windowFor,
    comparePeriods,
    hasStatistics,
  }),

  lights: Object.freeze({ lightControls, lightDisplayColor, brightnessPercent }),
  data: Object.freeze({
    stableRoomId,
    normalizeRooms,
    applianceRoomId,
    applianceGroups,
    controllableEntity,
    normalizeCamera,
    normalizeCameras,
    saveCamera,
    removeCamera,
  }),
});

// The document checks for this one name.
globalThis.DashboardModernModules = DashboardModernModules;

export default DashboardModernModules;
