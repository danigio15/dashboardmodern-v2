// DM-FIX-20260812B
import { getDeviceVisual } from "./device-model.js";
import { isCumulativeEnergyEntity } from "./period-service.js";

/* La scheda Temperature di Energia: inverter, batteria e ventola. Vive fuori
 * dai gruppi di impianto — la pagina che la legge e' una sola — e si configura
 * dalle impostazioni di Energia («manca la parte nel config per configurare le
 * entita' di questa parte, sia le temperature inverter che le ventole»). */
export const COOLING_SLOT_MAP = Object.freeze({
  "cooling.inverter_ac_temperature": "dm.energy_temperatura_ac_inverter",
  "cooling.inverter_dc_temperature": "dm.energy_temperatura_dc_inverter",
  "cooling.battery_temperature": "dm.energy_temperatura_batteria",
  "cooling.fan_power": "dm.energy_potenza_ventola_inverter",
  "cooling.fan_switch": "dm.energy_interruttore_ventola_inverter",
});

export const ENERGY_SLOT_MAP = Object.freeze({
  ...COOLING_SLOT_MAP,
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
  "grid.annual_import_energy": "dm.energy_rete_acquistata_anno",
  "grid.annual_export_energy": "dm.energy_rete_venduta_anno",
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
  "battery.annual_charged_energy": "dm.energy_batteria_caricata_anno",
  "battery.daily_discharged_energy": "dm.energy_batteria_scaricata_oggi",
  "battery.monthly_discharged_energy": "dm.energy_batteria_usata_mese",
  "battery.annual_discharged_energy": "dm.energy_batteria_usata_anno",
  "battery.total_charged_energy": "dm.core_041",
  "battery.total_discharged_energy": "dm.core_042",
});

export const TOTAL_ENERGY_ALIASES = Object.freeze([
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
      annual_import_energy: "dm.energy_rete_acquistata_anno",
    },
  },
  {
    path: "grid.total_export_energy",
    targets: {
      daily_export_energy: "dm.energy_energia_immessa_oggi",
      monthly_export_energy: "dm.energy_rete_venduta_mese",
      annual_export_energy: "dm.energy_rete_venduta_anno",
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
      annual_charged_energy: "dm.energy_batteria_caricata_anno",
    },
  },
  {
    path: "battery.total_discharged_energy",
    targets: {
      daily_discharged_energy: "dm.energy_batteria_scaricata_oggi",
      monthly_discharged_energy: "dm.energy_batteria_usata_mese",
      annual_discharged_energy: "dm.energy_batteria_usata_anno",
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

const configured = (value) => String(value || "").trim();
const normalizedToken = (value) =>
  configured(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export function projectEnergySlots(energy = {}, overrides = {}) {
  const result = { ...overrides };
  const totalPaths = new Set(TOTAL_ENERGY_ALIASES.map((definition) => definition.path));
  for (const [path, slot] of Object.entries(ENERGY_SLOT_MAP)) {
    if (totalPaths.has(path)) continue;
    const [group, key] = path.split(".");
    const value = configured(energy[group]?.[key]);
    if (value) result[slot] = value;
    else delete result[slot];
  }
  for (const definition of TOTAL_ENERGY_ALIASES) {
    const [group, totalKey] = definition.path.split(".");
    const totalEntity = configured(energy[group]?.[totalKey]);
    const totalSlot = ENERGY_SLOT_MAP[definition.path];
    const needsDerivation = Object.keys(definition.targets).some(
      (periodKey) => !configured(energy[group]?.[periodKey]),
    );
    if (totalEntity && needsDerivation) result[totalSlot] = totalEntity;
    else delete result[totalSlot];
    for (const [periodKey, periodSlot] of Object.entries(definition.targets)) {
      const explicit = configured(energy[group]?.[periodKey]);
      if (explicit) result[periodSlot] = explicit;
      else delete result[periodSlot];
    }
  }
  return result;
}

export function entityIds(item = {}) {
  return [
    item.total_energy_entity,
    item.report_entity,
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
    .map(configured)
    .filter(Boolean);
}

function entityAttributes(states, entityId) {
  return states?.[entityId]?.attributes || {};
}
function entityUnit(states, entityId) {
  return configured(entityAttributes(states, entityId).unit_of_measurement).toLowerCase();
}
function entityStateClass(states, entityId) {
  return configured(entityAttributes(states, entityId).state_class).toLowerCase();
}
function isPowerUnit(unit) {
  return /^(w|kw|mw)$/.test(configured(unit).toLowerCase());
}
function isEnergyUnit(unit) {
  return /^(wh|kwh|mwh)$/.test(configured(unit).toLowerCase());
}
function isValidEnergyCandidate(states, entityId) {
  if (!entityId || isPowerUnit(entityUnit(states, entityId))) return false;
  const attributes = entityAttributes(states, entityId);
  if (!Object.keys(attributes).length) return true;
  return (
    isEnergyUnit(entityUnit(states, entityId)) ||
    configured(attributes.device_class).toLowerCase() === "energy"
  );
}

/* La domanda «e' un contatore totale?» la fa period-service, per tutti.
 *
 * Qui ce n'era una seconda copia, con lo stesso nome e regole diverse: quella
 * di la' non controllava di avere davvero un'entita' di energia (e prendeva i
 * watt per kilowattora), questa non conosceva la parola «counter» e non
 * guardava mai il nome amichevole. Due meta' della stessa risposta, in due
 * moduli che non si parlano, su una decisione da cui dipende tutto il calcolo
 * dell'energia. Adesso e' una sola, e sta dove non ha dipendenze. Si
 * riesporta perche' mezza plancia la chiede a questo modulo. */
export { isCumulativeEnergyEntity };

export function reportEntityForDevice(item = {}, states = globalThis.STATES || {}) {
  const candidates = [...new Set(entityIds(item))];
  const configuredReport = configured(item.report_entity);
  const userSelectedReport = item.metadata?.report_entity_explicit === true;
  if (userSelectedReport && isValidEnergyCandidate(states, configuredReport))
    return configuredReport;

  const explicitTotal = configured(item.total_energy_entity);
  if (isCumulativeEnergyEntity(explicitTotal, states)) return explicitTotal;

  if (isCumulativeEnergyEntity(configuredReport, states)) return configuredReport;

  const cumulative = candidates.find((entityId) => isCumulativeEnergyEntity(entityId, states));
  if (cumulative) return cumulative;

  const explicitPeriod = [
    item.monthly_energy_entity,
    item.energy_entity,
    item.daily_energy_entity,
    configuredReport,
  ]
    .map(configured)
    .find((entityId) => isValidEnergyCandidate(states, entityId));
  if (explicitPeriod) return explicitPeriod;

  return (
    candidates.find((entityId) => isEnergyUnit(entityUnit(states, entityId))) ||
    candidates.find(
      (entityId) =>
        configured(entityAttributes(states, entityId).device_class).toLowerCase() === "energy" &&
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

function lifetimeHistoryForDevice(item = {}, entity = "", states = globalThis.STATES || {}) {
  const candidates = [
    item.history_entity,
    item.total_energy_entity,
    item.report_entity,
    entity,
    ...entityIds(item),
  ]
    .map(configured)
    .filter(Boolean);
  return candidates.find((candidate) => isCumulativeEnergyEntity(candidate, states)) || "";
}

function glyphForMdi(icon) {
  const value = configured(icon).toLowerCase();
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

function reportGlyphByType(...tokens) {
  for (const candidate of tokens.map(normalizedToken).filter(Boolean)) {
    if (REPORT_ICON_BY_TYPE[candidate]) return REPORT_ICON_BY_TYPE[candidate];
    const match = Object.keys(REPORT_ICON_BY_TYPE).find((key) => candidate.includes(key));
    if (match) return REPORT_ICON_BY_TYPE[match];
  }
  return "";
}

/* The Report entry shows the appliance it is about.
 *
 * This used to start from `emoji_icon`, which the appliance card itself never
 * draws: the card draws what `getDeviceVisual()` returns — the artwork chosen
 * in Elettrodomestici, or the mdi icon, or the one implied by the device type.
 * So an appliance set up as a washing machine appeared in the Report as
 * whatever emoji had been typed into some other field, and the two lists
 * disagreed about the same device.
 *
 * The order here is the card's order, with one addition in front: `report_icon`
 * is the icon deliberately given to the Report entry and always wins. Anything
 * loose — an emoji field the card ignores — is the last resort, not the first.
 */
export function reportIconForDevice(item = {}) {
  const override = configured(item.report_icon);
  if (override) return override.startsWith("mdi:") ? glyphForMdi(override) : override;

  const visual = getDeviceVisual(item);
  // Anything but the generic fallback is a deliberate choice, and the card
  // draws it: the Report follows it rather than inventing its own.
  const chosenIcon =
    visual?.kind === "icon" && visual.value && !/^mdi:devices?$/i.test(visual.value)
      ? visual.value
      : "";
  if (chosenIcon) return glyphForMdi(chosenIcon);

  const byType = reportGlyphByType(
    visual?.kind === "asset" ? visual.value : "",
    item.visual_key,
    item.device_type,
    item.type,
    item.category,
    item.name,
  );
  if (byType) return byType;

  const loose = configured(item.emoji_icon || item.icon);
  if (loose) return loose.startsWith("mdi:") ? glyphForMdi(loose) : loose;
  return visual?.kind === "icon" && visual.value ? glyphForMdi(visual.value) : "⚡";
}

export function canonicalReportDevices(
  appliances = [],
  loads = [],
  states = globalThis.STATES || {},
) {
  const seenEntities = new Set();
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
      const history = lifetimeHistoryForDevice(item, entity, states);
      return {
        key: item.id || `report-${index}`,
        name: item.report_label || item.name || item.id,
        icon: reportIconForDevice(item),
        visual,
        visual_key: item.visual_key || "",
        image: visual?.kind === "image" ? visual.value : "",
        entity,
        history,
        cumulative: Boolean(history),
      };
    })
    .filter((item) => {
      if (!item.entity || seenEntities.has(item.entity)) return false;
      seenEntities.add(item.entity);
      return true;
    });
}
