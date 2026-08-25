/* Tapparelle e tende.
 *
 * La sezione disegna una finestra con la tapparella che scende, perche' e' la
 * sola cosa che sapeva esserci. Una tenda pero' non scende: si apre di lato, in
 * due teli che si scostano dal centro, e vederla scendere come una tapparella
 * e' vedere una cosa diversa da quella che si ha in casa.
 *
 * Il tipo si puo' scegliere in configurazione. Chi non lo sceglie non deve
 * scegliere niente: Home Assistant dice gia' che tipo di apertura e' — e'
 * `device_class` — e per quasi tutti quella basta.
 *
 * Il modulo e' puro: guarda un oggetto e uno stato, non legge nient'altro —
 * tranne la lingua attiva, per dire come si chiama quello che ha guardato.
 */

import { SOURCE_LOCALE, getLocale, pick } from "./i18n.js";

const clean = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

/** I tipi che la sezione sa disegnare. */
export const COVER_KINDS = Object.freeze(["tapparella", "tenda", "tenda_sole"]);

export const COVER_KIND_LABELS = Object.freeze({
  tapparella: ["Tapparella", "Roller shutter"],
  tenda: ["Tenda", "Curtain"],
  tenda_sole: ["Tenda da sole", "Awning"],
});

/* Cosa dice Home Assistant. Le classi che restano fuori — window, garage,
 * gate, door, damper — non sono ne' tapparelle ne' tende, e per quelle la
 * finestra con la tapparella resta il disegno meno sbagliato. */
const DA_DEVICE_CLASS = Object.freeze({
  shutter: "tapparella",
  blind: "tenda",
  curtain: "tenda",
  shade: "tenda",
  awning: "tenda_sole",
});

/** Il tipo dichiarato, se e' uno di quelli che sappiamo disegnare. */
export function declaredCoverKind(item = {}) {
  const declared = clean(item.kind || item.cover_kind || item.type);
  return COVER_KINDS.includes(declared) ? declared : "";
}

/**
 * Il tipo di una copertura: quello scelto, altrimenti quello che dice Home
 * Assistant, altrimenti una tapparella — che e' cio' che la sezione ha sempre
 * disegnato, e cambiarlo sotto i piedi di chi ha gia' tutto configurato sarebbe
 * una sorpresa, non un miglioramento.
 */
export function coverKind(item = {}, state = null) {
  const declared = declaredCoverKind(item);
  if (declared) return declared;
  const deviceClass = clean(state?.attributes?.device_class);
  return DA_DEVICE_CLASS[deviceClass] || "tapparella";
}

/* Come si chiama, nella lingua della plancia.
 *
 * Il secondo argomento era un booleano "inglese si'/no", e chi non era inglese
 * leggeva italiano: una tenda si chiamava «Tenda» anche in tedesco. Ora e' la
 * lingua; `true` continua a valere inglese, per chi chiamava com'era prima. */
export function coverKindLabel(kind, locale = getLocale()) {
  const labels = COVER_KIND_LABELS[kind] || COVER_KIND_LABELS.tapparella;
  const code = locale === true ? "en" : locale === false ? SOURCE_LOCALE : locale;
  return pick(labels[0], labels[1], code);
}

/* Il verso in cui si muove.
 *
 * Una tapparella scende dall'alto e la sua "chiusura" e' altezza; una tenda si
 * scosta di lato e la sua chiusura e' larghezza. Detto qui una volta, il
 * disegno non deve piu' indovinarlo. */
export const coverIsSideways = (kind) => kind === "tenda";

/* Una tenda da sole non e' ne' l'una ne' l'altra.
 *
 * Scende dall'alto come una tapparella, e per questo veniva disegnata con le
 * sue stesse stecche: in una card, accanto a una tapparella, era la stessa
 * identica cosa. Ma non e' una lamiera che chiude un vetro — e' un telo teso
 * che sporge sopra la finestra, a righe larghe e col bordo ondulato. Il verso
 * lo condivide con la tapparella; il disegno no. */
export const coverIsAwning = (kind) => kind === "tenda_sole";

/* Un infisso puo' avere tutte e tre le cose.
 *
 * La configurazione teneva una entita' sola per riga, piu' un menu che diceva
 * di che tipo fosse. Ma su una stessa finestra ci stanno insieme la tapparella,
 * la tenda e la tenda da sole — e chi le ha tutte non aveva modo di dirlo:
 * poteva sceglierne una e basta. Le caselle adesso sono una per funzione, e il
 * tipo non si dichiara piu': lo dice la casella in cui hai scritto.
 *
 * Il menu di prima resta letto per chi l'aveva compilato: una riga vecchia con
 * `kind: "tenda"` continua a uscire come tenda.
 */
export const COVER_SLOTS = Object.freeze([
  { campo: "entity", kind: "" },
  { campo: "tenda", kind: "tenda" },
  { campo: "tendaSole", kind: "tenda_sole" },
]);

/** Le coperture configurate su una riga, in ordine di casella. */
export function coverEntries(item = {}) {
  const uscite = [];
  const viste = new Set();
  for (const { campo, kind } of COVER_SLOTS) {
    const entity = clean(item?.[campo]);
    if (!entity || viste.has(entity)) continue;
    viste.add(entity);
    /* La prima casella non impone un tipo: se la riga vecchia ne dichiarava
     * uno vale quello, altrimenti decide Home Assistant. */
    uscite.push({ entity, kind: kind || declaredCoverKind(item) });
  }
  return uscite;
}

/* La tapparella comandata da due rele' (#194).
 *
 * Uno Shelly 2PM lasciato in modalita' interruttore non espone una copertura:
 * espone due prese, una che manda su e una che manda giu'. La casella della
 * tapparella accetta gia' un `switch.` singolo — un rele' che tiene la
 * tapparella su quando e' acceso — ma un motore a due fili non funziona
 * cosi': chiudere non e' spegnere la salita, e' accendere la discesa.
 *
 * Il secondo rele' e' un campo della riga come gli altri. Vale solo dove ha
 * senso, cioe' quando il primo comando e' anch'esso un rele': su una
 * `cover.` vera i due tasti li ha gia' Home Assistant, e un rele' in piu'
 * sarebbe solo un modo per farsi male. */
const SWITCH_RE = /^switch\.[a-z0-9_]+$/i;

export const isRelayEntity = (entity) => SWITCH_RE.test(clean(entity));

export function coverDownRelay(item = {}) {
  const primo = clean(item?.entity || item?.entities?.[0]);
  if (!isRelayEntity(primo)) return "";
  const giu = clean(item?.down ?? item?.down_entity ?? item?.rele_giu);
  return isRelayEntity(giu) && giu !== primo ? giu : "";
}

/** Quanto e' coperta la finestra, da 0 (tutta aperta) a 100. */
export function coverClosedPercent(position) {
  const value = Number(position);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, 100 - value));
}

/* La posizione preferita di una riga (#200).
 *
 * «Non voglio la chiusura completa ma il 95%, per lasciar passare un po'
 * d'aria»: e' un numero che appartiene alla configurazione della tapparella,
 * nella stessa scala del cursore e della percentuale accanto — 0 chiusa, 100
 * aperta. Vuoto vuol dire nessun preset: la card mostra il tasto solo a chi
 * l'ha chiesto. */
export function coverPresetPosition(item = {}) {
  const raw = item?.preset ?? item?.preset_position;
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.round(Math.max(0, Math.min(100, value)));
}

/* Le posizioni che la tendina offre (#200).
 *
 * Dal 100% aperta allo 0% chiusa, di cinque in cinque: abbastanza fitte da
 * trovarci il 95% dell'esempio, abbastanza rade da scorrerle. La posizione
 * preferita della configurazione entra nell'elenco al suo posto in scala
 * anche quando non cade su un passo — e' una scorciatoia, non un vincolo. */
export const COVER_POSITION_STEP = 5;

export function coverPositionChoices(preferred = null) {
  const values = [];
  for (let value = 100; value >= 0; value -= COVER_POSITION_STEP) values.push(value);
  if (preferred == null || values.includes(preferred)) return values;
  values.push(preferred);
  return values.sort((a, b) => b - a);
}

/* I comandi che un rele' capisce.
 *
 * Un servizio `cover.*` su uno switch cade nel vuoto: va tradotto. Con un
 * rele' solo apre l'accensione e chiude lo spegnimento, e non c'e' niente da
 * fermare. Con due — quello che manda su e quello che manda giu' (#194) —
 * chiudere e' accendere la discesa, e fermare e' spegnerle entrambe.
 *
 * Il verso opposto si spegne SEMPRE per primo: due contatti chiusi insieme su
 * un motore a due fili non devono succedere mai, e non ci si affida al fatto
 * che di solito sia il dispositivo a impedirlo. L'ordine dell'elenco e'
 * l'ordine in cui vanno chiamati.
 *
 * Sta qui, e non in chi disegna, perche' i comandi partono da due posti — la
 * pagina Tapparelle e la tessera in Home — e una regola di sicurezza scritta
 * due volte e' una regola che prima o poi vale in un posto solo.
 */
export function relayCoverCommands(service, up, down = "") {
  const salita = clean(up);
  if (!isRelayEntity(salita)) return [];
  const discesa = isRelayEntity(down) && clean(down) !== salita ? clean(down) : "";
  if (!discesa) {
    if (service === "stop_cover") return [];
    return [{ entity: salita, service: service === "open_cover" ? "turn_on" : "turn_off" }];
  }
  if (service === "stop_cover")
    return [
      { entity: salita, service: "turn_off" },
      { entity: discesa, service: "turn_off" },
    ];
  const sale = service === "open_cover";
  return [
    { entity: sale ? discesa : salita, service: "turn_off" },
    { entity: sale ? salita : discesa, service: "turn_on" },
  ];
}
