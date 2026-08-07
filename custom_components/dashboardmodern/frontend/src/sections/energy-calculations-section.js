import {
  energyBalance,
  energyCost,
  energyPercentages,
  nonNegative,
  periodDelta,
  sumEnergy,
} from "../core/energy-calculations.js";
import { doc, formatNumber, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_CALCULATIONS__";
const LISTENER_KEY = "__DASHBOARDMODERN_ENERGY_PARITY_LISTENER__";
const HOUSE_SLOTS = Object.freeze({
  day: "dm.energy_consumo_casa_oggi",
  month: "dm.energy_consumo_casa_mese",
  year: "dm.energy_consumo_casa_anno",
});

function plannedKeys(bundle, kind) {
  return new Set((bundle?.sources?.[kind]?.plans || []).map((plan) => plan?.key).filter(Boolean));
}

/**
 * Home Assistant's Energy dashboard derives Home consumption from the energy
 * flows. When Solar + Grid import are available, use the same balance instead
 * of trusting an inverter-specific "load total" meter that can represent a
 * different boundary and therefore disagree by tens of kWh.
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

function publishHouseDerived(kind, value) {
  const entityId = HOUSE_SLOTS[kind];
  if (!entityId || !Number.isFinite(Number(value))) return;
  root.CD_PERIOD ||= {};
  root.CD_PERIOD[entityId] = Number(value);
  const broker = root.DashboardModernEnergyService?.broker;
  broker?.ingestState?.({
    entity_id: entityId,
    state: String(Number(value)),
    attributes: {
      friendly_name: entityId,
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "measurement",
      dashboardmodern_derived: true,
      dashboardmodern_source: "ha-energy-balance",
      dashboardmodern_period: kind,
    },
  });
}

function pokeProjection(bundle) {
  const values = [
    ["v-home-day", bundle?.day?.house],
    ["v-home-month", bundle?.month?.house],
    ["ed-kpi-cons", bundle?.month?.house],
  ];
  for (const [id, value] of values) {
    const node = doc?.getElementById(id);
    if (!node || !Number.isFinite(Number(value))) continue;
    const text = `${formatNumber(value)} kWh`;
    if (node.textContent !== text) node.textContent = text;
  }
}

function installParityListener() {
  if (root[LISTENER_KEY]) return;
  root[LISTENER_KEY] = true;
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    const bundle = event?.detail || root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle;
    const corrected = reconcileEnergyBundle(bundle);
    if (!corrected || corrected === bundle) return;
    if (root.__DASHBOARDMODERN_RUNTIME_ROOT__) root.__DASHBOARDMODERN_RUNTIME_ROOT__.bundle = corrected;
    publishHouseDerived("day", corrected.day?.house);
    publishHouseDerived("month", corrected.month?.house);
    publishHouseDerived("year", corrected.year?.house);
    // The Energy section observes these nodes and will immediately re-project
    // every dependent KPI/flow from the corrected canonical bundle.
    pokeProjection(corrected);
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
      reconcileEnergyPeriod,
      reconcileEnergyBundle,
    });
  }
  installParityListener();
  return root[KEY];
}
