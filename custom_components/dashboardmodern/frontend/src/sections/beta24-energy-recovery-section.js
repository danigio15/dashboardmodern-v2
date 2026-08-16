/* Beta 24 recovery for configurations that crossed the Beta 22/23 persistence rewrite.
 *
 * The canonical store deliberately keeps legacy projection keys for backwards
 * compatibility.  A schema-v4 dm_dashboard_state can however be older than its
 * cd_energy_model/cd_entity_overrides/cd_loads siblings (for example after a
 * cross-device restore).  DashboardStore.migrate() persists immediately, so
 * those newer sibling values used to be overwritten before they could be
 * reconciled.  Capture them before migration, recover only missing canonical
 * fields, then persist the repaired canonical state once.
 */

import { DashboardStore } from "../core/dashboard-store.js";
import { normalizeDevice } from "../core/device-model.js";
import { ENERGY_SLOT_MAP } from "../core/energy-projection.js";

const root = globalThis;
const doc = root.document;
const PATCH_MARKER = "__DASHBOARDMODERN_BETA24_STORE_RECOVERY__";
const SOC_MARKER = "dmBeta24SocOwner";

const clean = (value) => String(value ?? "").trim();
const objectValue = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const LEGACY_FIXED_LOADS = Object.freeze([
  {
    id: "load-boiler",
    name: "Boiler",
    icon: "mdi:water-boiler",
    powerSlot: "dm.boiler_potenza_resistenza_boiler",
    dailySlot: "dm.energy_boiler_oggi",
  },
  {
    id: "load-wallbox",
    name: "Wallbox",
    icon: "mdi:car-electric",
    powerSlot: "dm.ev_potenza_wallbox",
    dailySlot: "dm.ev_energia_wallbox_oggi",
  },
  {
    id: "load-clima",
    name: "Clima",
    icon: "mdi:snowflake",
    powerSlot: "dm.energy_potenza_condizionatori",
    dailySlot: "dm.energy_condizionatori_oggi",
  },
  {
    id: "load-lavanderia",
    name: "Lavanderia",
    icon: "mdi:washing-machine",
    powerSlot: "dm.energy_potenza_lavanderia",
    dailySlot: "dm.energy_lavanderia_oggi",
  },
  {
    id: "load-cucina",
    name: "Cucina",
    icon: "mdi:stove",
    powerSlot: "dm.energy_potenza_cucina",
    dailySlot: "dm.energy_cucina_oggi",
  },
]);

function parseStorage(storage, key, fallback) {
  try {
    return JSON.parse(storage?.getItem?.(key) || "null") ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function captureBeforeMigration(storage) {
  return {
    energy: parseStorage(storage, "cd_energy_model", {}),
    overrides: parseStorage(storage, "cd_entity_overrides", {}),
    loads: parseStorage(storage, "cd_loads", []),
    retiredEnergyLoads: parseStorage(storage, "cd_energy_loads", []),
  };
}

function ensureEnergyShape(state) {
  state.sections ||= {};
  const current = objectValue(state.sections.energy);
  const energy = {
    ...current,
    house: { ...objectValue(current.house) },
    grid: { ...objectValue(current.grid) },
    solar: { ...objectValue(current.solar) },
    battery: { ...objectValue(current.battery) },
    metadata: { ...objectValue(current.metadata) },
  };
  state.sections.energy = energy;
  return energy;
}

export function recoverEnergyConfiguration(state, captured = {}) {
  if (!state || typeof state !== "object") return 0;
  const energy = ensureEnergyShape(state);
  const legacyEnergy = objectValue(captured.energy);
  const overrides = {
    ...objectValue(captured.overrides),
    ...objectValue(state.sections?.entityOverrides),
  };
  let recovered = 0;

  for (const group of ["house", "grid", "solar", "battery"]) {
    for (const [key, value] of Object.entries(objectValue(legacyEnergy[group]))) {
      if (key === "metadata" || clean(energy[group]?.[key]) || !clean(value)) continue;
      energy[group][key] = value;
      recovered += 1;
    }
  }

  for (const [path, slot] of Object.entries(ENERGY_SLOT_MAP)) {
    const [group, key] = path.split(".");
    const value = clean(overrides[slot]);
    if (!value || clean(energy[group]?.[key])) continue;
    energy[group][key] = value;
    recovered += 1;
  }

  if (recovered) {
    energy.metadata = {
      ...energy.metadata,
      beta24_recovered_energy: true,
    };
  }
  return recovered;
}

function loadEntities(load = {}) {
  return [
    load.power_entity,
    load.daily_energy_entity,
    load.monthly_energy_entity,
    load.total_energy_entity,
    load.history_entity,
    load.energy_entity,
  ]
    .map(clean)
    .filter(Boolean);
}

function sameLoad(existing, candidate) {
  if (clean(existing?.id) && clean(existing.id) === clean(candidate?.id)) return true;
  const left = new Set(loadEntities(existing));
  if (loadEntities(candidate).some((entity) => left.has(entity))) return true;
  const leftName = clean(existing?.name).toLocaleLowerCase();
  const rightName = clean(candidate?.name).toLocaleLowerCase();
  return Boolean(leftName && rightName && leftName === rightName);
}

function normalizeLoad(raw, rooms, index) {
  return normalizeDevice(
    {
      ...raw,
      category: clean(raw?.category) || "secondary",
      show_in_dashboard: raw?.show_in_dashboard !== false,
      show_in_report: raw?.show_in_report !== false,
      order: Number.isFinite(+raw?.order) ? +raw.order : index,
    },
    "loads",
    { rooms, index },
  );
}

function retiredLoadCandidate(item = {}, index = 0) {
  const cumulative = clean(
    item.total_energy_entity || item.history_entity || item.energy_entity,
  );
  return {
    id: clean(item.id) || `load-beta22-${index + 1}`,
    name: clean(item.name) || `Carico ${index + 1}`,
    icon: clean(item.icon) || "mdi:power-plug",
    power_entity: clean(item.power_entity),
    daily_energy_entity: clean(item.daily_energy_entity),
    monthly_energy_entity: clean(item.monthly_energy_entity),
    total_energy_entity: cumulative,
    history_entity: clean(item.history_entity) || cumulative,
    category: "secondary",
    show_in_dashboard: true,
    show_in_report: true,
    order: Number.isFinite(+item.order) ? +item.order : index,
    metadata: { ...(item.metadata || {}), migrated_from_beta22_energy_loads: true },
  };
}

export function recoverCanonicalLoads(state, captured = {}) {
  if (!state || typeof state !== "object") return 0;
  state.sections ||= {};
  const rooms = Array.isArray(state.sections.rooms) ? state.sections.rooms : [];
  const current = Array.isArray(state.sections.loads) ? state.sections.loads.slice() : [];
  const candidates = [];

  if (Array.isArray(captured.loads)) candidates.push(...captured.loads);

  const overrides = {
    ...objectValue(captured.overrides),
    ...objectValue(state.sections.entityOverrides),
  };
  for (const definition of LEGACY_FIXED_LOADS) {
    const power = clean(overrides[definition.powerSlot]);
    const daily = clean(overrides[definition.dailySlot]);
    if (!power && !daily) continue;
    candidates.push({
      id: definition.id,
      name: definition.name,
      icon: definition.icon,
      power_entity: power,
      daily_energy_entity: daily,
      category: "secondary",
      show_in_dashboard: true,
      show_in_report: true,
      order: candidates.length,
      metadata: { migrated_from_fixed_energy_flow: true },
    });
  }

  const retired = [
    ...(Array.isArray(state.sections.energyLoads) ? state.sections.energyLoads : []),
    ...(Array.isArray(captured.retiredEnergyLoads) ? captured.retiredEnergyLoads : []),
  ];
  retired.forEach((item, index) => candidates.push(retiredLoadCandidate(item, index)));

  let added = 0;
  for (const raw of candidates) {
    const candidate = normalizeLoad(raw, rooms, current.length);
    if (!loadEntities(candidate).length && !clean(candidate.name)) continue;
    if (current.some((item) => sameLoad(item, candidate))) continue;
    current.push(candidate);
    added += 1;
  }

  state.sections.loads = current.map((item, index) => normalizeLoad(item, rooms, index));
  // Beta 22's parallel Energy Loads model is retired.  Its data has now been
  // promoted into the canonical Loads collection and must not become a second
  // editor/renderer owner again.
  state.sections.energyLoads = [];
  return added;
}

export function recoverStoreState(store, captured = {}) {
  if (!store?.state) return { energy: 0, loads: 0 };
  const energy = recoverEnergyConfiguration(store.state, captured);
  const loads = recoverCanonicalLoads(store.state, captured);
  if (energy || loads) store.persist();
  return { energy, loads };
}

export function installBeta24StoreRecovery() {
  const proto = DashboardStore.prototype;
  if (proto[PATCH_MARKER]) return false;
  const original = proto.migrate;
  if (typeof original !== "function") return false;

  proto.migrate = function dashboardModernBeta24Migrate(...args) {
    const captured = captureBeforeMigration(this.storage);
    const result = original.apply(this, args);
    const repaired = recoverStoreState(this, captured);
    if (repaired.energy || repaired.loads) {
      result.changes ||= [];
      result.changes.push(
        `beta24 recovery: energy ${repaired.energy}, loads ${repaired.loads}`,
      );
      root.console?.info?.("[DashboardStore] beta24 recovery", repaired);
    }
    return result;
  };
  proto[PATCH_MARKER] = true;
  return true;
}

export function normalizeBatterySocText(value) {
  const text = clean(value);
  if (!text) return text;
  if (/^soc\b/i.test(text)) return `SOC ${text.replace(/^soc\s*/i, "")}`.trim();
  if (/^(?:\d+(?:[.,]\d+)?%|—)$/.test(text)) return `SOC ${text}`;
  return text;
}

function normalizeBatterySocNode(node) {
  if (!node || node.hidden) return false;
  const normalized = normalizeBatterySocText(node.textContent);
  if (!normalized || normalized === clean(node.textContent)) return false;
  node.textContent = normalized;
  return true;
}

function bindBatterySocOwner() {
  const node = doc?.querySelector?.("#view-ist #v-battery-soc,#v-battery-soc");
  if (!node) return false;
  normalizeBatterySocNode(node);
  if (node.dataset?.[SOC_MARKER] === "true") return true;
  if (node.dataset) node.dataset[SOC_MARKER] = "true";
  if (typeof root.MutationObserver === "function") {
    const observer = new root.MutationObserver(() => normalizeBatterySocNode(node));
    observer.observe(node, { childList: true, characterData: true, subtree: true });
  }
  return true;
}

function scheduleSocOwner() {
  root.requestAnimationFrame?.(bindBatterySocOwner);
  root.setTimeout?.(bindBatterySocOwner, 0);
  root.setTimeout?.(bindBatterySocOwner, 120);
}

function requestInitialRemoteReconcile() {
  // config-persistence-section is imported before this module.  Defer one task
  // so modules-entry can construct/migrate the store first, then perform an
  // unconditional initial pull.  Previously some WebViews missed both runtime
  // events and never hydrated until a later focus/pageshow.
  root.setTimeout?.(() => root.cdSyncPull?.(), 0);
}

function installRuntimeRecovery() {
  installBeta24StoreRecovery();
  requestInitialRemoteReconcile();
  for (const name of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:energy-stable",
    "dashboardmodern:period-bundle",
  ])
    root.addEventListener?.(name, scheduleSocOwner);
  if (doc?.readyState === "loading")
    doc.addEventListener("DOMContentLoaded", scheduleSocOwner, { once: true });
  else scheduleSocOwner();
}

installRuntimeRecovery();

export const beta24EnergyRecovery = Object.freeze({
  recoverEnergyConfiguration,
  recoverCanonicalLoads,
  recoverStoreState,
  normalizeBatterySocText,
});
