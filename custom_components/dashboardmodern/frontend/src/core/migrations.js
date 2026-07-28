import { SCHEMA_VERSION, createId, normalizeDevice } from "./device-model.js";

export const SECTION_KEYS = Object.freeze({
  rooms: "cd_stanze", cameras: "cd_cameras", appliances: "cd_appliances",
  lights: "cd_luci", climate: "cd_clima_units", ev: "cd_ev_cars",
  covers: "cd_tapparelle", pool: "cd_piscina", irrigation: "cd_irrigazione",
  energy: "cd_energy_model",
});

function normalizeRooms(input = []) {
  const used = new Set();
  return (Array.isArray(input) ? input : []).map((room, index) => {
    let id = String(room.id || room.room_id || createId("room", null));
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return { ...room, id, name: String(room.name || `Room ${index + 1}`) };
  });
}

export function migrateState(input = {}) {
  if (+input.schema_version >= SCHEMA_VERSION) return { state: structuredClone(input), changes: [] };
  const changes = [];
  const rooms = normalizeRooms(input.sections?.rooms || input.rooms || []);
  const source = input.sections || input;
  const sections = { rooms };
  for (const section of Object.keys(SECTION_KEYS).filter((key) => key !== "rooms")) {
    const raw = source[section] || [];
    sections[section] = (Array.isArray(raw) ? raw : section === "lights" ? Object.entries(raw).map(([entity, name]) => ({ entity, name })) : raw ? [raw] : [])
      .map((item, index) => normalizeDevice(item, section, { rooms, index }));
  }
  changes.push(`schema ${input.schema_version || 0} → ${SCHEMA_VERSION}`);
  return { state: { schema_version: SCHEMA_VERSION, sections, visibility: { ...(input.visibility || input.sections_visibility || {}) } }, changes };
}

export function readLegacyState(storage) {
  const parse = (key, fallback) => { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const sections = {};
  for (const [section, key] of Object.entries(SECTION_KEYS)) sections[section] = parse(key, section === "lights" ? {} : []);
  return { schema_version: 0, sections, visibility: parse("cd_sections", {}) };
}
