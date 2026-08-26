/* Chi abita la casa, e cosa se ne mostra.
 *
 * Home Assistant conosce gia' le persone: `person.*` dice in che zona si
 * trovano, da quanto tempo, e spesso porta con se' una foto e la batteria del
 * telefono. Qui si decide soltanto come quelle informazioni diventano una
 * card: quale immagine mostrare — foto vera, o avatar scelto a mano — che
 * etichetta dare alla zona, quale batteria leggere quando ce n'e' piu' d'una
 * possibile.
 *
 * Il modulo e' puro: niente DOM, niente localStorage, niente WebSocket. La
 * sezione legge e scrive, questo modulo mette solo in ordine.
 */

import { normalizeAvatar3d } from "./avatar-3d.js";

const clean = (value) => String(value ?? "").trim();

/* I colori tra cui si sceglie l'avatar. Sono coppie sfondo/inchiostro gia'
 * accordate col resto della plancia: un colore libero scritto a mano puo'
 * rendere le iniziali illeggibili, uno di questi no. */
export const AVATAR_COLORS = Object.freeze([
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#f59e0b",
  "#16a34a",
  "#14b8a6",
  "#64748b",
]);

export function slugifyPersonId(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* Le iniziali sono l'avatar che non si deve disegnare: due lettere del nome,
 * come le rubriche dei telefoni. Piu' di due diventano un timbro. */
export function personInitials(name = "") {
  const words = clean(name).split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const letters = words.slice(0, 2).map((word) => word[0].toUpperCase());
  return letters.join("");
}

/* ── Le facce disegnate a mano, tradotte ────────────────────────────────
 *
 * Fino alla 1.2 il ritratto era un disegno costruito tratto per tratto —
 * carnagione, taglio, barba, vestito — e c'e' chi la sua faccia se l'era
 * fatta. Adesso i ritratti sono render 3D, e i tratti non sono piu' gli
 * stessi: quelli che hanno un corrispondente si portano dietro, gli altri
 * cadono. Nessuno riapre la plancia e trova una persona senza faccia.
 */
const PELLE_VECCHIA = {
  f1: "chiara",
  f2: "chiara2",
  f3: "media",
  f4: "ambrata",
  f5: "scura",
  f6: "scura",
};
const CAPELLI_VECCHI = {
  rasato: "lisci",
  corto: "lisci",
  ciuffo: "lisci",
  spettinato: "lisci",
  riccio: "ricci",
  lungo: "lisci",
  caschetto: "lisci",
  chignon: "lisci",
  coda: "lisci",
  afro: "ricci",
  pettinato: "lisci",
  calvo: "calvo",
};
const VESTITI_VECCHI = {
  maglietta: "nessuno",
  polo: "nessuno",
  camicia: "ufficio",
  maglione: "nessuno",
  felpa: "nessuno",
  giacca: "smoking",
  gilet: "ufficio",
  canotta: "nessuno",
  tuta: "nessuno",
  abito: "velo",
  cardigan: "ufficio",
};

function migraFaccia(face) {
  if (!face || typeof face !== "object" || Array.isArray(face)) return face;
  if (!("skin" in face) && !("hair" in face)) return face;
  const barba = face.beard && face.beard !== "nessuna";
  const capelliBianchi = face.hairColor === "bianco" || face.hairColor === "grigio";
  return {
    persona: face.build === "magra" ? "donna" : "uomo",
    capelli: barba
      ? "barba"
      : capelliBianchi
        ? "bianchi"
        : face.hairColor === "rame"
          ? "rossi"
          : CAPELLI_VECCHI[face.hair] || "lisci",
    carnagione: PELLE_VECCHIA[face.skin] || "media",
    vestito: VESTITI_VECCHI[face.outfit] || "nessuno",
  };
}

function normalizeAvatar(avatar = {}, index = 0) {
  const color = clean(avatar?.color);
  return {
    emoji: clean(avatar?.emoji),
    color: AVATAR_COLORS.includes(color) ? color : AVATAR_COLORS[index % AVATAR_COLORS.length],
    /* Il ritratto costruito nell'editor, o `null` per chi non ne ha uno:
     * allora valgono l'emoji e, per ultime, le iniziali. */
    face: normalizeAvatar3d(migraFaccia(avatar?.face)),
  };
}

/* I sensori facoltativi che una persona puo' portarsi dietro, oltre alla
 * batteria: quelli della Companion App (in carica, indirizzo, attivita',
 * WiFi), l'orologio, e quelli di Waze/Proximity (tempo di rientro, distanza,
 * direzione). Elencati qui perche' la normalizzazione, l'editor e il
 * rilevamento automatico parlino della stessa lista. */
export const PERSON_SENSOR_FIELDS = Object.freeze([
  "batteryState",
  "watch",
  "distance",
  "travel",
  "address",
  "activity",
  "wifi",
  "direction",
]);

/**
 * L'elenco delle persone come lo si puo' usare: id stabili e unici, nomi
 * puliti, avatar sempre completo. Un elemento senza nome ne' entita' non e'
 * una persona: si scarta invece di disegnare una card vuota.
 */
export function normalizePeople(input) {
  const list = Array.isArray(input) ? input : [];
  const used = new Set();
  const people = [];
  list.forEach((person, index) => {
    if (!person || typeof person !== "object") return;
    const name = clean(person.name);
    const entity = clean(person.entity);
    if (!name && !entity) return;
    const seed =
      clean(person.id) ||
      `person-${slugifyPersonId(name || entity.split(".")[1] || "") || index + 1}`;
    let id = seed;
    let collision = 2;
    while (used.has(id)) id = `${seed}-${collision++}`;
    used.add(id);
    people.push({
      id,
      name,
      entity,
      photo: clean(person.photo),
      battery: clean(person.battery),
      ...Object.fromEntries(PERSON_SENSOR_FIELDS.map((field) => [field, clean(person[field])])),
      avatar: normalizeAvatar(person.avatar, people.length),
    });
  });
  return people;
}

/* Le entita' che possono raccontare dove sta una persona. `person.*` e' la
 * voce giusta; `device_tracker.*` resta accettato per chi non ha creato le
 * persone in Home Assistant e traccia direttamente il telefono. */
export const PERSON_ENTITY_DOMAINS = Object.freeze(["person", "device_tracker"]);

export function isPersonEntity(entityId = "") {
  const domain = clean(entityId).split(".")[0];
  return PERSON_ENTITY_DOMAINS.includes(domain);
}

/**
 * Le persone che Home Assistant conosce e la plancia non ancora: quello che
 * il pulsante «importa» propone. La foto viene dall'entita' quando c'e'.
 */
export function suggestPeople(states = {}, existing = []) {
  const taken = new Set(
    (Array.isArray(existing) ? existing : [])
      .map((person) => clean(person?.entity))
      .filter(Boolean),
  );
  return Object.entries(states)
    .filter(([id]) => id.startsWith("person."))
    .filter(([id]) => !taken.has(id))
    .map(([id, state]) => ({
      entity: id,
      name: clean(state?.attributes?.friendly_name) || clean(id.split(".")[1]).replace(/_/g, " "),
      photo: clean(state?.attributes?.entity_picture),
    }));
}

const AWAY_STATES = new Set(["not_home", "unknown", "unavailable", "none", ""]);

function readNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
}

/* Da dove viene la batteria, in ordine di fiducia: il sensore dichiarato
 * dall'utente, poi cio' che l'entita' della persona sa gia' — il suo
 * `battery_level`, o quello del telefono che la traccia. Cosi' la card mostra
 * la batteria anche a chi non ha configurato niente. */
function batteryFor(person, states) {
  const declared = readNumber(states?.[person.battery]?.state);
  if (person.battery) return declared;
  const entityState = states?.[person.entity];
  const direct = readNumber(entityState?.attributes?.battery_level);
  if (direct !== null) return direct;
  const source = clean(entityState?.attributes?.source);
  return readNumber(states?.[source]?.attributes?.battery_level);
}

/* La Companion App scrive lo stato della batteria a parole, e le parole
 * cambiano tra Android e iOS: qui c'e' l'elenco di quelle che vogliono dire
 * «attaccato alla corrente». */
const CHARGING_STATES = new Set(["charging", "full", "ac", "usb", "wireless", "dock"]);

export function isCharging(state) {
  return CHARGING_STATES.has(clean(state).toLowerCase().replace(/\s+/g, "_"));
}

const MISSING_STATES = new Set([
  "",
  "unknown",
  "unavailable",
  "none",
  "not set",
  "not_set",
  "off",
  "<not connected>",
]);

function readableState(entityState) {
  const value = clean(entityState?.state);
  return MISSING_STATES.has(value.toLowerCase()) ? "" : value;
}

/**
 * La distanza come la si scrive su una card: numero corto e unita' del
 * sensore. I metri della Companion App e di Proximity diventano chilometri
 * appena smettono di essere leggibili come metri.
 */
export function distanceParts(entityState) {
  const raw = readableState(entityState);
  const value = Number.parseFloat(raw);
  if (!raw || !Number.isFinite(value) || value < 0) return null;
  const unit = clean(entityState?.attributes?.unit_of_measurement) || "km";
  if (unit === "m" && value >= 1000) return { value: Math.round(value / 100) / 10, unit: "km" };
  if (unit === "m") return { value: Math.round(value), unit: "m" };
  return { value: Math.round(value * 10) / 10, unit };
}

/**
 * Il tempo di rientro: Waze e Google lo danno in minuti, e in minuti resta.
 */
export function travelMinutes(entityState) {
  const raw = readableState(entityState);
  const value = Number.parseFloat(raw);
  if (!raw || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

/* Da «in che direzione va» a un segno sulla card. Proximity dice
 * towards/away_from/arrived/stationary; solo le prime due sono un movimento
 * da raccontare. */
export function directionKey(entityState) {
  const value = clean(entityState?.state).toLowerCase();
  if (value === "towards") return "towards";
  if (value === "away_from") return "away";
  return "";
}

/* L'attivita' della Companion App, ridotta alle cinque che si disegnano. */
const ACTIVITY_KEYS = Object.freeze([
  ["automotive", ["automotive", "in_vehicle", "driving"]],
  ["cycling", ["cycling", "on_bicycle"]],
  ["running", ["running"]],
  ["walking", ["walking", "on_foot"]],
  ["still", ["still", "stationary"]],
]);

export function activityKey(entityState) {
  const value = clean(entityState?.state).toLowerCase().replace(/\s+/g, "_");
  for (const [key, aliases] of ACTIVITY_KEYS) if (aliases.includes(value)) return key;
  return "";
}

/* ── Rilevamento dei sensori dal telefono ──────────────────────────────────
 *
 * La Companion App chiama i suoi sensori col nome del dispositivo che traccia
 * la persona: `device_tracker.iphone_di_anna` porta con se'
 * `sensor.iphone_di_anna_battery_level` e fratelli. Waze e Proximity non
 * seguono quella regola, ma nel nome portano comunque il pezzo giusto
 * (travel_time, distance, direction_of_travel). Qui si cercano entrambe le
 * famiglie, cosi' l'editor riempie le caselle invece di farle scrivere.
 */
const COMPANION_SUFFIXES = Object.freeze({
  battery: ["battery_level", "battery"],
  batteryState: ["battery_state"],
  address: ["geocoded_location"],
  activity: ["activity", "detected_activity"],
  wifi: ["wifi_connection", "ssid"],
});

const FUZZY_PATTERNS = Object.freeze({
  travel: /travel_time/,
  distance: /(?:^|_)distance$/,
  direction: /direction_of_travel/,
  watch: /watch.*battery|battery.*watch/,
});

function trackerPrefixes(states, personEntity) {
  const prefixes = new Set();
  const person = states?.[personEntity];
  const source = clean(person?.attributes?.source);
  if (source.includes(".")) prefixes.add(source.split(".")[1]);
  for (const id of Array.isArray(person?.attributes?.device_trackers)
    ? person.attributes.device_trackers
    : [])
    if (clean(id).includes(".")) prefixes.add(clean(id).split(".")[1]);
  const own = clean(personEntity).split(".")[1];
  if (own) prefixes.add(own);
  return [...prefixes].filter(Boolean);
}

/* Due nomi si somigliano quando uno sta dentro l'altro: il tracker
 * `giovanni_zfold8` e il sensore `zfold8_battery_level` parlano dello stesso
 * telefono anche se nessuno dei due e' il prefisso esatto dell'altro. Sotto i
 * quattro caratteri non si somiglia niente: `s10` sta dentro troppe parole. */
function affine(prefix, objectId) {
  if (prefix.length < 4) return objectId.startsWith(`${prefix}_`) || objectId === prefix;
  return objectId.includes(prefix) || prefix.includes(objectId);
}

export function detectCompanionSensors(states = {}, personEntity = "", householdPeople = null) {
  const prefixes = trackerPrefixes(states, personEntity);
  const sensors = Object.keys(states).filter((id) => id.startsWith("sensor."));
  /* Il candidato unico vale solo in una casa con una persona sola: con due,
   * «l'unico sensore di batteria» sarebbe lo stesso per entrambe, e uno dei
   * due telefoni diventerebbe di tutti. Le persone della casa non sono solo
   * gli stati `person.*`: chi traccia col `device_tracker.` diretto non ne
   * ha uno, e una casa con due tracker e zero `person.*` sarebbe sembrata
   * «una persona sola» — chi chiama passa la propria anagrafe e conta anche
   * quella. */
  const anagrafe = Array.isArray(householdPeople) ? householdPeople.length : 0;
  const unica =
    Math.max(Object.keys(states).filter((id) => id.startsWith("person.")).length, anagrafe) <= 1;
  const found = {};

  for (const [field, suffixes] of Object.entries(COMPANION_SUFFIXES)) {
    for (const prefix of prefixes) {
      const hit = suffixes
        .map((suffix) => `sensor.${prefix}_${suffix}`)
        .find((id) => sensors.includes(id));
      if (hit) {
        found[field] = hit;
        break;
      }
    }
    if (found[field]) continue;
    /* Il nome esatto non c'era: si prova la somiglianza, e per ultimo il
     * candidato unico — in una casa con un telefono solo, l'unico
     * `*_battery_state` e' il suo anche se il tracker si chiama diversamente.
     * Con due telefoni i candidati sono due e non si indovina. */
    for (const suffix of suffixes) {
      const candidates = sensors.filter((id) => {
        const objectId = id.slice("sensor.".length);
        return objectId.endsWith(`_${suffix}`) || objectId === suffix;
      });
      const somigliante = candidates.find((id) => {
        const base = id.slice("sensor.".length).slice(0, -(suffix.length + 1));
        return prefixes.some((prefix) => affine(prefix, base));
      });
      const hit = somigliante || (unica && candidates.length === 1 ? candidates[0] : "");
      if (hit) {
        found[field] = hit;
        break;
      }
    }
  }

  for (const [field, pattern] of Object.entries(FUZZY_PATTERNS)) {
    const candidates = sensors.filter((id) => pattern.test(id.slice("sensor.".length)));
    const hit =
      candidates.find((id) => {
        const objectId = id.slice("sensor.".length);
        return prefixes.some((prefix) => affine(prefix, objectId));
      }) || (unica && candidates.length === 1 ? candidates[0] : "");
    if (hit) found[field] = hit;
  }

  return found;
}

function lastChangedMs(entityState) {
  const raw = clean(entityState?.last_changed || entityState?.last_updated);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Quanto tempo e' passato, a misura di card: l'unita' piu' grande che abbia
 * almeno valore 1. I secondi non si mostrano — «adesso» dice di piu'.
 */
export function elapsedParts(sinceMs, nowMs) {
  if (!Number.isFinite(sinceMs) || !Number.isFinite(nowMs)) return null;
  const minutes = Math.floor(Math.max(0, nowMs - sinceMs) / 60000);
  if (minutes < 1) return { unit: "now", value: 0 };
  if (minutes < 60) return { unit: "minute", value: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: "hour", value: hours };
  return { unit: "day", value: Math.floor(hours / 24) };
}

/**
 * Tutto quello che serve per disegnare la card di una persona, gia' deciso.
 *
 * `presence` distingue tre situazioni, non due: a casa, fuori, o in una zona
 * con un nome — che e' informazione in piu', non un modo diverso di dire
 * fuori. `zone` porta il nome cosi' come Home Assistant lo scrive nello stato
 * della persona; l'etichetta tradotta la sceglie la sezione.
 */
export function personViewModel(person, states = {}, nowMs = null) {
  const entityState = states?.[person.entity];
  const rawState = clean(entityState?.state);
  const presence =
    rawState.toLowerCase() === "home"
      ? "home"
      : AWAY_STATES.has(rawState.toLowerCase())
        ? "away"
        : "zone";
  const known =
    Boolean(entityState) && !["unknown", "unavailable", ""].includes(rawState.toLowerCase());
  const battery = batteryFor(person, states);
  const photo = person.photo || clean(entityState?.attributes?.entity_picture);
  const away = known && presence !== "home";
  const watch = readNumber(states?.[person.watch]?.state);
  return {
    id: person.id,
    name: person.name || clean(entityState?.attributes?.friendly_name) || person.entity,
    photo,
    initials: personInitials(person.name || clean(entityState?.attributes?.friendly_name)),
    avatar: person.avatar,
    presence,
    known,
    zone: presence === "zone" ? rawState : "",
    battery,
    batteryLow: battery !== null && battery <= 20,
    charging: person.batteryState ? isCharging(states?.[person.batteryState]?.state) : false,
    watch,
    watchLow: watch !== null && watch <= 20,
    /* Il viaggio si racconta solo di chi e' fuori: a casa distanza e tempo di
     * rientro sono zero per definizione, e scriverli sarebbe rumore. */
    distance: away ? distanceParts(states?.[person.distance]) : null,
    travel: away ? travelMinutes(states?.[person.travel]) : null,
    direction: away ? directionKey(states?.[person.direction]) : "",
    address: away ? clean(readableState(states?.[person.address])) : "",
    activity: away ? activityKey(states?.[person.activity]) : "",
    wifi: clean(readableState(states?.[person.wifi])),
    elapsed: known ? elapsedParts(lastChangedMs(entityState), nowMs ?? Date.now()) : null,
  };
}
