/* Compatibility facade. Production behavior lives in section modules. */
import "../src/sections/section-runtime.js";

export {
  applyAtomicEnergyBundle,
  installEnergySection,
  loadAtomicEnergyBundle,
  refreshEnergy,
} from "../src/sections/energy-section.js";
export {
  configuredLightGroups,
  installLightsAlertsSection,
  openLightEditor,
  openOrderedLightPicker,
  renderCanonicalLightsEditor,
  synchronizeLightAlerts,
} from "../src/sections/lights-alerts-section.js";
