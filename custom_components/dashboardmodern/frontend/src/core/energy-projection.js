import "../../legacy/mobile-ui-fixes.js";
import "../../legacy/report-mobile-fixes.js";
import { getDeviceVisual } from "./device-model.js";

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

const REPORT_ICON_BY_TYPE = Object.freeze({
  forno: "mdi:stove",
  oven: "mdi:stove",
  frigo: "mdi:fridge-outline",
  frigorifero: "mdi:fridge-outline",
  fridge: "mdi:fridge-outline",
  refrigerator: "mdi:fridge-outline",
  congelatore: "mdi:fridge-bottom",
  freezer: "mdi:fridge-bottom",
  lavatrice: "mdi:washing-machine",
  washer: "mdi:washing-machine",
  washing_machine: "mdi:washing-machine",
  lavastoviglie: "mdi:dishwasher",
  dishwasher: "mdi:dishwasher",
  asciugatrice: "mdi:tumble-dryer",
  dryer: "mdi:tumble-dryer",
  microonde: "mdi:microwave",
  microwave: "mdi:microwave",
  boiler: "mdi:water-boiler",
  scaldabagno: "mdi:water-boiler",
  tv: "mdi:television",
  televisore: "mdi:television",
  condizionatore: "mdi:air-conditioner",
  climatizzatore: "mdi:air-conditioner",
  ventilatore: "mdi:fan",
  fan: "mdi:fan",
  robot: "mdi:robot-vacuum",
  aspirapolvere: "mdi:vacuum",
  piano_cottura: "mdi:stove",
  cappa: "mdi:fan",
  caffe: "mdi:coffee-maker",
  bollitore: "mdi:kettle",
  tostapane: "mdi:toaster",
});

function normalizedToken(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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

export function entityIds(item = {}) {
  return [
    item.report_entity,
    item.monthly_energy_entity,
    item.total_energy_entity,
    item.daily_energy_entity,
    item.history_entity,
    item.entity,
    ...(item.entities || []),
  ]
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : entry?.entity || entry?.entity_id || entry?.id || entry?.value,
    )
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function entityUnit(states, entityId) {
  return String(states?.[entityId]?.attributes?.unit_of_measurement || "").toLowerCase();
}

function isPowerUnit(unit) {
  return /^(w|kw)$/.test(String(unit || "").toLowerCase());
}

function isEnergyUnit(unit) {
  return /^(wh|kwh)$/.test(String(unit || "").toLowerCase());
}

export function reportEntityForDevice(item = {}, states = globalThis.STATES || {}) {
  const explicit = [
    item.report_entity,
    item.monthly_energy_entity,
    item.total_energy_entity,
    item.daily_energy_entity,
  ]
    .map((value) => String(value || "").trim())
    .find((entityId) => entityId && !isPowerUnit(entityUnit(states, entityId)));
  if (explicit) return explicit;

  const candidates = [...new Set(entityIds(item))];
  return (
    candidates.find((entityId) => isEnergyUnit(entityUnit(states, entityId))) ||
    candidates.find(
      (entityId) =>
        String(states?.[entityId]?.attributes?.device_class || "").toLowerCase() === "energy" &&
        !isPowerUnit(entityUnit(states, entityId)),
    ) ||
    candidates.find(
      (entityId) =>
        !isPowerUnit(entityUnit(states, entityId)) &&
        /energy|energia|kwh|consum|total|totale/i.test(entityId),
    ) ||
    ""
  );
}

/** Resolve the Report icon from the visual/type selected in Appliances. */
export function reportIconForDevice(item = {}) {
  const explicit = String(item.report_icon || item.emoji_icon || item.icon || "").trim();
  if (explicit) return explicit;

  const candidates = [
    item.visual_key,
    item.device_type,
    item.type,
    item.category,
    item.name,
  ].map(normalizedToken);
  for (const candidate of candidates) {
    if (REPORT_ICON_BY_TYPE[candidate]) return REPORT_ICON_BY_TYPE[candidate];
    const match = Object.keys(REPORT_ICON_BY_TYPE).find((key) => candidate.includes(key));
    if (match) return REPORT_ICON_BY_TYPE[match];
  }

  const visual = getDeviceVisual(item);
  if (visual?.kind === "icon" && visual.value) return visual.value;
  return "mdi:flash";
}

export function canonicalReportDevices(
  appliances = [],
  loads = [],
  states = globalThis.STATES || {},
) {
  const seen = new Set();
  return [...appliances, ...loads]
    .filter(
      (item) =>
        item.show_in_report !== false &&
        (item.show_in_report === true || entityIds(item).length > 0),
    )
    .sort((a, b) => (a.report_order ?? a.order ?? 0) - (b.report_order ?? b.order ?? 0))
    .map((item, index) => {
      const entity = reportEntityForDevice(item, states);
      const visual = getDeviceVisual(item);
      return {
        key: item.id || `report-${index}`,
        name: item.report_label || item.name || item.id,
        icon: reportIconForDevice(item),
        visual,
        visual_key: item.visual_key || "",
        image: visual?.kind === "image" ? visual.value : "",
        entity,
        history: item.history_entity || entity,
      };
    })
    .filter((item) => {
      if (!item.entity) return false;
      const identity = `${item.key}|${item.entity}`;
      const duplicate =
        seen.has(identity) || [...seen].some((value) => value.endsWith(`|${item.entity}`));
      seen.add(identity);
      return !duplicate;
    });
}
