// DM-FIX-20260812B
import {
  energyBalance,
  energyCost,
  energyPercentages,
  nonNegative,
} from "./energy-calculations.js";

function metrics(period = {}, rates = {}) {
  const balance = energyBalance({
    solar: period.solar,
    gridImport: period.gridImport,
    gridExport: period.gridExport,
    batteryCharge: period.batteryCharged,
    batteryDischarge: period.batteryDischarged,
  });
  const house = nonNegative(period.house || balance.consumption);
  const percentages = energyPercentages({ ...balance, consumption: house });
  const cost = energyCost(balance, rates);
  const withoutSolar = house * nonNegative(rates.importPrice);
  return Object.freeze({
    solar: balance.production,
    house,
    gridImport: balance.imported,
    gridExport: balance.exported,
    batteryCharged: balance.charged,
    batteryDischarged: balance.discharged,
    selfConsumed: balance.selfConsumed,
    selfConsumption: percentages.selfConsumption,
    selfSufficiency: percentages.selfSufficiency,
    importCost: cost.importCost,
    exportIncome: cost.exportCredit,
    netCost: Math.max(0, cost.netCost),
    withoutSolar,
    savings: Math.max(0, withoutSolar - Math.max(0, cost.netCost)),
  });
}

export function createEnergyViewModel(bundle = {}) {
  const month = metrics(bundle.month, bundle.rates);
  const year = metrics(bundle.year, bundle.rates);
  return Object.freeze({
    period: Object.freeze({ ...(bundle.period || {}) }),
    day: Object.freeze({ ...(bundle.day || {}) }),
    month,
    year,
    autonomy: Math.round(month.selfSufficiency),
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
  const house = nonNegative(period?.house);
  const gridImport = nonNegative(period?.gridImport);
  const amount = nonNegative(value);
  const gridShare = house > 0 ? Math.max(0, Math.min(1, gridImport / house)) : 1;
  return Object.freeze({ grid: amount * gridShare, solar: amount * (1 - gridShare) });
}
