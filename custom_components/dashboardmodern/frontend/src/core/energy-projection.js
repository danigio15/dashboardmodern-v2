export const ENERGY_SLOT_MAP = Object.freeze({
  "house.power": "dm.energy_potenza_consumo_casa",
  "house.daily_energy": "dm.energy_consumo_casa_oggi",
  "house.monthly_energy": "dm.energy_consumo_casa_mese",
  "house.annual_energy": "dm.energy_consumo_casa_anno",
  "house.total_energy": "dm.energy_consumo_casa_totale",
  "grid.power": "dm.energy_potenza_scambio_rete",
  "grid.import_power": "dm.energy_potenza_prelevata_rete",
  "grid.export_power": "dm.energy_potenza_immessa_rete",
  "grid.daily_import_energy": "dm.energy_energia_prelevata_oggi",
  "grid.daily_export_energy": "dm.energy_energia_immessa_oggi",
  "grid.monthly_import_energy": "dm.energy_rete_acquistata_mese",
  "grid.monthly_export_energy": "dm.energy_rete_venduta_mese",
  "grid.total_import_energy": "dm.energy_rete_acquistata_totale",
  "grid.total_export_energy": "dm.energy_rete_venduta_totale",
  "solar.power": "dm.energy_potenza_fotovoltaico",
  "solar.daily_energy": "dm.energy_produzione_solare_oggi",
  "solar.monthly_energy": "dm.energy_produzione_solare_mese",
  "solar.annual_energy": "dm.energy_produzione_solare_anno",
  "solar.total_energy": "dm.energy_produzione_solare_totale",
  "battery.power": "dm.energy_potenza_batteria",
  "battery.soc": "dm.energy_stato_carica_batteria",
  "battery.charged_energy": "dm.energy_batteria_caricata_totale",
  "battery.discharged_energy": "dm.energy_batteria_scaricata_totale",
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
