// DM-FIX-20260812B
export const SCHEMA_VERSION = 4;

export const CLIMATE_HEAT_TOKENS = Object.freeze([
  "termo",
  "termostato",
  "thermostat",
  "heat",
  "heating",
  "caldo",
]);

export function canonicalClimateType(value) {
  return CLIMATE_HEAT_TOKENS.includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  )
    ? "termo"
    : "clima";
}

/**
 * Canonical appliance catalog.
 *
 * The keys intentionally match the original blue-icon appliance picker used by
 * the Add flow. Edit, rendering and migration must consume this same catalog so
 * a device can never silently fall back to `generico` just because a second
 * editor happened to know fewer appliance types.
 */
import { contactEntity } from "./shutter-window.js";

export const APPLIANCE_CATALOG = Object.freeze([
  { key: "lavatrice", it: "Lavatrice", en: "Washing machine" },
  { key: "lavastoviglie", it: "Lavastoviglie", en: "Dishwasher" },
  { key: "asciugatrice", it: "Asciugatrice", en: "Dryer" },
  { key: "forno", it: "Forno", en: "Oven" },
  { key: "microonde", it: "Microonde", en: "Microwave" },
  { key: "frigo", it: "Frigorifero", en: "Refrigerator" },
  { key: "congelatore", it: "Congelatore", en: "Freezer" },
  { key: "piano_cottura", it: "Piano cottura", en: "Cooktop" },
  { key: "cappa", it: "Cappa", en: "Hood" },
  { key: "ferro", it: "Ferro da stiro", en: "Iron" },
  { key: "aspirapolvere", it: "Aspirapolvere", en: "Vacuum cleaner" },
  { key: "robot", it: "Robot aspirapolvere", en: "Robot vacuum" },
  { key: "condizionatore", it: "Condizionatore", en: "Air conditioner" },
  { key: "ventilatore", it: "Ventilatore", en: "Fan" },
  { key: "scaldabagno", it: "Scaldabagno", en: "Water heater" },
  { key: "tv", it: "TV", en: "TV" },
  { key: "caffe", it: "Caffettiera", en: "Coffee maker" },
  { key: "tostapane", it: "Tostapane", en: "Toaster" },
  { key: "bollitore", it: "Bollitore", en: "Kettle" },
  { key: "generico", it: "Altro", en: "Other" },
]);

export const APPLIANCE_VISUAL_KEYS = Object.freeze(APPLIANCE_CATALOG.map((item) => item.key));

export function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value);
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

const TYPE_ICONS = Object.freeze({
  appliance: "mdi:power-plug",
  forno: "mdi:stove",
  microwave: "mdi:microwave",
  microonde: "mdi:microwave",
  washer: "mdi:washing-machine",
  lavatrice: "mdi:washing-machine",
  washing_machine: "mdi:washing-machine",
  dryer: "mdi:tumble-dryer",
  asciugatrice: "mdi:tumble-dryer",
  dishwasher: "mdi:dishwasher",
  lavastoviglie: "mdi:dishwasher",
  oven: "mdi:stove",
  fridge: "mdi:fridge-outline",
  refrigerator: "mdi:fridge-outline",
  frigorifero: "mdi:fridge-outline",
  frigo: "mdi:fridge-outline",
  freezer: "mdi:snowflake",
  congelatore: "mdi:snowflake",
  cooktop: "mdi:stove",
  piano_cottura: "mdi:stove",
  hood: "mdi:air-filter",
  cappa: "mdi:air-filter",
  iron: "mdi:iron",
  ferro: "mdi:iron",
  vacuum: "mdi:vacuum",
  aspirapolvere: "mdi:vacuum",
  robot_vacuum: "mdi:robot-vacuum",
  robot: "mdi:robot-vacuum",
  boiler: "mdi:water-boiler",
  water_heater: "mdi:water-boiler",
  scaldabagno: "mdi:water-boiler",
  toaster: "mdi:toaster",
  tostapane: "mdi:toaster",
  coffee_machine: "mdi:coffee-maker",
  coffee_maker: "mdi:coffee-maker",
  caffe: "mdi:coffee-maker",
  kettle: "mdi:kettle",
  bollitore: "mdi:kettle",
  television: "mdi:television",
  televisore: "mdi:television",
  tv: "mdi:television",
  air_conditioner: "mdi:air-conditioner",
  climatizzatore: "mdi:air-conditioner",
  condizionatore: "mdi:air-conditioner",
  fan: "mdi:fan",
  ventilatore: "mdi:fan",
  camera: "mdi:cctv",
  light: "mdi:lightbulb",
  climate: "mdi:thermostat",
  cover: "mdi:window-shutter",
  ev: "mdi:car-electric",
});

const LEGACY_NAMES = /^(generico|generic|other|altro|appliance)$/i;
const VISUAL_ALIASES = Object.freeze({
  oven: "forno",
  stove: "forno",
  washer: "lavatrice",
  washing_machine: "lavatrice",
  dishwasher: "lavastoviglie",
  dryer: "asciugatrice",
  fridge: "frigo",
  refrigerator: "frigo",
  frigorifero: "frigo",
  microwave: "microonde",
  freezer: "congelatore",
  cooktop: "piano_cottura",
  hob: "piano_cottura",
  hood: "cappa",
  iron: "ferro",
  vacuum: "aspirapolvere",
  vacuum_cleaner: "aspirapolvere",
  robot_vacuum: "robot",
  robot_aspirapolvere: "robot",
  air_conditioner: "condizionatore",
  climatizzatore: "condizionatore",
  fan: "ventilatore",
  boiler: "scaldabagno",
  water_heater: "scaldabagno",
  television: "tv",
  televisore: "tv",
  coffee: "caffe",
  coffee_machine: "caffe",
  coffee_maker: "caffe",
  caffettiera: "caffe",
  toaster: "tostapane",
  kettle: "bollitore",
  generic: "generico",
  other: "generico",
  altro: "generico",
  appliance: "generico",
});

function normalizedToken(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function tokenContains(token, candidate) {
  return (
    token === candidate ||
    token.startsWith(`${candidate}_`) ||
    token.endsWith(`_${candidate}`) ||
    token.includes(`_${candidate}_`)
  );
}

export function canonicalApplianceVisualKey(value = "") {
  const token = normalizedToken(value);
  if (!token) return "";
  const direct = VISUAL_ALIASES[token] || token;
  if (APPLIANCE_VISUAL_KEYS.includes(direct)) return direct;

  // Recover old records where the visual was accidentally saved as generic but
  // the human name still contains a known appliance type (for example
  // "Frigorifero cucina" or "Robot aspirapolvere"). Prefer longer aliases so a
  // specific type wins before a short token such as "tv".
  const candidates = [
    ...Object.entries(VISUAL_ALIASES),
    ...APPLIANCE_VISUAL_KEYS.map((key) => [key, key]),
  ].sort((a, b) => b[0].length - a[0].length);
  for (const [alias, key] of candidates) {
    if (key !== "generico" && tokenContains(token, alias)) return key;
  }
  return "";
}

export function applianceCatalogLabel(value = "", locale = "it") {
  const key = canonicalApplianceVisualKey(value) || "generico";
  const item = APPLIANCE_CATALOG.find((entry) => entry.key === key);
  return item?.[locale === "en" ? "en" : "it"] || item?.it || key;
}

function legacyVisualKey(input = {}, rawIcon = "", type = "") {
  const candidates = [input.visual_key, rawIcon, type, input.device_type, input.type, input.name]
    .map(normalizedToken)
    .filter(Boolean);
  let generic = "";
  for (const candidate of candidates) {
    const key = canonicalApplianceVisualKey(candidate);
    if (!key) continue;
    if (key !== "generico") return key;
    generic ||= key;
  }
  return generic;
}

export function entityLabel(entityId = "") {
  return String(entityId)
    .split(".")
    .pop()
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function deviceEntities(device = {}) {
  const explicit = [
    device.control_entity,
    device.power_entity,
    device.energy_entity,
    device.daily_energy_entity,
    device.monthly_energy_entity,
    device.total_energy_entity,
    device.history_entity,
    device.entity,
  ];
  return [
    ...new Set(
      explicit
        .concat(device.entities || [])
        .map((value) => (typeof value === "string" ? value : value?.entity))
        .filter(Boolean),
    ),
  ];
}

export function getDeviceDisplayName(device = {}, states = {}, locale = "it") {
  const configured = String(device.name || "").trim();
  if (configured && !LEGACY_NAMES.test(configured)) return configured;
  for (const entity of deviceEntities(device)) {
    const friendly = String(states[entity]?.attributes?.friendly_name || "").trim();
    if (friendly) return friendly;
  }
  const derived = entityLabel(deviceEntities(device)[0]);
  return derived || (locale === "it" ? "Dispositivo" : "Device");
}

export function getDeviceVisual(device = {}) {
  const image = String(device.image || device.image_url || "").trim();
  if (image) return { kind: "image", value: image };
  if (device.visual_type && device.visual_key)
    return { kind: device.visual_type, value: device.visual_key };
  const icon = String(device.icon || "").trim();
  if (/^mdi:[a-z0-9-]+$/i.test(icon)) return { kind: "icon", value: icon };
  const type = String(device.device_type || device.type || "")
    .toLowerCase()
    .trim();
  return { kind: "icon", value: TYPE_ICONS[type] || TYPE_ICONS[device.section] || "mdi:devices" };
}

export function createId(section = "device", random = globalThis.crypto?.randomUUID?.()) {
  return `${section}-${random || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

function assignFiniteNumber(target, key, ...values) {
  for (const value of values) {
    if (value === "" || value == null) continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      target[key] = numeric;
      return;
    }
  }
}

export function normalizeDevice(input = {}, section, context = {}) {
  const entities = deviceEntities(input);
  const explicitRoomId = input.room_id || input.roomId || "";
  const legacyRoomRef = input.room || "";
  const matchedRoom = context.rooms?.find(
    (room) => room.id === legacyRoomRef || room.name === legacyRoomRef,
  );
  const roomId = explicitRoomId || matchedRoom?.id || "";
  const rawIcon = String(input.icon || "");
  const emoji =
    !rawIcon.startsWith("mdi:") && /[^\x00-\x7f]/.test(rawIcon)
      ? rawIcon
      : String(input.emoji_icon || "");
  const type =
    input.device_type || input.type || (!rawIcon.startsWith("mdi:") && !emoji ? rawIcon : "");
  const visualKey = legacyVisualKey(input, rawIcon, type);
  const name = LEGACY_NAMES.test(String(input.name || "").trim())
    ? ""
    : String(input.name || "").trim();
  const image = String(input.image || input.image_url || "");
  const base = {
    id: String(input.id || createId(section)),
    section,
    name,
    icon: /^mdi:/i.test(rawIcon) ? rawIcon : "",
    image,
    image_url: image,
    visual_type: String(input.visual_type || (visualKey ? "asset" : "")),
    visual_key: String(visualKey || input.visual_key || ""),
    emoji_icon: emoji,
    room_id: String(roomId),
    entities,
    enabled: input.enabled !== false,
    order: Number.isFinite(+input.order) ? +input.order : context.index || 0,
    metadata: { ...(input.metadata || {}) },
  };
  if (input.entity || entities[0]) base.entity = String(input.entity || entities[0]);
  if (section === "climate") {
    base.type = canonicalClimateType(input.type);
  }
  if (input.stream || input.stream_url || input.url)
    base.stream = String(input.stream || input.stream_url || input.url);
  /* Il contatto dell'infisso di una tapparella.
   *
   * Il modello tiene solo i campi che conosce, ed e' giusto cosi': e' quello che
   * impedisce a una configurazione scritta a mano di portarsi dietro spazzatura.
   * Ma vuol dire anche che un campo nuovo, se non lo si dichiara qui, sparisce
   * alla prima normalizzazione — e il contatto spariva appena si apriva
   * l'editor, lasciando la finestra sempre chiusa. */
  if (section === "covers") {
    const contact = contactEntity(input);
    if (contact) base.contact = contact;
  }
  if (input.threshold_run != null) base.metadata.threshold_run = +input.threshold_run;
  if (input.threshold_standby != null) base.metadata.threshold_standby = +input.threshold_standby;
  if (section === "ev") {
    const legacy = cloneValue(input) || {};
    const overrideSource =
      input.ov && typeof input.ov === "object" && !Array.isArray(input.ov)
        ? input.ov
        : input.overrides && typeof input.overrides === "object" && !Array.isArray(input.overrides)
          ? input.overrides
          : {};
    const evImage = String(input.img || input.image || input.image_url || "");
    return {
      ...legacy,
      ...base,
      name: base.name || String(input.name || "").trim(),
      icon: base.icon || String(input.icon || ""),
      image: base.image || evImage,
      image_url: base.image_url || evImage,
      img: evImage,
      brand: String(input.brand || ""),
      ov: cloneValue(overrideSource),
      overrides: cloneValue(overrideSource),
    };
  }
  if (section === "appliances" || section === "loads") {
    Object.assign(base, {
      power_entity: input.power_entity || input.power || "",
      energy_entity: input.energy_entity || input.energy || "",
      daily_energy_entity:
        input.daily_energy_entity || input.daily_energy || input.energy_today || "",
      monthly_energy_entity: input.monthly_energy_entity || input.monthly_energy || "",
      total_energy_entity: input.total_energy_entity || input.total_energy || "",
      history_entity: input.history_entity || input.history || "",
      control_entity:
        input.control_entity || input.switch_entity || input.switch || input.light || "",
      state_entity: input.state_entity || input.state || "",
      show_in_report: input.show_in_report !== false,
      show_in_dashboard: input.show_in_dashboard !== false,
      report_label: String(input.report_label || ""),
      report_icon: String(input.report_icon || emoji),
      report_entity: String(input.report_entity || ""),
      report_order: Number.isFinite(+input.report_order) ? +input.report_order : context.index || 0,
      category: String(input.category || type || (section === "loads" ? "secondary" : "appliance")),
      device_type: String(type || (section === "loads" ? "secondary" : "appliance")).toLowerCase(),
      // Appliance card (showcase) contract: countdown, temperature, alarm and
      // last-cycle sources are first-class persisted fields, so the section
      // renderer and the config editor share one canonical schema.
      remaining_entity: input.remaining_entity || input.remaining_time_entity || "",
      cycle_duration_entity: input.cycle_duration_entity || "",
      temperature_entity: input.temperature_entity || input.temp_entity || "",
      alert_entity: input.alert_entity || input.problem_entity || "",
      last_start_entity: input.last_start_entity || input.start_time_entity || "",
      last_duration_entity: input.last_duration_entity || "",
      last_energy_entity: input.last_energy_entity || "",
      last_cost_entity: input.last_cost_entity || "",
    });
    // Optional numbers are stored only when finite: an empty string must never
    // reach Number() consumers as 0 (a 0 W running threshold would mark every
    // plugged appliance as running).
    assignFiniteNumber(base, "threshold_run", input.threshold_run, input.metadata?.threshold_run);
    assignFiniteNumber(
      base,
      "threshold_standby",
      input.threshold_standby,
      input.metadata?.threshold_standby,
    );
    assignFiniteNumber(base, "cycle_minutes", input.cycle_minutes);
    assignFiniteNumber(base, "temp_min", input.temp_min);
    assignFiniteNumber(base, "temp_max", input.temp_max);
    assignFiniteNumber(base, "max_power", input.max_power);
    assignFiniteNumber(base, "price_kwh", input.price_kwh);
  }
  return base;
}
