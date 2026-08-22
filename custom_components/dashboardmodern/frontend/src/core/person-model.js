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

function normalizeAvatar(avatar = {}, index = 0) {
  const color = clean(avatar?.color);
  return {
    emoji: clean(avatar?.emoji),
    color: AVATAR_COLORS.includes(color) ? color : AVATAR_COLORS[index % AVATAR_COLORS.length],
  };
}

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
    elapsed: known ? elapsedParts(lastChangedMs(entityState), nowMs ?? Date.now()) : null,
  };
}
