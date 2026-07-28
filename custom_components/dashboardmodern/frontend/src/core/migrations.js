import { cloneValue, SCHEMA_VERSION, normalizeDevice } from "./device-model.js";

export const SECTION_KEYS = Object.freeze({
  rooms: "cd_stanze",
  cameras: "cd_cameras",
  appliances: "cd_appliances",
  lights: "cd_luci",
  climate: "cd_clima_units",
  ev: "cd_ev_cars",
  covers: "cd_tapparelle",
  pool: "cd_piscina",
  irrigation: "cd_irrigazione",
  energy: "cd_energy_model",
});

function slug(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function migrateRooms(input = []) {
  const used = new Set();
  return (Array.isArray(input) ? input : []).filter(Boolean).map((room, index) => {
    const seed =
      [room.floor, room.name].filter(Boolean).map(slug).filter(Boolean).join("-") ||
      `room-${index + 1}`;
    const base = String(room.id || room.room_id || `room-${seed}`);
    let id = base;
    let collision = 2;
    while (used.has(id)) id = `${base}-${collision++}`;
    used.add(id);
    return {
      id,
      name: String(room.name || `Room ${index + 1}`),
      icon: room.icon || "",
      floor: room.floor || "",
      order: Number.isFinite(+room.order) ? +room.order : index,
      metadata: { ...(room.metadata || {}) },
    };
  });
}

function migrateDevices(section, input, rooms) {
  return (Array.isArray(input) ? input : [])
    .filter(Boolean)
    .map((item, index) => normalizeDevice(item, section, { rooms, index }));
}
export const migrateCameras = (input, rooms) => migrateDevices("cameras", input, rooms);
export const migrateAppliances = (input, rooms) => migrateDevices("appliances", input, rooms);
export const migrateClimate = (input, rooms) => migrateDevices("climate", input, rooms);
export const migrateCovers = (input, rooms) => migrateDevices("covers", input, rooms);

export function migrateLights(input = {}, rooms = []) {
  const values = Array.isArray(input)
    ? input
    : Object.entries(input || {}).map(([entity, name]) => ({ entity, name }));
  return migrateDevices("lights", values, rooms);
}

export function migrateEv(input = [], rooms = []) {
  return migrateDevices("ev", Array.isArray(input) ? input : input ? [input] : [], rooms);
}

export function migratePool(input = {}) {
  return input && !Array.isArray(input) ? cloneValue(input) : {};
}
export function migrateIrrigation(input = {}) {
  return input && !Array.isArray(input) ? cloneValue(input) : {};
}
export function migrateEnergy(input = {}) {
  const value = input && !Array.isArray(input) ? input : {};
  return {
    house: { ...(value.house || {}) },
    grid: { ...(value.grid || {}) },
    solar: { ...(value.solar || {}) },
    battery: { ...(value.battery || {}) },
    metadata: { ...(value.metadata || {}) },
  };
}

export function normalizeSection(section, input, context = {}) {
  const rooms = context.rooms || [];
  const migrations = {
    rooms: migrateRooms,
    cameras: migrateCameras,
    appliances: migrateAppliances,
    lights: migrateLights,
    climate: migrateClimate,
    ev: migrateEv,
    covers: migrateCovers,
    pool: migratePool,
    irrigation: migrateIrrigation,
    energy: migrateEnergy,
  };
  return migrations[section]?.(input, rooms) ?? cloneValue(input);
}

export function migrateState(input = {}) {
  if (+input.schema_version >= SCHEMA_VERSION) return { state: cloneValue(input), changes: [] };
  const source = input.sections || input;
  const rooms = migrateRooms(source.rooms || []);
  const sections = { rooms };
  for (const section of Object.keys(SECTION_KEYS).filter((key) => key !== "rooms"))
    sections[section] = normalizeSection(section, source[section], { rooms });
  return {
    state: {
      schema_version: SCHEMA_VERSION,
      sections,
      visibility: { ...(input.visibility || input.sections_visibility || {}) },
    },
    changes: [`schema ${input.schema_version || 0} → ${SCHEMA_VERSION}`],
  };
}

export function readLegacyState(storage) {
  const parse = (key, fallback) => {
    try {
      return JSON.parse(storage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const sections = {};
  for (const [section, key] of Object.entries(SECTION_KEYS))
    sections[section] = parse(
      key,
      ["pool", "irrigation", "energy"].includes(section) ? {} : section === "lights" ? {} : [],
    );
  return { schema_version: 0, sections, visibility: parse("cd_sections", {}) };
}
