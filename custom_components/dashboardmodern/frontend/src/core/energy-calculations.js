const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function nonNegative(value) {
  return Math.max(0, number(value));
}

export function periodDelta(start, end) {
  const first = number(start);
  const last = number(end);
  if (last >= first) return last - first;
  // A cumulative meter may reset during the selected period. In that case
  // the last reading is the energy measured after the reset.
  return nonNegative(last);
}

export function sumEnergy(values = []) {
  return values.reduce((total, value) => total + nonNegative(value), 0);
}

export function energyBalance({ solar = 0, gridImport = 0, gridExport = 0, batteryCharge = 0, batteryDischarge = 0 } = {}) {
  const production = nonNegative(solar);
  const imported = nonNegative(gridImport);
  const exported = nonNegative(gridExport);
  const charged = nonNegative(batteryCharge);
  const discharged = nonNegative(batteryDischarge);
  const consumption = nonNegative(production + imported + discharged - exported - charged);
  const selfConsumed = Math.min(production, nonNegative(production - exported));
  return Object.freeze({ production, consumption, imported, exported, charged, discharged, selfConsumed });
}

export function energyPercentages(balance = {}) {
  const production = nonNegative(balance.production);
  const consumption = nonNegative(balance.consumption);
  const selfConsumed = nonNegative(balance.selfConsumed);
  return Object.freeze({
    selfConsumption: production > 0 ? Math.min(100, (selfConsumed / production) * 100) : 0,
    selfSufficiency: consumption > 0 ? Math.min(100, (selfConsumed / consumption) * 100) : 0,
  });
}

export function energyCost({ imported = 0, exported = 0 } = {}, { importPrice = 0, exportPrice = 0 } = {}) {
  const importCost = nonNegative(imported) * nonNegative(importPrice);
  const exportCredit = nonNegative(exported) * nonNegative(exportPrice);
  return Object.freeze({ importCost, exportCredit, netCost: importCost - exportCredit });
}
