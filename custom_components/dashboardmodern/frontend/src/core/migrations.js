import { cloneValue, SCHEMA_VERSION, normalizeDevice } from "./device-model.js";
import { ENERGY_SLOT_MAP } from "./energy-projection.js";
import { normalizeRobots } from "./robot-model.js";

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
  robots: "cd_robot",
  energy: "cd_energy_model",
  energyLoads: "cd_energy_loads",
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
    const tempName = String(room.temp_name || room.temperature_name || "");
    const humName = String(room.hum_name || room.humidity_name || "");
    return {
      id,
      name: String(room.name || `Room ${index + 1}`),
      icon: room.icon || "",
      floor: room.floor || "",
      // Temperature sensors historically lived on cd_stanze. Keep these
      // fields in the canonical room projection: dropping them here makes
      // DashboardStore.persist() destructively rewrite cd_stanze.
      temp: String(room.temp || room.temperature_entity || ""),
      hum: String(room.hum || room.humidity_entity || ""),
      ...(tempName ? { temp_name: tempName } : {}),
      ...(humName ? { hum_name: humName } : {}),
      rgb: room.rgb || "",
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

/* I robot aspirapolvere.
 *
 * Sono un elenco come le auto o le telecamere: un oggetto solo — che e' come
 * nascono quasi tutte le sezioni — vale come elenco di uno, cosi' una
 * configurazione scritta a mano non si perde. */
export function migrateRobots(input = []) {
  return normalizeRobots(input);
}

export function migratePool(input = {}) {
  return input && !Array.isArray(input) ? cloneValue(input) : {};
}
export function migrateIrrigation(input = {}) {
  return input && !Array.isArray(input) ? cloneValue(input) : {};
}
/* Un impianto in piu' non si perde per strada.
 *
 * Questa passata rimetteva in piedi l'oggetto dell'energia da zero, tenendo
 * solo i quattro gruppi di sensori e i metadati: `plants`, `id` e `name` — che
 * sono gli impianti oltre al primo e il nome di quello che si sta guardando —
 * finivano nel cestino a ogni salvataggio. «Aggiungi impianto» scriveva e la
 * riga dopo non c'era piu' niente. Chi normalizza deve conoscere tutto quello
 * che la sezione sa portarsi dietro, altrimenti normalizzare vuol dire
 * dimenticare. */
export function migrateEnergy(input = {}) {
  const value = input && !Array.isArray(input) ? input : {};
  const uscita = {
    house: { ...(value.house || {}) },
    grid: { ...(value.grid || {}) },
    solar: { ...(value.solar || {}) },
    battery: { ...(value.battery || {}) },
    metadata: { ...(value.metadata || {}) },
  };
  const id = String(value.id ?? "").trim();
  if (id) uscita.id = id;
  const name = String(value.name ?? "").trim();
  if (name) uscita.name = name;
  if (Array.isArray(value.plants) && value.plants.length)
    uscita.plants = value.plants.map((impianto) =>
      impianto && typeof impianto === "object" && !Array.isArray(impianto) ? { ...impianto } : {},
    );
  return uscita;
}

export function normalizeEnergyLoads(input = []) {
  const used = new Set();
  return (Array.isArray(input) ? input : [])
    .filter(Boolean)
    .slice(0, 8)
    .map((item, index) => {
      const seed = slug(item.id || item.name) || `load-${index + 1}`;
      const base = String(item.id || `energy-load-${seed}`);
      let id = base;
      let collision = 2;
      while (used.has(id)) id = `${base}-${collision++}`;
      used.add(id);
      return {
        id,
        name: String(item.name || `Carico ${index + 1}`),
        icon: String(item.icon || "mdi:flash"),
        power_entity: String(item.power_entity || ""),
        energy_entity: String(item.energy_entity || ""),
        color: String(item.color || "#0ea5e9"),
        order: Number.isFinite(+item.order) ? +item.order : index,
      };
    })
    .sort((left, right) => left.order - right.order);
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
    robots: migrateRobots,
    energy: migrateEnergy,
    energyLoads: normalizeEnergyLoads,
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
  for (const [path, slot] of Object.entries(ENERGY_SLOT_MAP)) {
    const [group, key] = path.split(".");
    if (!sections.energy[group]?.[key] && overrides[slot])
      sections.energy[group][key] = overrides[slot];
  }
  const washer = Object.entries(overrides).filter(
    ([key, value]) => key.startsWith("dm.lavatrice_") && value,
  );
  const existingWasher = sections.appliances.find((item) => item.device_type === "lavatrice");
  if (existingWasher) {
    existingWasher.visual_type ||= "asset";
    existingWasher.visual_key ||= "lavatrice";
    if (!existingWasher.image && legacy.washerImage) existingWasher.image = legacy.washerImage;
  } else if (washer.length) {
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
        icon: /^mdi:/i.test(String(raw.icon || "")) ? raw.icon : "",
        report_icon: !/^mdi:/i.test(String(raw.icon || "")) ? raw.icon || "" : "",
        emoji_icon: !/^mdi:/i.test(String(raw.icon || "")) ? raw.icon || "" : "",
        image: raw.image || "",
        room_id: raw.room_id || "",
        room: raw.room || "",
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

function preserveEnergySemantics(energy) {
  if (!energy) return false;
  const previous = Number(energy.metadata?.semantics_version) || 0;
  let changed = false;

  // Compatibility aliases were required only when upgrading the old Energy
  // model to semantics v3. Never recreate them after that point: an empty
  // annual field is a valid, intentional user choice and must survive save,
  // reload, sync snapshots and subsequent migrations.
  if (previous < 3) {
    for (const group of ["house", "solar"]) {
      const model = (energy[group] ||= {});
      const total = String(model.total_energy || "").trim();
      const annual = String(model.annual_energy || "").trim();
      if (total && !annual) {
        model.annual_energy = total;
        changed = true;
      }
      if (annual && !total) {
        model.total_energy = annual;
        changed = true;
      }
    }
  }

  if (previous !== 4) changed = true;
  energy.metadata = { ...(energy.metadata || {}), semantics_version: 4 };
  return changed;
}

const LEGACY_FLOW_LOADS = Object.freeze([
  [
    "boiler",
    "Boiler",
    "mdi:water-boiler",
    "#ea580c",
    "dm.boiler_potenza_resistenza_boiler",
    "dm.energy_boiler_oggi",
  ],
  [
    "wb",
    "Wallbox",
    "mdi:car-electric",
    "#06b6d4",
    "dm.ev_potenza_wallbox",
    "dm.ev_energia_wallbox_oggi",
  ],
  [
    "clima",
    "Clima",
    "mdi:snowflake",
    "#0ea5e9",
    "dm.energy_potenza_condizionatori",
    "dm.energy_condizionatori_oggi",
  ],
  [
    "lav",
    "Lavanderia",
    "mdi:washing-machine",
    "#7c3aed",
    "dm.energy_potenza_lavanderia",
    "dm.energy_lavanderia_oggi",
  ],
  ["cuc", "Cucina", "mdi:stove", "#e11d48", "dm.energy_potenza_cucina", "dm.energy_cucina_oggi"],
]);

export function migrateLegacyEnergyLoads(energyLoads = [], overrides = {}, energy = {}) {
  if (Array.isArray(energyLoads) && energyLoads.length) return normalizeEnergyLoads(energyLoads);
  if (energy?.metadata?.energy_loads_migrated) return [];
  return normalizeEnergyLoads(
    LEGACY_FLOW_LOADS.flatMap(([id, name, icon, color, powerSlot, energySlot]) => {
      const power_entity = String(overrides[powerSlot] || "").trim();
      const energy_entity = String(overrides[energySlot] || "").trim();
      return power_entity || energy_entity
        ? [{ id: `energy-load-${id}`, name, icon, color, power_entity, energy_entity }]
        : [];
    }),
  );
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
  if (+state.schema_version >= 4 && preserveEnergySemantics(state.sections?.energy))
    changes.push("energy annual/lifetime semantics migrated");
  if (+state.schema_version >= 4) {
    const energy = (state.sections.energy ||= migrateEnergy());
    const loads = migrateLegacyEnergyLoads(
      state.sections.energyLoads,
      { ...(state.sections.entityOverrides || {}), ...(legacy.entityOverrides || {}) },
      energy,
    );
    if (!energy.metadata?.energy_loads_migrated) {
      state.sections.energyLoads = loads;
      energy.metadata = { ...(energy.metadata || {}), energy_loads_migrated: true };
      changes.push(`legacy energy flow loads migrated (${loads.length})`);
    } else state.sections.energyLoads = normalizeEnergyLoads(state.sections.energyLoads);
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
  // Consolidate the two historical secondary-consumption stores once. The
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
          room_id: item.room_id || "",
          room: item.room || "",
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
