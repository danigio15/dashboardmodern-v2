import {
  energyBalance,
  energyCost,
  energyPercentages,
  nonNegative,
  periodDelta,
  sumEnergy,
} from "../core/energy-calculations.js";
import { root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_CALCULATIONS__";

function plannedKeys(bundle, kind) {
  return new Set((bundle?.sources?.[kind]?.plans || []).map((plan) => plan?.key).filter(Boolean));
}

/**
 * Home Assistant's Energy distribution derives Home/Casa from the complete
 * electrical flow boundary. A direct inverter "load consumption" counter can
 * represent a different boundary (for example loads behind a specific meter),
 * so it is a fallback rather than the canonical Home value whenever the full
 * Solar/Grid flow set is available.
 *
 * Battery charge/discharge are optional as a pair: an installation without a
 * battery can still derive Home, while a half-configured battery must never be
 * silently treated as zero in one direction.
 */
export function hasCompleteHomeFlow(planKeys = new Set()) {
  if (!planKeys.has("solar") || !planKeys.has("gridImport") || !planKeys.has("gridExport"))
    return false;
  const hasCharge = planKeys.has("batteryCharged");
  const hasDischarge = planKeys.has("batteryDischarged");
  return hasCharge === hasDischarge;
}

export function reconcileEnergyPeriod(data = {}, planKeys = new Set()) {
  if (!hasCompleteHomeFlow(planKeys)) return data;
  const balance = energyBalance({
    solar: data.solar,
    gridImport: data.gridImport,
    gridExport: data.gridExport,
    batteryCharge: planKeys.has("batteryCharged") ? data.batteryCharged : 0,
    batteryDischarge: planKeys.has("batteryDischarged") ? data.batteryDischarged : 0,
  });
  if (Math.abs(nonNegative(data.house) - balance.consumption) < 0.0005) return data;
  return Object.freeze({ ...data, house: balance.consumption });
}

export function reconcileEnergyBundle(bundle) {
  if (!bundle?.day || !bundle?.month || !bundle?.year) return bundle;
  const day = reconcileEnergyPeriod(bundle.day, plannedKeys(bundle, "day"));
  const month = reconcileEnergyPeriod(bundle.month, plannedKeys(bundle, "month"));
  const year = reconcileEnergyPeriod(bundle.year, plannedKeys(bundle, "year"));
  if (day === bundle.day && month === bundle.month && year === bundle.year) return bundle;
  return Object.freeze({
    ...bundle,
    day,
    month,
    year,
    home_source: "home-assistant-flow-balance",
  });
}

export function installEnergyCalculationsSection() {
  if (!root[KEY]) {
    root[KEY] = Object.freeze({
      nonNegative,
      periodDelta,
      sumEnergy,
      energyBalance,
      energyPercentages,
      energyCost,
      hasCompleteHomeFlow,
      reconcileEnergyPeriod,
      reconcileEnergyBundle,
    });
  }
  return root[KEY];
}
