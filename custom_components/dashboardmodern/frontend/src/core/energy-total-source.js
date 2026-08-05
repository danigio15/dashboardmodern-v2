/* Compatibility facade: Energy runtime/editor now have one section owner. */
export {
  applyAtomicEnergyBundle,
  installEnergySection,
  loadAtomicEnergyBundle,
  refreshEnergy,
} from "../sections/energy-section.js";
import "../sections/energy-section.js";
