export const ENERGY_SLOT_MAP = Object.freeze({
  "house.power": "dm.energy_potenza_consumo_casa",
  "grid.power": "dm.energy_potenza_scambio_rete",
  "solar.power": "dm.energy_potenza_fotovoltaico",
  "battery.power": "dm.energy_potenza_batteria",
  "battery.soc": "dm.energy_stato_carica_batteria",
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

export function canonicalReportDevices(appliances = [], loads = []) {
  return [...appliances, ...loads]
    .filter((item) => item.show_in_report === true)
    .sort((a, b) => (a.report_order ?? a.order ?? 0) - (b.report_order ?? b.order ?? 0))
    .map((item, index) => ({
      key: item.id || `report-${index}`,
      name: item.report_label || item.name || item.id,
      icon: item.report_icon || item.emoji_icon || item.icon || "⚡",
      entity: item.report_entity || item.monthly_energy_entity || item.total_energy_entity || "",
      history: item.history_entity || item.report_entity || "",
    }))
    .filter((item) => item.entity);
}
