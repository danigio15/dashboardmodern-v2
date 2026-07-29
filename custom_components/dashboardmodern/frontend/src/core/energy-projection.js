import "../../legacy/mobile-ui-fixes.js";
import "../../legacy/report-mobile-fixes.js";

export const ENERGY_SLOT_MAP = Object.freeze({
  "house.power": "dm.energy_potenza_consumo_casa",
  "house.daily_energy": "dm.energy_consumo_casa_oggi",
  "house.monthly_energy": "dm.energy_consumo_casa_mese",
  "house.annual_energy": "dm.energy_consumo_casa_anno",
  "grid.power": "dm.energy_potenza_scambio_rete",
  "grid.daily_import_energy": "dm.energy_energia_prelevata_oggi",
  "grid.daily_export_energy": "dm.energy_energia_immessa_oggi",
  "grid.monthly_import_energy": "dm.energy_rete_acquistata_mese",
  "grid.monthly_export_energy": "dm.energy_rete_venduta_mese",
  "solar.power": "dm.energy_potenza_fotovoltaico",
  "solar.daily_energy": "dm.energy_produzione_solare_oggi",
  "solar.monthly_energy": "dm.energy_produzione_solare_mese",
  "solar.annual_energy": "dm.energy_produzione_solare_anno",
  "battery.power": "dm.energy_potenza_batteria",
  "battery.soc": "dm.energy_stato_carica_batteria",
  "battery.daily_charged_energy": "dm.energy_batteria_caricata_oggi",
  "battery.monthly_charged_energy": "dm.energy_batteria_caricata_mese",
});

export function projectEnergySlots(energy = {}, overrides = {}) {
  const result = { ...overrides };
  for (const [path, slot] of Object.entries(ENERGY_SLOT_MAP)) {
    const [group, key] = path.split(".");
    const value = String(energy[group]?.[key] || "").trim();
    if (value) result[slot] = value;
    else delete result[slot];
  }
  return result;
}

function entityIds(item = {}) {
  return [
    item.report_entity,
    item.monthly_energy_entity,
    item.total_energy_entity,
    item.energy_entity,
    item.daily_energy_entity,
    item.history_entity,
    item.entity,
    ...(item.entities || []),
  ]
    .map((entry) => (typeof entry === "string" ? entry : entry?.entity))
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function entityUnit(states, entityId) {
  return String(states?.[entityId]?.attributes?.unit_of_measurement || "").toLowerCase();
}

export function reportEntityForDevice(item = {}, states = globalThis.STATES || {}) {
  const explicit = [
    item.report_entity,
    item.monthly_energy_entity,
    item.total_energy_entity,
    item.energy_entity,
    item.daily_energy_entity,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean);
  if (explicit) return explicit;

  const candidates = [...new Set(entityIds(item))];
  return (
    candidates.find((entityId) => /^(wh|kwh)$/.test(entityUnit(states, entityId))) ||
    candidates.find((entityId) => /(?:^|[_-])(mese|month|monthly)(?:$|[_-])/i.test(entityId)) ||
    candidates.find((entityId) => /energy|energia|kwh|consum|total|totale/i.test(entityId)) ||
    ""
  );
}

export function canonicalReportDevices(
  appliances = [],
  loads = [],
  states = globalThis.STATES || {},
) {
  return [...appliances, ...loads]
    .filter((item) => item.show_in_report !== false)
    .sort((a, b) => (a.report_order ?? a.order ?? 0) - (b.report_order ?? b.order ?? 0))
    .map((item, index) => {
      const entity = reportEntityForDevice(item, states);
      return {
        key: item.id || `report-${index}`,
        name: item.report_label || item.name || item.id,
        icon: item.report_icon || item.emoji_icon || item.icon || "⚡",
        entity,
        history: item.history_entity || entity,
      };
    })
    .filter((item) => item.entity);
}
