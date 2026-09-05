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

/* La pompa di calore raffresca e riscalda (#195): e' un terzo tipo canonico,
 * non un condizionatore con un'opzione, perche' i due elenchi — Freddo e Caldo
 * — si dividono le unita' proprio in base a questo valore. */
export const CLIMATE_PUMP_TOKENS = Object.freeze([
  "pompa",
  "pompa_di_calore",
  "heat_pump",
  "heatpump",
  "heat_cool",
  "both",
  "entrambi",
  "dual",
]);

export function canonicalClimateType(value) {
  const token = String(value ?? "")
    .trim()
    .toLowerCase();
  if (CLIMATE_HEAT_TOKENS.includes(token)) return "termo";
  if (CLIMATE_PUMP_TOKENS.includes(token)) return "pompa";
  return "clima";
}

/**
 * Canonical appliance catalog.
 *
 * The keys intentionally match the original blue-icon appliance picker used by
 * the Add flow. Edit, rendering and migration must consume this same catalog so
 * a device can never silently fall back to `generico` just because a second
 * editor happened to know fewer appliance types.
 */
import { pick } from "./i18n.js";
import { LOAD_PLANT_FIELD } from "./energy-plants.js";
import { contactEntity, inferriataEntity } from "./shutter-window.js";
import {
  COVER_SLOTS,
  coverClosedThreshold,
  coverDownRelay,
  coverPresetPosition,
  declaredCoverKind,
} from "./cover-kind.js";

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
  /* Il boiler d'accumulo NON e' lo scaldabagno a muro: e' il cilindrone a
   * pavimento del solare termico, e mancava proprio come voce. La chiave e'
   * «accumulo» perche' «boiler» da sola e' da sempre l'alias dello
   * scaldabagno; l'etichetta dice Boiler, come lo chiama chi ce l'ha. */
  { key: "accumulo", it: "Boiler", en: "Storage boiler" },
  { key: "tv", it: "TV", en: "TV" },
  { key: "caffe", it: "Caffettiera", en: "Coffee maker" },
  { key: "tostapane", it: "Tostapane", en: "Toaster" },
  { key: "bollitore", it: "Bollitore", en: "Kettle" },
  { key: "friggitrice", it: "Friggitrice ad aria", en: "Air fryer" },
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

/**
 * Il disegno di un elettrodomestico, deciso una volta sola.
 *
 * La stessa domanda se la facevano in due modi diversi: la scheda guardava
 * `visual_key`, `device_type`, `icon`, `type` e — per i record vecchi salvati
 * come «generico» — anche il nome; la tessera della Home chiedeva al runtime
 * storico, che conosce un elenco piu' corto e risponde «generico» per tutto il
 * resto. Cosi' lo stesso apparecchio aveva l'obló nella sua pagina e una
 * bolla anonima in Home. La domanda adesso e' una.
 *
 * @param {object} device l'elettrodomestico configurato
 * @returns {string} la chiave del disegno, mai vuota
 */
export function applianceVisualKey(device = {}) {
  const dichiarati = [device?.visual_key, device?.device_type, device?.icon, device?.type]
    .map((value) => canonicalApplianceVisualKey(value) || "")
    .filter(Boolean);
  const preciso = dichiarati.find((key) => key !== "generico");
  if (preciso) return preciso;
  const dalNome = canonicalApplianceVisualKey(device?.name) || "";
  return dalNome || dichiarati[0] || "generico";
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
  return pick(item?.it, item?.en, locale) || item?.it || key;
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

/* Il dispositivo di Home Assistant da cui l'apparecchio arriva.
 *
 * Una lavatrice di hOn, un forno di Home Connect: non un interruttore ma un
 * dispositivo intero, con l'integrazione che lo porta e le sue venti entita'.
 * Questi campi sono la memoria di quel collegamento: da quale integrazione,
 * quale dispositivo, come si chiama e chi lo fa. Passano di qui o spariscono
 * alla prima normalizzazione, com'e' gia' successo quattro volte ad altri.
 * `device_entities` e' l'elenco delle sue entita' al momento del collegamento,
 * per la finestra del dettaglio quando il catalogo non e' ancora arrivato. */
export const APPLIANCE_BINDING_FIELDS = Object.freeze([
  "device_id",
  "integration",
  "integration_name",
  "device_name",
  "device_manufacturer",
  "device_model",
]);

/* Un'entita' configurata non si perde mai.
 *
 * Il modello tiene solo i campi che conosce, e per la forma va bene: e' quello
 * che impedisce a una configurazione scritta a mano di portarsi dietro
 * spazzatura. Ma un campo nuovo che nessuno ha dichiarato qui sparisce alla
 * prima normalizzazione, e in questo file c'e' scritto quante volte e'
 * successo: il contatto dell'infisso, il tipo di copertura, l'inferriata, il
 * rele' di discesa della seconda tenda, l'indirizzo RTSP, l'impianto del
 * carico. Sei volte lo stesso difetto, sei righe aggiunte dopo la
 * segnalazione — e ogni volta qualcuno, in casa sua, aveva perso quello che
 * aveva configurato.
 *
 * La regola cambia qui: la forma resta un elenco chiuso, ma un valore che e'
 * un'entita' di Home Assistant si tiene comunque, anche se il suo campo non lo
 * conosce nessuno. Cosi' una casella nuova sopravvive all'aggiornamento che la
 * introduce, e una vecchia sopravvive a quello che la dimentica: chi disegna
 * la ignorera' finche' non la sapra' leggere, ma non la butta via.
 *
 * Un'entita' si riconosce dalla sua forma: `dominio.oggetto`, tutto minuscolo,
 * senza spazi ne' barre — e non un nome di file, che quella forma ce l'ha
 * anche lui.
 *
 * Restano fuori i campi su cui il modello ha gia' un'opinione: il rele' di
 * discesa di una tapparella vera non e' un rele' e non si tiene, e il contatto
 * dell'infisso su un elettrodomestico non e' di casa sua. Quelle sono scelte,
 * non dimenticanze, e vanno rispettate. Ma sono elencate qui una per una, e
 * dimenticarne una in questo elenco non fa perdere niente a nessuno: fa
 * sopravvivere un campo che il modello avrebbe scartato. L'errore, adesso, sta
 * dalla parte giusta.
 */
/* «Il modello ha un'opinione su questo campo, in questa sezione.»
 *
 * Ogni voce dice DOVE l'opinione vale, e non e' un dettaglio: `kind`, `state`,
 * `url`, `soglia` sono parole comuni. Tenendole in un elenco unico per tutte le
 * sezioni, un campo che un giorno si chiamasse `soglia` su un elettrodomestico
 * sparirebbe per colpa di una regola scritta per le tapparelle — cioe' si
 * riaprirebbe, per la porta di servizio, esattamente il difetto che questo
 * meccanismo esiste per chiudere. `true` vuol dire «dappertutto». */
const CAMPI_DECISI = new Map([
  /* Le coperture: le decide il ramo `covers`, slot per slot. */
  ["contact", ["covers"]],
  ["contact_entity", ["covers"]],
  ["inferriata", ["covers"]],
  ["kind", ["covers"]],
  ["preset", ["covers"]],
  ["soglia", ["covers"]],
  ...COVER_SLOTS.flatMap(({ campo, giu }) =>
    [campo, giu].filter(Boolean).map((nome) => [nome, ["covers"]]),
  ),
  /* Le telecamere. */
  ["rtsp", ["cameras"]],
  /* Il flusso lo legge il ramo comune, per ogni sezione. */
  ["stream", true],
  ["stream_url", true],
  ["url", true],
  /* Il clima. */
  ["valvola", ["climate"]],
  /* E i nomi vecchi delle caselle di sempre.
   *
   * Il modello li legge e li versa nel nome canonico: `power` diventa
   * `power_entity`, `switch` diventa `control_entity`. Se li tenessimo anche
   * com'erano, una casella svuotata apposta risorgerebbe dal suo alias al giro
   * dopo — e' quello che era gia' successo alle foto delle auto, «si mescolano
   * da sole», per giorni. Il nome canonico c'e' sempre: questi hanno finito il
   * loro lavoro nel momento in cui sono stati letti. Valgono dove il ramo che
   * li versa gira davvero: gli apparecchi e i carichi. */
  ...[
    "power",
    "energy",
    "daily_energy",
    "energy_today",
    "monthly_energy",
    "total_energy",
    "history",
    "switch",
    "switch_entity",
    "light",
    "state",
    "temp_entity",
    "temp_entity_2",
    "remaining_time_entity",
    "problem_entity",
    "start_time_entity",
  ].map((nome) => [nome, ["appliances", "loads"]]),
  /* La foto dell'auto: il ramo `ev` la versa in `image` e `image_url`. */
  ["img", ["ev"]],
]);

function ilModelloDecide(campo, sezione) {
  const dove = CAMPI_DECISI.get(campo);
  if (!dove) return false;
  return dove === true || dove.includes(sezione);
}

const NOME_DI_FILE =
  /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|mp4|webm|json|ya?ml|txt|html?|css|js)$/i;

export function sembraUnEntita(valore) {
  const testo = String(valore ?? "").trim();
  if (!testo || testo.length > 255) return false;
  if (/[\s/\\:?#]/.test(testo)) return false;
  if (NOME_DI_FILE.test(testo)) return false;
  return /^[a-z][a-z0-9_]*\.[a-z0-9_]+$/.test(testo);
}

/* Un valore che vale la pena tenere.
 *
 * Un testo, un numero, un si'/no, un elenco, un oggetto: le forme in cui una
 * configurazione si scrive. Fuori restano il vuoto — che non e' una
 * configurazione, e' l'assenza di una — e le cose che in un salvataggio non ci
 * possono nemmeno arrivare (funzioni, `NaN`, `undefined`). */
function valoreDaTenere(valore) {
  if (typeof valore === "string") return valore.trim() ? valore.trim() : undefined;
  if (typeof valore === "number") return Number.isFinite(valore) ? valore : undefined;
  if (typeof valore === "boolean") return valore;
  if (Array.isArray(valore)) return valore.length ? cloneValue(valore) : undefined;
  if (valore && typeof valore === "object" && Object.keys(valore).length)
    return cloneValue(valore);
  return undefined;
}

/**
 * Rimette quello che la normalizzazione non conosceva.
 *
 * Prima passava di qui solo cio' che sembrava un'entita' di Home Assistant, e
 * quella meta' bastava per le sei segnalazioni che avevano fatto scrivere
 * questa regola. Non bastava per l'altra meta': la soglia di chiusura di UNA
 * finestra (#298) e' un numero, non un'entita', e spariva alla prima
 * normalizzazione esattamente come sparivano i contatti prima di lei. Un
 * numero configurato e' configurazione quanto un'entita'.
 *
 * Adesso passa tutto quello su cui il modello non ha un'opinione. Le opinioni
 * sono scritte in `CAMPI_DECISI` — il rele' di discesa di una tapparella vera
 * non e' un rele', il contatto dell'infisso su un elettrodomestico non e' di
 * casa sua, un alias che il modello ha gia' versato nel nome nuovo ha finito
 * il suo lavoro — e restano fuori. Tutto il resto e' roba di chi configura, e
 * non e' compito nostro decidere che non gli serve piu'.
 *
 * Tocca solo i campi che non ci sono gia': quello che il modello sa dire lo
 * dice lui, e un campo svuotato apposta resta svuotato.
 */
export function conservaIlConfigurato(uscita = {}, ingresso = {}, sezione = "") {
  if (!ingresso || typeof ingresso !== "object" || Array.isArray(ingresso)) return uscita;
  for (const [campo, valore] of Object.entries(ingresso)) {
    if (campo in uscita || ilModelloDecide(campo, sezione)) continue;
    const tenuto = valoreDaTenere(valore);
    if (tenuto !== undefined) uscita[campo] = tenuto;
  }
  return uscita;
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
  return derived || pick("Dispositivo", "Device", locale);
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
  /* Quando l'id cambia, il nome scritto accanto non puo' restare quello di
   * prima.
   *
   * Un dispositivo migrato porta tutti e due: l'id e il nome della stanza.
   * Spostandolo da un editor moderno cambiava solo l'id, e il salvataggio
   * fonde la modifica con l'oggetto vecchio: restava scritto il nome della
   * stanza da cui era appena uscito, e mezza dozzina di sezioni che leggono
   * `item.room` continuavano a mostrarlo di la'. Se l'id dice una stanza, il
   * nome accanto dice la stessa: quello della stanza trovata, e se quella
   * stanza non e' in elenco non dice piu' niente. */
  const stanzaDellId = context.rooms?.find((room) => room.id === roomId || room.name === roomId);
  const riferimentoLegacy =
    roomId &&
    stanzaDellId &&
    stanzaDellId.name !== legacyRoomRef &&
    stanzaDellId.id !== legacyRoomRef
      ? stanzaDellId.name
      : roomId && !stanzaDellId && explicitRoomId && explicitRoomId !== legacyRoomRef
        ? ""
        : legacyRoomRef;
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
    /* Quello che l'utente ha scritto, non quello a cui siamo riusciti a
     * risolverlo.
     *
     * `room_id` viene dall'id della stanza trovata, e una stanza senza id — una
     * configurazione scritta a mano, o un salvataggio piu' vecchio dell'id —
     * lasciava `room_id` vuoto: l'assegnazione spariva senza che nessuno lo
     * dicesse, e il dispositivo finiva senza stanza pur avendone una scritta
     * accanto. Mezza dozzina di sezioni infatti leggono gia' `item.room ||
     * item.room_id`, aspettandosi che il riferimento originale ci sia ancora.
     * Adesso c'e'. Non sostituisce l'id: gli sta accanto, e serve solo a chi
     * l'id non lo trova. */
    room: String(riferimentoLegacy || ""),
    entities,
    enabled: input.enabled !== false,
    order: Number.isFinite(+input.order) ? +input.order : context.index || 0,
    metadata: { ...(input.metadata || {}) },
  };
  if (input.entity || entities[0]) base.entity = String(input.entity || entities[0]);
  if (section === "climate") {
    base.type = canonicalClimateType(input.type);
    /* La valvola termostatica (#300): l'entita' con la posizione, scelta da
     * chi configura. Vale la riga qui sotto sul contatto dell'infisso. */
    if (input.valvola) base.valvola = String(input.valvola);
  }
  if (input.stream || input.stream_url || input.url)
    base.stream = String(input.stream || input.stream_url || input.url);
  /* L'indirizzo RTSP della telecamera (#284).
   *
   * Vale la riga qui sotto sul contatto dell'infisso, ed e' la quarta volta:
   * un campo non dichiarato qui sparisce alla prima normalizzazione. Non e'
   * `stream`, che e' il nome del flusso dentro go2rtc: e' l'indirizzo della
   * telecamera, quello che si legge sul suo pannello, e i due si somigliano
   * abbastanza da confonderli se stessero nella stessa casella. */
  if (section === "cameras") {
    const rtsp = String(input.rtsp || "").trim();
    if (rtsp) base.rtsp = rtsp;
    /* «Dal vivo»: la tessera del muro chiede il flusso continuo invece di un
     * fotogramma ogni quattro secondi. Spento non e' «campo assente» — una
     * telecamera che era dal vivo e non lo e' piu' deve restare spenta anche
     * dopo un ricarico — quindi qui passa anche il falso, purche' la scelta
     * sia stata fatta. */
    if (input.vivo !== undefined && input.vivo !== null && input.vivo !== "")
      base.vivo =
        input.vivo === true || input.vivo === "true" || input.vivo === 1 || input.vivo === "1";
  }
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
    /* L'inferriata (#254, #297): il secondo contatto, quello di fuori.
     *
     * Ed e' la quinta volta che questa riga manca. La scheda la salvava, il
     * modello la buttava alla prima normalizzazione, e da li' in poi la riga
     * non l'aveva piu': «nella configurazione mi permette di inserire le due
     * entita', se vado poi in modifica vedo solamente l'infisso, e
     * nell'animazione vedo solo quando chiudo la finestra». Tutti e due i
     * sintomi sono lo stesso campo perso nello stesso punto. */
    const inferriata = inferriataEntity(input);
    if (inferriata) base.inferriata = inferriata;
    // Tapparella o tenda: senza dichiararlo qui il tipo scelto sparirebbe alla
    // prima normalizzazione, come era gia' successo al contatto dell'infisso.
    const kind = declaredCoverKind(input);
    if (kind) base.kind = kind;
    /* Le altre coperture dello stesso infisso. Vale la riga qui sopra: un
     * campo non dichiarato qui sparisce alla prima normalizzazione, e sarebbe
     * la terza volta — prima il contatto, poi il tipo, adesso queste. Si
     * leggono da `COVER_SLOTS`, che e' l'unico posto dove sta scritto quali
     * caselle esistono: se un giorno se ne aggiunge una, arriva anche qui. */
    for (const { campo, giu } of COVER_SLOTS) {
      if (campo !== "entity") {
        const entity = String(input?.[campo] ?? "").trim();
        if (entity) base[campo] = entity;
      }
      /* E il rele' di discesa di ognuna. Era dichiarato solo per la prima
       * casella: una tenda su due rele' salvava il comando di salita e
       * perdeva quello di discesa alla prima normalizzazione — che e'
       * esattamente il difetto di cui parla il commento qui sopra, ripetuto
       * su un campo nuovo. */
      if (!giu || giu === "down") continue;
      const discesa = String(input?.[giu] ?? "").trim();
      if (discesa) base[giu] = discesa;
    }
    // La posizione preferita (#200): stessa regola dei campi qui sopra.
    const preset = coverPresetPosition(input);
    if (preset != null) base.preset = preset;
    // Il rele' di discesa (#194): idem, e vale solo se il primo comando e'
    // anche lui un rele' — su una copertura vera non avrebbe senso.
    const down = coverDownRelay(input);
    if (down) base.down = down;
    /* La soglia di chiusura di QUESTA finestra (#298).
     *
     * «La percentuale di chiusura la devi spostare nella configurazione di
     * quella finestra: ognuno puo' avere una percentuale differente.» La
     * scheda la salvava e il modello la buttava via al primo giro — lo stesso
     * difetto del contatto e dell'inferriata, su un campo che pero' e' un
     * numero, e la rete di sicurezza di allora prendeva solo le entita'.
     * Vuoto vuol dire «quella di casa»; zero scritto apposta vale zero. */
    const sogliaScritta = input?.soglia;
    if (sogliaScritta !== null && sogliaScritta !== undefined && String(sogliaScritta).trim()) {
      const quota = Number(sogliaScritta);
      if (Number.isFinite(quota)) base.soglia = coverClosedThreshold(quota);
    }
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
    /* `img` e' la verita', e gli alias la seguono.
     *
     * Il profilo normalizzato porta anche `image` e `image_url`, e qui si
     * componeva `img || image || image_url`: una foto SVUOTATA apposta — il
     * campo c'e', vuoto — risorgeva dall'alias rimasto pieno al giro prima.
     * Ogni risalvataggio della sezione riportava cosi' la foto vecchia
     * sull'auto sbagliata, ed e' il "le foto si mescolano da sole" che e'
     * stato segnalato per giorni. Se `img` esiste comanda lei, anche vuota;
     * gli alias si riscrivono su di lei invece di farle da memoria ombra. */
    /* `img` e' autoritativa solo se esiste: una riga legacy senza `img`, con
     * `image` vuota e `image_url` piena, deve ancora pescare dall'alias — la
     * catena ?? si sarebbe fermata sulla stringa vuota e avrebbe scartato
     * l'unica foto rimasta. */
    const evImage =
      input.img !== undefined && input.img !== null
        ? String(input.img)
        : String(input.image || input.image_url || "");
    return {
      ...legacy,
      ...base,
      name: base.name || String(input.name || "").trim(),
      icon: base.icon || String(input.icon || ""),
      image: evImage,
      image_url: evImage,
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
      /* Il tasto acceso/spento della card si puo' togliere per apparecchio:
       * «aggiungere la possibilita' di disabilitare lo switch on/off» — c'e'
       * chi mappa l'interruttore per leggere lo stato ma non vuole che il
       * frigo si spenga da una card. Il campo passa di qui o sparisce alla
       * prima normalizzazione, come e' gia' successo tre volte. */
      switch_disabled: input.switch_disabled === true,
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
      /* Un frigorifero smart ne pubblica cinque, di temperature: ambiente,
       * obiettivo e attuale del frigo, obiettivo e attuale del congelatore.
       * Due sono quelle che si guardano, e con una casella sola se ne poteva
       * dire una. */
      temperature_entity_2: input.temperature_entity_2 || input.temp_entity_2 || "",
      alert_entity: input.alert_entity || input.problem_entity || "",
      last_start_entity: input.last_start_entity || input.start_time_entity || "",
      last_duration_entity: input.last_duration_entity || "",
      last_energy_entity: input.last_energy_entity || "",
      last_cost_entity: input.last_cost_entity || "",
    });
    /* Di quale impianto e' questo carico.
     *
     * Il modello tiene solo i campi che conosce — e' quello che impedisce a una
     * configurazione scritta a mano di portarsi dietro spazzatura — quindi un
     * campo nuovo che non passa di qui sparisce alla prima normalizzazione. E'
     * gia' successo tre volte alle tapparelle; qui sarebbe successo ai carichi
     * della seconda casa, che sarebbero tornati tutti nella prima.
     *
     * Vuoto vuol dire il primo impianto, ed e' apposta: e' cosi' che otto
     * carichi gia' configurati restano dove sono, il giorno in cui questo campo
     * compare. */
    const impianto = String(input[LOAD_PLANT_FIELD] ?? "").trim();
    if (impianto) base[LOAD_PLANT_FIELD] = impianto;
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
    assignFiniteNumber(base, "off_delay_minutes", input.off_delay_minutes);
    assignFiniteNumber(base, "temp_min", input.temp_min);
    assignFiniteNumber(base, "temp_max", input.temp_max);
    assignFiniteNumber(base, "max_power", input.max_power);
    assignFiniteNumber(base, "price_kwh", input.price_kwh);
    /* Il collegamento all'integrazione: vale la riga di sopra sull'impianto,
     * un campo che non passa di qui non sopravvive al primo salvataggio. */
    for (const key of APPLIANCE_BINDING_FIELDS) {
      const value = String(input[key] ?? "").trim();
      if (value) base[key] = value;
    }
    const deviceEntityIds = [
      ...new Set(
        (Array.isArray(input.device_entities) ? input.device_entities : [])
          .map((value) => String(typeof value === "string" ? value : value?.entity_id || "").trim())
          .filter((value) => value.includes(".")),
      ),
    ];
    if (deviceEntityIds.length) base.device_entities = deviceEntityIds;
  }
  return conservaIlConfigurato(base, input, section);
}
