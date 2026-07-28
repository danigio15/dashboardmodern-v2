export const SCHEMA_VERSION = 2;

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
  camera: "mdi:cctv",
  light: "mdi:lightbulb",
  climate: "mdi:thermostat",
  cover: "mdi:window-shutter",
  ev: "mdi:car-electric",
});

const LEGACY_NAMES = /^(generico|generic|other|altro|appliance)$/i;

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

export function normalizeDevice(input = {}, section, context = {}) {
  const entities = deviceEntities(input);
  const roomId =
    input.room_id || input.roomId || context.rooms?.find((r) => r.name === input.room)?.id || "";
  const type =
    input.device_type ||
    (!String(input.icon || "").startsWith("mdi:") ? input.icon : "") ||
    input.type ||
    "";
  const name = LEGACY_NAMES.test(String(input.name || "").trim())
    ? ""
    : String(input.name || "").trim();
  const base = {
    id: String(input.id || createId(section)),
    section,
    name,
    icon: /^mdi:/i.test(String(input.icon || "")) ? input.icon : "",
    image: String(input.image || input.image_url || ""),
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
  if (section === "appliances")
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
      device_type: String(type || "appliance").toLowerCase(),
    });
  return base;
}
