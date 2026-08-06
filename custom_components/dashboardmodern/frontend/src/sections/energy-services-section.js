import { createEnergyBundleService } from "../core/energy-bundle-service.js";
import { createEnergyViewModel, splitDeviceConsumption } from "../core/energy-view-model.js";
import { energyBalance, energyCost, energyPercentages, periodDelta, sumEnergy } from "../core/energy-calculations.js";

const root = globalThis;
const KEY = "__DASHBOARDMODERN_ENERGY_SERVICES__";

export function installEnergyServicesSection() {
  if (root[KEY]) return root[KEY];
  const api = Object.freeze({
    createBundleService: createEnergyBundleService,
    createViewModel: createEnergyViewModel,
    splitDeviceConsumption,
    calculations: Object.freeze({
      energyBalance,
      energyCost,
      energyPercentages,
      periodDelta,
      sumEnergy,
    }),
  });
  root[KEY] = api;
  return api;
}

installEnergyServicesSection();
