import { cloneValue, SCHEMA_VERSION, normalizeDevice } from "./device-model.js";

export const SECTION_KEYS = Object.freeze({
  rooms: "cd_stanze",
  cameras: "cd_cameras",
  appliances: "cd_appliances",
  loads: "cd_loads",
  lights: "cd_luci",
  climate: "cd_clima_units",
  ev: "cd_ev_cars",
  covers: "cd_tapparelle",
  pool: "cd_piscina",
  irrigation: "cd_irrigazione",
  energy: "cd_energy_model",
  entityOverrides: "cd_entity_overrides",
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
export const migrateLoads = (input, rooms) => migrateDevices("loads", input, rooms);
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

export function migrateEntityOverrides(input = {}) {
  return input && !Array.isArray(input) ? cloneValue(input) : {};
}

export function normalizeSection(section, input, context = {}) {
  const rooms = context.rooms || [];
  const migrations = {
    rooms: migrateRooms,
    cameras: migrateCameras,
    appliances: migrateAppliances,
    loads: migrateLoads,
    lights: migrateLights,
    climate: migrateClimate,
    ev: migrateEv,
    covers: migrateCovers,
    pool: migratePool,
    irrigation: migrateIrrigation,
    energy: migrateEnergy,
    entityOverrides: migrateEntityOverrides,
  };
  return migrations[section]?.(input, rooms) ?? cloneValue(input);
}

function canonicalize(input = {}, version) {
  const source = input.sections || input;
  const rooms = migrateRooms(source.rooms || []);
  const sections = { rooms };
  for (const section of Object.keys(SECTION_KEYS).filter((key) => key !== "rooms"))
    sections[section] = normalizeSection(section, source[section], { rooms });
  return {
    state: {
      schema_version: version,
      sections,
      visibility: { ...(input.visibility || input.sections_visibility || {}) },
    },
    changes: [`schema ${input.schema_version || 0} → ${version}`],
  };
}

export const migrateV0ToV1 = (input) => canonicalize(input, 1).state;
export const migrateV1ToV2 = (input) => canonicalize(input, 2).state;
export const migrateV2ToV3 = (input) => canonicalize(input, 3).state;

const fingerprint = (item) =>
  String(
    item.monthly_energy_entity ||
      item.total_energy_entity ||
      item.power_entity ||
      item.entity ||
      "",
  ).trim();

export function migrateV3ToV4(input, legacy = {}) {
  const next = canonicalize(input, 4).state;
  const sections = next.sections;
  const overrides = { ...(sections.entityOverrides || {}), ...(legacy.entityOverrides || {}) };
  sections.entityOverrides = overrides;
  const washer = Object.entries(overrides).filter(
    ([key, value]) => key.startsWith("dm.lavatrice_") && value,
  );
  if (washer.length && !sections.appliances.some((item) => item.device_type === "lavatrice")) {
    const get = (suffix) => washer.find(([key]) => key.includes(suffix))?.[1] || "";
    sections.appliances.push(
      normalizeDevice(
        {
          id: "appliance-lavatrice",
          name: "Lavatrice",
          device_type: "lavatrice",
          visual_type: "asset",
          visual_key: "lavatrice",
          image: legacy.washerImage || "",
          entities: washer.map(([, entity]) => entity),
          state_entity: get("fase_corrente"),
          power_entity: get("potenza_presa"),
          history_entity: get("tempo_rimanente"),
          control_entity: get("presa_avvio") || get("avvio_ciclo"),
          metadata: { migrated_from: "entity-overrides-v3" },
          order: sections.appliances.length,
        },
        "appliances",
        { rooms: sections.rooms, index: sections.appliances.length },
      ),
    );
  }
  const seen = new Set(sections.loads.map(fingerprint).filter(Boolean));
  const add = (raw, category) => {
    const item = normalizeDevice(
      {
        ...raw,
        category,
        id: raw.id,
        power_entity: raw.power_entity || raw.pwr || raw.pwrLive || "",
        monthly_energy_entity: raw.monthly_energy_entity || raw.entity || "",
        history_entity: raw.history_entity || raw.entity || "",
        state_entity: raw.state_entity || raw.bin || "",
        icon: raw.icon || "",
        image: raw.image || "",
        room_id: raw.room_id || raw.room || "",
        show_in_report: raw.show_in_report !== false,
        show_in_dashboard: category !== "manual-report" && raw.show_in_dashboard !== false,
      },
      "loads",
      { rooms: sections.rooms, index: sections.loads.length },
    );
    const key = fingerprint(item);
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    sections.loads.push(item);
  };
  Object.entries(legacy.subloads || {}).forEach(([category, items]) =>
    (items || []).forEach((item) => add(item, category)),
  );
  (legacy.reportDevices || []).forEach((item) => add(item, "manual-report"));
  return next;
}

export function migrateState(input = {}, legacy = {}) {
  let state = cloneValue(input);
  const changes = [];
  let version = +state.schema_version || 0;
  const steps = [migrateV0ToV1, migrateV1ToV2, migrateV2ToV3];
  while (version < 3) {
    state = steps[version](state);
    changes.push(`schema ${version} → ${version + 1}`);
    version++;
  }
  if (version === 3) {
    state = migrateV3ToV4(state, legacy);
    changes.push("schema 3 → 4");
  }
  return { state, changes };
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
      ["pool", "irrigation", "energy", "entityOverrides"].includes(section)
        ? {}
        : section === "lights"
          ? {}
          : [],
    );
  // The historical washer was a standalone editor section backed by entity
  // overrides. Promote it to the canonical appliance model without removing
  // those overrides, so existing popup/control mappings keep working.
  const overrides = parse("cd_entity_overrides", {});
  const washerEntities = Object.entries(overrides).filter(
    ([key, value]) => key.startsWith("dm.lavatrice_") && value,
  );
  if (
    washerEntities.length &&
    !sections.appliances.some((item) => item?.device_type === "lavatrice")
  ) {
    const get = (suffix) => washerEntities.find(([key]) => key.includes(suffix))?.[1] || "";
    sections.appliances.push({
      id: "appliance-lavatrice",
      name: "Lavatrice",
      // Keep the project's original built-in washer artwork identifier.
      icon: "lavatrice",
      device_type: "lavatrice",
      entities: washerEntities.map(([, entity]) => entity),
      state_entity: get("fase_corrente"),
      power_entity: get("potenza_presa"),
      history_entity: get("tempo_rimanente"),
      control_entity: get("presa_avvio") || get("avvio_ciclo"),
      order: sections.appliances.length,
      metadata: { migrated_from: "lavatrice" },
    });
  }
  // Consolidate the two historical secondary-consumption stores once.  The
  // canonical load id is generated independently from its mutable name and
  // report rows that point at an existing load are deliberately not copied.
  if (!sections.loads.length) {
    const extras = parse("cd_subloads_extra", {});
    const reports = parse("cd_report_devices", []);
    const seen = new Set();
    const add = (item) => {
      const fingerprint = String(item.monthly_energy_entity || item.power_entity || "").trim();
      if (fingerprint && seen.has(fingerprint)) return;
      if (fingerprint) seen.add(fingerprint);
      sections.loads.push(item);
    };
    Object.entries(extras || {}).forEach(([category, items]) =>
      (items || []).forEach((item, index) =>
        add({
          id: item.id || `load-${slug(category) || "secondary"}-${index + 1}`,
          name: item.name || "",
          icon: item.icon || "",
          category,
          power_entity: item.power_entity || item.pwr || item.pwrLive || "",
          state_entity: item.state_entity || item.bin || "",
          show_in_report: item.show_in_report !== false,
          show_in_dashboard: item.show_in_dashboard !== false,
          order: sections.loads.length,
        }),
      ),
    );
    reports.forEach((item, index) =>
      add({
        id: item.id || `load-report-${index + 1}`,
        name: item.name || "",
        icon: item.icon || "",
        category: "manual-report",
        monthly_energy_entity: item.monthly_energy_entity || item.entity || "",
        history_entity: item.history_entity || item.entity || "",
        show_in_report: true,
        show_in_dashboard: false,
        order: sections.loads.length,
      }),
    );
  }
  return { schema_version: 0, sections, visibility: parse("cd_sections", {}) };
}
