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

function plansFor(bundle, kind) {
  return Array.isArray(bundle?.sources?.[kind]?.plans) ? bundle.sources[kind].plans : [];
}

function plannedKeys(bundle, kind) {
  return new Set(plansFor(bundle, kind).map((plan) => plan?.key).filter(Boolean));
}

/**
 * A configured period-specific Casa/Home helper is an explicit measurement of
 * the value the user wants to display for that period.  Do not replace it with
 * a reconstruction made from Solar/Grid/Battery counters: different inverter
 * boundaries and independently rounded helpers can legitimately differ by a
 * few hundred Wh (the real-device Beta24 regression was 3.40 vs 3.70 kWh).
 *
 * Recorder/lifetime fallbacks are not explicit period measurements and may
 * still be reconciled from a complete electrical boundary.
 */
export function hasExplicitHousePeriod(bundle, kind) {
  return plansFor(bundle, kind).some(
    (plan) => plan?.key === "house" && plan?.direct === true && plan?.reason === "explicit-period",
  );
}

/**
 * Derive Home/Casa from the complete electrical flow boundary only when an
 * explicit Casa helper is not authoritative for the selected period.
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

export function reconcileEnergyPeriod(data = {}, planKeys = new Set(), options = {}) {
  if (options?.preferDirectHouse === true || !hasCompleteHomeFlow(planKeys)) return data;
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
  const direct = {
    day: hasExplicitHousePeriod(bundle, "day"),
    month: hasExplicitHousePeriod(bundle, "month"),
    year: hasExplicitHousePeriod(bundle, "year"),
  };
  const day = reconcileEnergyPeriod(bundle.day, plannedKeys(bundle, "day"), {
    preferDirectHouse: direct.day,
  });
  const month = reconcileEnergyPeriod(bundle.month, plannedKeys(bundle, "month"), {
    preferDirectHouse: direct.month,
  });
  const year = reconcileEnergyPeriod(bundle.year, plannedKeys(bundle, "year"), {
    preferDirectHouse: direct.year,
  });
  if (day === bundle.day && month === bundle.month && year === bundle.year) return bundle;
  return Object.freeze({
    ...bundle,
    day,
    month,
    year,
    home_source: Object.values(direct).some(Boolean)
      ? "configured-house-period+flow-fallback"
      : "home-assistant-flow-balance",
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
      hasExplicitHousePeriod,
      hasCompleteHomeFlow,
      reconcileEnergyPeriod,
      reconcileEnergyBundle,
    });
  }
  return root[KEY];
}
