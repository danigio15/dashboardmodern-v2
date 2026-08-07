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
 * Home Assistant's Energy dashboard derives Home consumption from the energy
 * flows. When Solar + Grid import are available, use the same balance instead
 * of trusting an inverter-specific load meter that can represent a different
 * electrical boundary.
 */
export function reconcileEnergyPeriod(data = {}, planKeys = new Set()) {
  if (!planKeys.has("solar") || !planKeys.has("gridImport")) return data;
  const balance = energyBalance({
    solar: data.solar,
    gridImport: data.gridImport,
    gridExport: planKeys.has("gridExport") ? data.gridExport : 0,
    batteryCharge: planKeys.has("batteryCharged") ? data.batteryCharged : 0,
    batteryDischarge: planKeys.has("batteryDischarged") ? data.batteryDischarged : 0,
  });
  if (Math.abs(Number(data.house || 0) - balance.consumption) < 0.0005) return data;
  return Object.freeze({ ...data, house: balance.consumption });
}

export function reconcileEnergyBundle(bundle) {
  if (!bundle?.day || !bundle?.month || !bundle?.year) return bundle;
  const day = reconcileEnergyPeriod(bundle.day, plannedKeys(bundle, "day"));
  const month = reconcileEnergyPeriod(bundle.month, plannedKeys(bundle, "month"));
  const year = reconcileEnergyPeriod(bundle.year, plannedKeys(bundle, "year"));
  if (day === bundle.day && month === bundle.month && year === bundle.year) return bundle;
  return Object.freeze({ ...bundle, day, month, year, home_source: "ha-energy-balance" });
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
      reconcileEnergyPeriod,
      reconcileEnergyBundle,
    });
  }
  return root[KEY];
}
