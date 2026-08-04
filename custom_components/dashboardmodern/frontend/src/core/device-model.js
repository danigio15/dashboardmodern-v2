export const SCHEMA_VERSION = 4;

export const APPLIANCE_VISUAL_KEYS = Object.freeze([
  "forno",
  "lavatrice",
  "lavastoviglie",
  "asciugatrice",
  "frigorifero",
  "frigo",
  "microonde",
  "piano_cottura",
  "condizionatore",
  "boiler",
  "scaldabagno",
  "generico",
]);

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
  boiler: "mdi:water-boiler",
  water_heater: "mdi:water-boiler",
  scaldabagno: "mdi:water-boiler",
  toaster: "mdi:toaster",
  tostapane: "mdi:toaster",
  coffee_machine: "mdi:coffee-maker",
  caffe: "mdi:coffee-maker",
  air_conditioner: "mdi:air-conditioner",
  condizionatore: "mdi:air-conditioner",
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
  fridge: "frigorifero",
  refrigerator: "frigorifero",
  microwave: "microonde",
  cooktop: "piano_cottura",
  hob: "piano_cottura",
  water_heater: "boiler",
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

function legacyVisualKey(input = {}, rawIcon = "", type = "") {
  const candidates = [input.visual_key, rawIcon, type, input.device_type, input.type]
    .map(normalizedToken)
    .filter(Boolean);
  for (const candidate of candidates) {
    const key = VISUAL_ALIASES[candidate] || candidate;
    if (APPLIANCE_VISUAL_KEYS.includes(key)) return key;
  }
  return "";
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
  const type = String(device.device_type || device.type || "").toLowerCase().trim();
  return { kind: "icon", value: TYPE_ICONS[type] || TYPE_ICONS[device.section] || "mdi:devices" };
}

export function createId(section = "device", random = globalThis.crypto?.randomUUID?.()) {
  return `${section}-${random || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
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
    visual_key: String(input.visual_key || visualKey),
    emoji_icon: emoji,
    room_id: String(roomId),
    entities,
    enabled: input.enabled !== false,
    order: Number.isFinite(+input.order) ? +input.order : context.index || 0,
    metadata: { ...(input.metadata || {}) },
  };
  if (input.entity || entities[0]) base.entity = String(input.entity || entities[0]);
  if (input.stream || input.stream_url || input.url)
    base.stream = String(input.stream || input.stream_url || input.url);
  if (input.threshold_run != null) base.metadata.threshold_run = +input.threshold_run;
  if (input.threshold_standby != null) base.metadata.threshold_standby = +input.threshold_standby;
  if (section === "appliances" || section === "loads")
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
    });
  return base;
}
