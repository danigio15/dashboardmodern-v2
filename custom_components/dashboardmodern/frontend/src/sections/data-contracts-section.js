import {
  clean,
  dashboardStore,
  readJson,
  root,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_DATA_CONTRACTS_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  applying: false,
  timer: 0,
  attempts: 0,
  storeUnsubscribe: null,
});

const CONTROL_DOMAIN = /^(?:switch|light|fan|input_boolean)\./i;
const POWER_NAME = /(?:^|[._-])(?:power|potenza|watt)(?:$|[._-])/i;
const ENERGY_NAME = /(?:energy|energia|consum|kwh)/i;
const DAILY_NAME = /(?:daily|giorno|today|oggi)/i;
const MONTHLY_NAME = /(?:monthly|mese|month)/i;
const TOTAL_NAME = /(?:total|totale|lifetime|meter|contatore)/i;

function entityId(entry) {
  return clean(typeof entry === "string" ? entry : entry?.entity || entry?.entity_id);
}

function uniqueEntities(device = {}) {
  return [
    ...new Set(
      [
        device.control_entity,
        device.state_entity,
        device.power_entity,
        device.energy_entity,
        device.daily_energy_entity,
        device.monthly_energy_entity,
        device.total_energy_entity,
        device.history_entity,
        device.report_entity,
        device.entity,
        ...(device.entities || []),
      ]
        .map(entityId)
        .filter(Boolean),
    ),
  ];
}

function inferApplianceContract(device = {}) {
  const entities = uniqueEntities(device);
  const sensors = entities.filter((id) => /^sensor\./i.test(id));
  const find = (pattern, values = sensors) => values.find((id) => pattern.test(id)) || "";
  const control = clean(device.control_entity) || find(CONTROL_DOMAIN, entities);
  const power = clean(device.power_entity) || find(POWER_NAME);
  const daily = clean(device.daily_energy_entity) || find(DAILY_NAME);
  const monthly = clean(device.monthly_energy_entity) || find(MONTHLY_NAME);
  const namedTotal = find(TOTAL_NAME);
  const energy =
    clean(device.energy_entity) ||
    find(ENERGY_NAME) ||
    namedTotal ||
    monthly ||
    daily;
  const total = clean(device.total_energy_entity) || namedTotal || energy;
  const history = clean(device.history_entity) || total || monthly || energy;
  const report = clean(device.report_entity) || history || monthly || energy;
  const nextEntities = [
    ...new Set([control, power, energy, daily, monthly, total, history, report, ...entities].filter(Boolean)),
  ];
  return {
    ...device,
    entities: nextEntities,
    control_entity: control,
    power_entity: power,
    energy_entity: energy,
    daily_energy_entity: daily,
    monthly_energy_entity: monthly,
    total_energy_entity: total,
    history_entity: history,
    report_entity: report,
  };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function normalizeDeviceSection(section) {
  const store = dashboardStore();
  if (!store?.getSection || !store?.replaceSection) return false;
  const current = store.getSection(section);
  if (!Array.isArray(current) || !current.length) return false;
  const next = current.map(inferApplianceContract);
  if (same(current, next)) return false;
  await store.replaceSection(section, next);
  return true;
}

function slug(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function canonicalRoomForLight(entity, name, rooms) {
  const entityToken = slug(clean(entity).split(".").pop());
  const nameToken = slug(name);
  return (
    rooms.find((room) => {
      const roomName = slug(room.name);
      const roomId = slug(room.id).replace(/^room-/, "");
      return [entityToken, nameToken].filter(Boolean).includes(roomName) ||
        [entityToken, nameToken].filter(Boolean).includes(roomId);
    }) || null
  );
}

function normalizeLegacyLightRooms() {
  const rooms = dashboardStore()?.getSection?.("rooms") || [];
  if (!rooms.length) return false;
  const lights = readJson("cd_luci", {});
  const assignments = readJson("cd_luci_rooms", {});
  let changed = false;
  for (const [entity, name] of Object.entries(lights)) {
    const raw = clean(assignments[entity]);
    if (rooms.some((room) => clean(room.id) === raw)) continue;
    const inferred = canonicalRoomForLight(entity, name, rooms);
    const resolved =
      inferred ||
      rooms.find(
        (room) =>
          clean(room.name).toLowerCase() === raw.toLowerCase() ||
          slug(room.name) === slug(raw) ||
          slug(room.id).replace(/^room-/, "") === slug(raw).replace(/^room-/, ""),
      );
    if (resolved && assignments[entity] !== resolved.id) {
      assignments[entity] = resolved.id;
      changed = true;
    }
  }
  if (!changed) return false;
  writeJsonIfChanged("cd_luci_rooms", assignments, { sync: false });
  root.cdMarkDirty?.();
  root.cdSyncPush?.();
  return true;
}

export async function applyDataContracts() {
  if (state.applying) return false;
  const store = dashboardStore();
  if (!store) return false;
  state.applying = true;
  try {
    const changed = [
      await normalizeDeviceSection("appliances"),
      await normalizeDeviceSection("loads"),
      normalizeLegacyLightRooms(),
    ].some(Boolean);
    return changed;
  } finally {
    state.applying = false;
  }
}

function schedule(delay = 0) {
  if (state.timer) return;
  state.timer = root.setTimeout?.(async () => {
    state.timer = 0;
    state.attempts += 1;
    const ready = Boolean(dashboardStore());
    if (ready) await applyDataContracts();
    if (!ready && state.attempts < 120) schedule(25);
  }, delay);
}

function subscribeStore() {
  const store = dashboardStore();
  if (state.storeUnsubscribe || !store?.subscribe) return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (["rooms", "appliances", "loads"].includes(change.section)) schedule(0);
  });
}

export function installDataContractsSection() {
  schedule(0);
  subscribeStore();
  if (!state.installed) {
    state.installed = true;
    for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready", "pageshow"]) {
      root.addEventListener?.(event, () => {
        subscribeStore();
        schedule(0);
      });
    }
  }
}

installDataContractsSection();
