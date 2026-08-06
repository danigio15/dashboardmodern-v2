import { calculateEnergyMetrics } from "./energy-calculations.js";

const finite = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export function createEnergyViewModel(bundle = {}) {
  const month = calculateEnergyMetrics(bundle.month, bundle.rates);
  const year = calculateEnergyMetrics(bundle.year, bundle.rates);
  const autonomy = month.house > 0
    ? Math.max(0, Math.min(100, Math.round(((month.house - month.gridImport) / month.house) * 100)))
    : 0;

  return Object.freeze({
    period: Object.freeze({ ...(bundle.period || {}) }),
    day: Object.freeze({ ...(bundle.day || {}) }),
    month: Object.freeze(month),
    year: Object.freeze(year),
    autonomy,
    overview: Object.freeze({
      production: month.solar,
      consumption: month.house,
      gridImport: month.gridImport,
      gridExport: month.gridExport,
      batteryCharged: month.batteryCharged,
      batteryDischarged: month.batteryDischarged,
      importCost: month.importCost,
      exportIncome: month.exportIncome,
      netCost: month.netCost,
      savings: month.savings,
    }),
    annual: Object.freeze({
      importCost: year.importCost,
      exportIncome: year.exportIncome,
      netCost: year.netCost,
      savings: year.savings,
      house: year.house,
      gridImport: year.gridImport,
    }),
  });
}

export function splitDeviceConsumption(period, value) {
  const house = finite(period?.house);
  const gridImport = finite(period?.gridImport);
  const amount = Math.max(0, finite(value));
  const gridShare = house > 0 ? Math.max(0, Math.min(1, gridImport / house)) : 1;
  return Object.freeze({
    grid: amount * gridShare,
    solar: amount * (1 - gridShare),
  });
}
