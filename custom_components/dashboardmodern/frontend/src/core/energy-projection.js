import "../../legacy/mobile-ui-fixes.js";
import "../../legacy/report-mobile-fixes.js";
import { getDeviceVisual } from "./device-model.js";

export const ENERGY_SLOT_MAP = Object.freeze({
  "house.power": "dm.energy_potenza_consumo_casa",
  "house.daily_energy": "dm.energy_consumo_casa_oggi",
  "house.monthly_energy": "dm.energy_consumo_casa_mese",
  "house.annual_energy": "dm.energy_consumo_casa_anno",
  "house.total_energy": "dm.core_043",
  "grid.power": "dm.energy_potenza_scambio_rete",
  "grid.daily_import_energy": "dm.energy_energia_prelevata_oggi",
  "grid.daily_export_energy": "dm.energy_energia_immessa_oggi",
  "grid.monthly_import_energy": "dm.energy_rete_acquistata_mese",
  "grid.monthly_export_energy": "dm.energy_rete_venduta_mese",
  "grid.total_import_energy": "dm.core_045",
  "grid.total_export_energy": "dm.core_044",
  "solar.power": "dm.energy_potenza_fotovoltaico",
  "solar.daily_energy": "dm.energy_produzione_solare_oggi",
  "solar.monthly_energy": "dm.energy_produzione_solare_mese",
  "solar.annual_energy": "dm.energy_produzione_solare_anno",
  "solar.total_energy": "dm.core_046",
  "battery.power": "dm.energy_potenza_batteria",
  "battery.soc": "dm.energy_stato_carica_batteria",
  "battery.daily_charged_energy": "dm.energy_batteria_caricata_oggi",
  "battery.monthly_charged_energy": "dm.energy_batteria_caricata_mese",
  "battery.total_charged_energy": "dm.core_041",
  "battery.total_discharged_energy": "dm.core_042",
});

const TOTAL_ENERGY_ALIASES = Object.freeze([
  {
    path: "house.total_energy",
    targets: {
      daily_energy: "dm.energy_consumo_casa_oggi",
      monthly_energy: "dm.energy_consumo_casa_mese",
      annual_energy: "dm.energy_consumo_casa_anno",
    },
  },
  {
    path: "grid.total_import_energy",
    targets: {
      daily_import_energy: "dm.energy_energia_prelevata_oggi",
      monthly_import_energy: "dm.energy_rete_acquistata_mese",
    },
  },
  {
    path: "grid.total_export_energy",
    targets: {
      daily_export_energy: "dm.energy_energia_immessa_oggi",
      monthly_export_energy: "dm.energy_rete_venduta_mese",
    },
  },
  {
    path: "solar.total_energy",
    targets: {
      daily_energy: "dm.energy_produzione_solare_oggi",
      monthly_energy: "dm.energy_produzione_solare_mese",
      annual_energy: "dm.energy_produzione_solare_anno",
    },
  },
  {
    path: "battery.total_charged_energy",
    targets: {
      daily_charged_energy: "dm.energy_batteria_caricata_oggi",
      monthly_charged_energy: "dm.energy_batteria_caricata_mese",
    },
  },
]);

const REPORT_ICON_BY_TYPE = Object.freeze({
  forno: "♨️",
  oven: "♨️",
  frigo: "❄️",
  frigorifero: "❄️",
  fridge: "❄️",
  refrigerator: "❄️",
  congelatore: "🧊",
  freezer: "🧊",
  lavatrice: "🧺",
  washer: "🧺",
  washing_machine: "🧺",
  lavastoviglie: "🍽️",
  dishwasher: "🍽️",
  asciugatrice: "💨",
  dryer: "💨",
  microonde: "〰️",
  microwave: "〰️",
  boiler: "🚿",
  scaldabagno: "🚿",
  tv: "📺",
  televisore: "📺",
  condizionatore: "❄️",
  climatizzatore: "❄️",
  ventilatore: "🌀",
  fan: "🌀",
  robot: "🤖",
  aspirapolvere: "🧹",
  piano_cottura: "🔥",
  cappa: "🌬️",
  caffe: "☕",
  bollitore: "🫖",
  tostapane: "🍞",
});

const MDI_ICON_GLYPHS = Object.freeze({
  "mdi:stove": "♨️",
  "mdi:fridge-outline": "❄️",
  "mdi:fridge-bottom": "🧊",
  "mdi:washing-machine": "🧺",
  "mdi:dishwasher": "🍽️",
  "mdi:tumble-dryer": "💨",
  "mdi:microwave": "〰️",
  "mdi:water-boiler": "🚿",
  "mdi:television": "📺",
  "mdi:air-conditioner": "❄️",
  "mdi:fan": "🌀",
  "mdi:robot-vacuum": "🤖",
  "mdi:vacuum": "🧹",
  "mdi:coffee-maker": "☕",
  "mdi:kettle": "🫖",
  "mdi:toaster": "🍞",
  "mdi:flash": "⚡",
  "mdi:power-plug": "🔌",
  "mdi:devices": "🔌",
});

function normalizedToken(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function configured(value) {
  return String(value || "").trim();
}

/**
 * Project canonical Energy fields to the legacy runtime slots.
 *
 * A cumulative total is also projected to the period slots when no dedicated
 * daily/monthly/yearly entity was configured. The legacy period engine then
 * asks Home Assistant Long-Term Statistics for the delta of the requested
 * period, while explicit period entities keep precedence.
 */
export function projectEnergySlots(energy = {}, overrides = {}) {
  const result = { ...overrides };
  for (const [path, slot] of Object.entries(ENERGY_SLOT_MAP)) {
    const [group, key] = path.split(".");
    const value = configured(energy[group]?.[key]);
    if (value) result[slot] = value;
    else delete result[slot];
  }

  for (const definition of TOTAL_ENERGY_ALIASES) {
    const [group, totalKey] = definition.path.split(".");
    const totalEntity = configured(energy[group]?.[totalKey]);
    if (!totalEntity) continue;
    for (const [periodKey, slot] of Object.entries(definition.targets)) {
      if (!configured(energy[group]?.[periodKey])) result[slot] = totalEntity;
    }
  }
  return result;
}

export function entityIds(item = {}) {
  return [
    item.report_entity,
    item.total_energy_entity,
    item.energy_entity,
    item.monthly_energy_entity,
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

function entityAttributes(states, entityId) {
  return states?.[entityId]?.attributes || {};
}

function entityUnit(states, entityId) {
  return String(entityAttributes(states, entityId).unit_of_measurement || "").toLowerCase();
}

function entityStateClass(states, entityId) {
  return String(entityAttributes(states, entityId).state_class || "").toLowerCase();
}

function isPowerUnit(unit) {
  return /^(w|kw|mw)$/.test(String(unit || "").toLowerCase());
}

function isEnergyUnit(unit) {
  return /^(wh|kwh|mwh)$/.test(String(unit || "").toLowerCase());
}

function isValidEnergyCandidate(states, entityId) {
  if (!entityId || isPowerUnit(entityUnit(states, entityId))) return false;
  const attributes = entityAttributes(states, entityId);
  if (!Object.keys(attributes).length) return true;
  return (
    isEnergyUnit(entityUnit(states, entityId)) ||
    String(attributes.device_class || "").toLowerCase() === "energy"
  );
}

export function isCumulativeEnergyEntity(entityId, states = globalThis.STATES || {}) {
  if (!isValidEnergyCandidate(states, entityId)) return false;
  const stateClass = entityStateClass(states, entityId);
  if (stateClass === "total" || stateClass === "total_increasing") return true;
  return /(?:^|[._-])(total|totale|lifetime|meter|contatore)(?:[._-]|$)/i.test(entityId);
}

export function reportEntityForDevice(item = {}, states = globalThis.STATES || {}) {
  const reportEntity = configured(item.report_entity);
  if (isValidEnergyCandidate(states, reportEntity)) return reportEntity;

  const candidates = [...new Set(entityIds(item))];
  const explicitTotal = configured(item.total_energy_entity);
  if (isValidEnergyCandidate(states, explicitTotal)) return explicitTotal;

  const cumulative = candidates.find((entityId) => isCumulativeEnergyEntity(entityId, states));
  if (cumulative) return cumulative;

  const explicitPeriod = [
    item.energy_entity,
    item.monthly_energy_entity,
    item.daily_energy_entity,
  ]
    .map(configured)
    .find((entityId) => isValidEnergyCandidate(states, entityId));
  if (explicitPeriod) return explicitPeriod;

  return (
    candidates.find((entityId) => isEnergyUnit(entityUnit(states, entityId))) ||
    candidates.find(
      (entityId) =>
        String(entityAttributes(states, entityId).device_class || "").toLowerCase() === "energy" &&
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

function glyphForMdi(icon) {
  const value = String(icon || "").trim().toLowerCase();
  if (MDI_ICON_GLYPHS[value]) return MDI_ICON_GLYPHS[value];
  if (/fridge|snowflake/.test(value)) return "❄️";
  if (/stove|fire/.test(value)) return "♨️";
  if (/wash/.test(value)) return "🧺";
  if (/dish/.test(value)) return "🍽️";
  if (/dryer|wind|fan/.test(value)) return "💨";
  if (/water|boiler|shower/.test(value)) return "🚿";
  if (/television/.test(value)) return "📺";
  if (/coffee/.test(value)) return "☕";
  if (/kettle/.test(value)) return "🫖";
  if (/toaster/.test(value)) return "🍞";
  return "⚡";
}

/** Resolve a visible Report glyph without ever printing a raw `mdi:*` token. */
export function reportIconForDevice(item = {}) {
  const explicit = configured(item.report_icon || item.emoji_icon || item.icon);
  if (explicit && !explicit.startsWith("mdi:")) return explicit;
  if (explicit.startsWith("mdi:")) return glyphForMdi(explicit);

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
  if (visual?.kind === "icon" && visual.value) return glyphForMdi(visual.value);
  return "⚡";
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
        history: entity || item.history_entity || "",
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
