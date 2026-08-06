import {
  energyBalance,
  energyCost,
  energyPercentages,
  nonNegative,
  periodDelta,
  sumEnergy,
} from "../core/energy-calculations.js";

const root = globalThis;
const KEY = "__DASHBOARDMODERN_ENERGY_CALCULATIONS__";

export function installEnergyCalculationsSection() {
  if (root[KEY]) return root[KEY];
  root[KEY] = Object.freeze({
    nonNegative,
    periodDelta,
    sumEnergy,
    energyBalance,
    energyPercentages,
    energyCost,
  });
  return root[KEY];
}
