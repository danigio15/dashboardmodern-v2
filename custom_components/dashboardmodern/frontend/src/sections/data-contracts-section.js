import {
  allStates,
  clean,
  dashboardStore,
  doc,
  readJson,
  root,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_DATA_CONTRACTS_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  applying: false,
  timer: 0,
  storeUnsubscribe: null,
});

const CONTROL_DOMAIN = /^(?:switch|light|fan|input_boolean)\./i;
const POWER_NAME = /(?:^|[._-])(?:power|potenza|watt|assorbimento)(?:$|[._-])/i;
const ENERGY_NAME = /(?:energy|energia|consum|kwh)/i;
const DAILY_NAME = /(?:daily|giorno|today|oggi)/i;
const MONTHLY_NAME = /(?:monthly|mese|month)/i;
const TOTAL_NAME = /(?:total|totale|lifetime|meter|contatore)/i;
const GENERATED_ROOM_NAME = /^room[_-][a-z0-9]{8,}$/i;
const GENERIC_TOKENS = new Set([
  "appl",
  "appliance",
  "device",
  "dispositivo",
  "generic",
  "generico",
  "load",
  "carico",
]);

/* Il valore rimasto addosso a una luce: e' un nome o un identificativo?
 *
 * «Quando elimini alcune stanze ricompaiono con un nome sempre piu' lungo»:
 * room-room-room-room-terrazzo. Il giro era questo. L'assegnazione di una luce
 * porta l'IDENTIFICATIVO della stanza — `room-terrazzo` — non il suo nome.
 * Cancellata la stanza, quell'identificativo non si risolve piu', e chi
 * riadottava la stanza lo prendeva per un nome: ne faceva un identificativo
 * nuovo mettendogli davanti un altro `room-`, e il nome della stanza diventava
 * `room-terrazzo`. Cancella di nuovo, e il prefisso si somma. Ogni giro una
 * parola in piu', per sempre.
 *
 * Adesso si guarda cosa si ha in mano. Se e' gia' un identificativo di quelli
 * che genera questa plancia, la stanza rinasce con QUELLO — cosi' le luci che
 * la nominano restano attaccate — e il nome si ricava togliendo il prefisso,
 * che e' l'unico pezzo che non e' mai stato scritto da una persona. Se e' un
 * nome vero, si comporta come prima.
 */
export function stanzaAdottata(raw, progressivo) {
  const testo = clean(raw);
  if (!testo) return { id: "", name: "" };
  const gia = /^room-(.+)$/i.exec(testo);
  if (gia) {
    /* Il nome leggibile da un identificativo: i trattini tornano spazi e la
     * prima lettera si alza. «room-bagno-grande» diventa «Bagno grande». */
    const parole = gia[1].replace(/[-_]+/g, " ").trim();
    const nome = parole ? parole.charAt(0).toUpperCase() + parole.slice(1) : testo;
    return { id: testo, name: nome };
  }
  return { id: `room-${slug(testo) || progressivo}`, name: testo };
}

function entityId(entry) {
  return clean(typeof entry === "string" ? entry : entry?.entity || entry?.entity_id);
}

function uniqueEntities(device = {}) {
  return [
    ...new Set(
      [
        device.control_entity,
        device.state_entity,
        device.status_entity,
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

export function isGeneratedRoomName(value) {
  return GENERATED_ROOM_NAME.test(clean(value));
}

function stateData(states, entity) {
  return states?.[entity]?.attributes || {};
}

function unitFrom(states, entity) {
  return clean(stateData(states, entity).unit_of_measurement).toLowerCase();
}

export function inferApplianceEntity(device = {}, states = allStates(), kind = "energy") {
  const entities = uniqueEntities(device);
  if (kind === "control") return entities.find((entity) => CONTROL_DOMAIN.test(entity)) || "";
  if (kind === "power") {
    return (
      clean(device.power_entity) ||
      entities.find((entity) => {
        const attributes = stateData(states, entity);
        return (
          clean(attributes.device_class).toLowerCase() === "power" ||
          /^(?:w|kw|mw)$/.test(unitFrom(states, entity)) ||
          POWER_NAME.test(entity)
        );
      }) ||
      ""
    );
  }
  return (
    clean(device.total_energy_entity) ||
    clean(device.energy_entity) ||
    clean(device.monthly_energy_entity) ||
    clean(device.daily_energy_entity) ||
    entities.find((entity) => {
      const attributes = stateData(states, entity);
      return (
        clean(attributes.device_class).toLowerCase() === "energy" ||
        /^(?:wh|kwh|mwh)$/.test(unitFrom(states, entity)) ||
        ENERGY_NAME.test(entity)
      );
    }) ||
    ""
  );
}

function slug(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function deviceTokens(device = {}) {
  return [
    device.name,
    clean(device.id).replace(/^(?:appl|load|device)-/i, ""),
    device.device_type,
    device.visual_key,
  ]
    .flatMap((value) => slug(value).split("-"))
    .filter(
      (value, index, values) =>
        value.length >= 3 && !GENERIC_TOKENS.has(value) && values.indexOf(value) === index,
    );
}

function belongsToDevice(entity, tokens) {
  const objectId = slug(clean(entity).split(".").pop());
  return tokens.some(
    (token) =>
      objectId === token ||
      objectId.startsWith(`${token}-`) ||
      objectId.endsWith(`-${token}`) ||
      objectId.includes(`-${token}-`),
  );
}

function stateAttributes(entity) {
  return allStates()[entity]?.attributes || {};
}

function stateUnit(entity) {
  return clean(stateAttributes(entity).unit_of_measurement).toLowerCase();
}

function isPowerEntity(entity) {
  const attributes = stateAttributes(entity);
  return (
    clean(attributes.device_class).toLowerCase() === "power" ||
    /^(?:w|kw|mw)$/.test(stateUnit(entity)) ||
    POWER_NAME.test(entity)
  );
}

function isEnergyEntity(entity) {
  const attributes = stateAttributes(entity);
  return (
    clean(attributes.device_class).toLowerCase() === "energy" ||
    /^(?:wh|kwh|mwh)$/.test(stateUnit(entity)) ||
    ENERGY_NAME.test(entity)
  );
}

export function isLifetimeEnergyEntity(entity) {
  const id = clean(entity);
  if (!id) return false;
  const attributes = stateAttributes(id);
  const stateClass = clean(attributes.state_class).toLowerCase();
  if (stateClass === "total" || stateClass === "total_increasing") return true;
  return TOTAL_NAME.test(`${id} ${clean(attributes.friendly_name)}`);
}

function candidateEntities(device = {}) {
  const explicit = uniqueEntities(device);
  const tokens = deviceTokens(device);
  if (!tokens.length) return explicit;
  const recovered = Object.keys(allStates()).filter((entity) => belongsToDevice(entity, tokens));
  return [...new Set([...explicit, ...recovered])];
}

function inferApplianceContract(device = {}) {
  const entities = candidateEntities(device);
  const sensors = entities.filter((id) => /^sensor\./i.test(id));
  const energySensors = sensors.filter(isEnergyEntity);
  const find = (pattern, values = sensors) => values.find((id) => pattern.test(id)) || "";
  const control = clean(device.control_entity) || find(CONTROL_DOMAIN, entities);
  const power = clean(device.power_entity) || sensors.find(isPowerEntity) || find(POWER_NAME);
  const daily = clean(device.daily_energy_entity) || find(DAILY_NAME, energySensors);
  const monthly = clean(device.monthly_energy_entity) || find(MONTHLY_NAME, energySensors);
  const energy =
    clean(device.energy_entity) ||
    energySensors.find(
      (id) => !DAILY_NAME.test(id) && !MONTHLY_NAME.test(id) && !TOTAL_NAME.test(id),
    ) ||
    energySensors[0] ||
    "";

  const explicitTotal = clean(device.total_energy_entity);
  const namedTotal = find(TOTAL_NAME, energySensors);
  const total =
    (isLifetimeEnergyEntity(explicitTotal) && explicitTotal) ||
    (isLifetimeEnergyEntity(namedTotal) && namedTotal) ||
    "";
  const explicitHistory = clean(device.history_entity);
  const explicitReport = clean(device.report_entity);
  // History is lifetime-only. Report, instead, may intentionally use a monthly
  // measurement for the current period; canonicalReportDevices keeps that
  // current-period entity separate from its cumulative history source.
  const history = isLifetimeEnergyEntity(explicitHistory) ? explicitHistory : total;
  const report = explicitReport || monthly || energy || total;

  const nextEntities = [
    ...new Set(
      [control, power, energy, daily, monthly, total, history, report, ...entities].filter(Boolean),
    ),
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

function canonicalRoomForLight(entity, name, rooms) {
  const entityToken = slug(clean(entity).split(".").pop());
  const nameToken = slug(name);
  return (
    rooms.find((room) => {
      const roomName = slug(room.name);
      const roomId = slug(room.id).replace(/^room-/, "");
      return (
        [entityToken, nameToken].filter(Boolean).includes(roomName) ||
        [entityToken, nameToken].filter(Boolean).includes(roomId)
      );
    }) || null
  );
}

function normalizeLegacyLightRooms() {
  const rooms = dashboardStore()?.getSection?.("rooms") || [];
  if (!rooms.length) return false;
  const lights = readJson("cd_luci", {});
  const assignments = readJson("cd_luci_rooms", {});
  const adopted = new Map();
  let changed = false;
  for (const [entity, name] of Object.entries(lights)) {
    const raw = clean(assignments[entity]);
    if (rooms.some((room) => clean(room.id) === raw || clean(room.name) === raw)) continue;
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
      continue;
    }
    /* Una stanza che c'e' solo sulle luci non e' una stanza fantasma: e' una
     * stanza che manca all'elenco.
     *
     * L'importazione dalle aree di Home Assistant assegna a ogni luce il nome
     * della sua area e, separatamente, aggiunge quelle aree all'elenco delle
     * stanze. Le due scritture non hanno lo stesso proprietario: l'elenco viene
     * riscritto dal deposito a ogni salvataggio, l'assegnazione delle luci no.
     * Bastava un salvataggio perche' l'elenco perdesse le aree e le luci
     * restassero a puntare a nomi che nella sezione Stanze non c'erano piu'.
     * Il nome viene adottato: era una stanza vera, torna nell'elenco. */
    if (!resolved && raw) adopted.set(raw, (adopted.get(raw) || []).concat(entity));
  }
  
  if (adopted.size) {
    const next = rooms.slice();
    for (const [raw, entities] of adopted) {
      const { id, name } = stanzaAdottata(raw, next.length + 1);
      if (!id) continue;
      if (next.some((room) => clean(room.id) === id)) continue;
      next.push({ id, name, icon: "🏠" });
      for (const entity of entities) assignments[entity] = id;
      changed = true;
    }
    if (changed) dashboardStore()?.replaceSection?.("rooms", next);
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
    return [
      await normalizeDeviceSection("appliances"),
      await normalizeDeviceSection("loads"),
      normalizeLegacyLightRooms(),
    ].some(Boolean);
  } finally {
    state.applying = false;
  }
}

function schedule(delay = 0) {
  if (!doc || state.timer) return;
  state.timer = root.setTimeout?.(async () => {
    state.timer = 0;
    subscribeStore();
    await applyDataContracts();
  }, Math.max(0, Number(delay) || 0));
}

function subscribeStore() {
  if (!doc) return;
  const store = dashboardStore();
  if (state.storeUnsubscribe || !store?.subscribe) return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (["rooms", "appliances", "loads"].includes(change.section)) schedule(0);
  });
}

export function installDataContractsSection() {
  if (!doc) return false;
  subscribeStore();
  schedule(0);
  if (!state.installed) {
    state.installed = true;
    for (const event of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:states-ready",
      "pageshow",
    ]) {
      root.addEventListener?.(event, () => {
        subscribeStore();
        schedule(0);
      });
    }
  }
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installDataContractsSection, { once: true });
else if (doc) installDataContractsSection();
