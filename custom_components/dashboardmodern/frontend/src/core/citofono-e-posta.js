/* Il citofono e la cassetta della posta (#449).
 *
 * «Avendo un intercom ho un button.cancello per aprire, inoltre volevo chiedere
 * una sezione per la cassetta della posta: all'interno c'e' un Vallhorn di IKEA
 * che espone un pir per segnalare la presenza posta e un sensore luminosita'
 * che, quando rileva luce (apertura cassetta), segnala il ritiro della posta.»
 *
 * Sono due cose che stanno allo stesso posto — il cancello — e la domanda che
 * ci si fa e' una sola: c'e' qualcuno alla porta, e c'e' qualcosa in cassetta.
 *
 * ── Il citofono ──────────────────────────────────────────────────────────
 * Un nome, il tasto che apre, il campanello che suona e, se c'e', la
 * telecamera. Il tasto che apre non e' per forza un `button`: c'e' chi ha una
 * serratura, chi un cancello motorizzato che Home Assistant chiama `cover`, chi
 * uno script. Ognuno vuole il suo verbo, e sono quelli che Home Assistant ha
 * per quel dominio — nessun servizio inventato.
 *
 * ── La cassetta ──────────────────────────────────────────────────────────
 * Due sensori: quello che dice che qualcosa e' entrato, e quello che dice che
 * la cassetta e' stata aperta. Il verdetto e' il confronto fra i due momenti:
 * se l'ultimo movimento e' piu' recente dell'ultima apertura, la posta e'
 * ancora dentro.
 *
 * Il confronto regge perche' la cassetta e' una scatola chiusa: la luce, li'
 * dentro, non cambia mai da sola: il momento in cui e' cambiata e' il momento
 * in cui qualcuno ha aperto lo sportello. Fuori da una scatola chiusa questo
 * non sarebbe vero, ed e' per questo che sta scritto qui invece che darlo per
 * scontato.
 *
 * Chi ha una sola delle due entita' non riceve un verdetto inventato: con il
 * solo rilevatore si sa che qualcosa si e' mosso e quando, non se la posta e'
 * stata ritirata. In quel caso il verdetto e' «non si sa», che e' la verita'.
 *
 * Il modulo e' puro: non parla con Home Assistant e non tocca il DOM.
 */

import { conservaIlConfigurato } from "./device-model.js";

const clean = (valore) => String(valore ?? "").trim();

const numero = (valore) => {
  const n = Number.parseFloat(String(valore ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Dove si scrive la configurazione di questa sezione. */
export const CHIAVE_CITOFONO = "cd_citofono";

/* Quattro e quattro: una casa ha un cancello, un portone e poco altro, e una
 * pagina che ne accetta venti e' una pagina che nessuno riempie. */
export const CITOFONI_MASSIMI = 4;
export const CASSETTE_MASSIME = 4;

/** Le entita' di un citofono, nell'ordine in cui si leggono sulla scheda. */
export const CAMPI_DEL_CITOFONO = Object.freeze(["apri", "campanello", "telecamera"]);

/** Le entita' di una cassetta, nello stesso ordine. */
export const CAMPI_DELLA_CASSETTA = Object.freeze(["posta", "ritiro", "contatore"]);

/* Quanta luce vuol dire «sportello aperto».
 *
 * Dentro una cassetta chiusa ci sono zero lux. Venti e' la luce di un
 * pianerottolo la sera: sopra quella soglia lo sportello e' aperto per
 * davvero, e non per un raggio che passa dalla fessura. Chi ha una cassetta
 * piu' luminosa la cambia dalla configurazione. */
export const LUCE_CHE_APRE = 20;

/* I domini che sanno aprire, col verbo che Home Assistant usa per quel dominio.
 *
 * `lock.open` e' lo scatto della serratura — quello che un citofono fa — ed e'
 * diverso da `lock.unlock`, che la lascia aperta. Chi ha una serratura senza lo
 * scatto riceve `unlock`, che e' quello che quella serratura sa fare: lo decide
 * `apreDavvero`, guardando cosa dichiara l'entita'. */
const APERTURE = Object.freeze({
  button: { service: "press" },
  input_button: { service: "press" },
  script: { service: "turn_on" },
  scene: { service: "turn_on" },
  automation: { service: "trigger" },
  switch: { service: "turn_on" },
  input_boolean: { service: "turn_on" },
  lock: { service: "open" },
  cover: { service: "open_cover" },
});

/* Il bit con cui una serratura dichiara di sapere scattare: `LockEntityFeature.OPEN`. */
const SERRATURA_APRE = 1;

/** Se quell'entita' sa aprire qualcosa. */
export function puoAprire(entity) {
  return Boolean(APERTURE[clean(entity).split(".")[0]]);
}

/** Il servizio che apre, per quell'entita' com'e' adesso. `null` se non apre. */
export function comandoDiApertura(entity, states = {}) {
  const pulita = clean(entity);
  const dominio = pulita.split(".")[0];
  const verbo = APERTURE[dominio];
  if (!verbo) return null;
  if (dominio === "lock") {
    const funzioni = numero(states?.[pulita]?.attributes?.supported_features) || 0;
    /* eslint-disable-next-line no-bitwise -- e' una maschera di bit, e si legge cosi'. */
    const scatta = (funzioni & SERRATURA_APRE) === SERRATURA_APRE;
    return {
      domain: dominio,
      service: scatta ? "open" : "unlock",
      data: { entity_id: pulita },
    };
  }
  return { domain: dominio, service: verbo.service, data: { entity_id: pulita } };
}

/** Un citofono, coi campi che la configurazione conosce. */
export function normalizzaCitofono(input = {}, indice = 0) {
  const dato = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return conservaIlConfigurato(
    {
      id: clean(dato.id) || `citofono-${indice + 1}`,
      nome: clean(dato.nome || dato.name),
      apri: clean(dato.apri),
      campanello: clean(dato.campanello),
      telecamera: clean(dato.telecamera),
    },
    dato,
    "citofoni",
  );
}

/** Una cassetta, coi campi che la configurazione conosce. */
export function normalizzaCassetta(input = {}, indice = 0) {
  const dato = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const soglia = numero(dato.soglia);
  return conservaIlConfigurato(
    {
      id: clean(dato.id) || `cassetta-${indice + 1}`,
      nome: clean(dato.nome || dato.name),
      posta: clean(dato.posta),
      ritiro: clean(dato.ritiro),
      contatore: clean(dato.contatore),
      soglia: soglia === null || soglia < 0 ? LUCE_CHE_APRE : soglia,
    },
    dato,
    "cassette",
  );
}

function elenco(input, normalizza, campi, tetto) {
  const righe = Array.isArray(input) ? input : input && typeof input === "object" ? [input] : [];
  const vuota = campi.map(() => "").join("|");
  const visti = new Set();
  const fuori = [];
  for (const [indice, riga] of righe.entries()) {
    const voce = normalizza(riga, indice);
    /* Una voce appena aggiunta e' ancora vuota, e buttarla via qui vorrebbe
     * dire che premere «Aggiungi» non fa niente. */
    const firma = campi.map((campo) => voce[campo]).join("|");
    if (firma !== vuota && visti.has(firma)) continue;
    if (firma !== vuota) visti.add(firma);
    fuori.push(voce);
    if (fuori.length >= tetto) break;
  }
  return fuori;
}

/** L'elenco pulito dei citofoni: non piu' di quattro, e mai due volte lo stesso. */
export function normalizzaCitofoni(input = []) {
  return elenco(input, normalizzaCitofono, CAMPI_DEL_CITOFONO, CITOFONI_MASSIMI);
}

/** L'elenco pulito delle cassette. */
export function normalizzaCassette(input = []) {
  return elenco(input, normalizzaCassetta, CAMPI_DELLA_CASSETTA, CASSETTE_MASSIME);
}

/** La configurazione della sezione, ripulita. */
export function normalizzaIngresso(input = {}) {
  const dato = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    citofoni: normalizzaCitofoni(dato.citofoni),
    cassette: normalizzaCassette(dato.cassette),
  };
}

/** Le entita' da tenere d'occhio: serve a chi decide se ridisegnare. */
export function entitaDellIngresso(input = {}) {
  const conf = normalizzaIngresso(input);
  const viste = new Set();
  for (const voce of conf.citofoni)
    for (const campo of CAMPI_DEL_CITOFONO) if (voce[campo]) viste.add(voce[campo]);
  for (const voce of conf.cassette)
    for (const campo of CAMPI_DELLA_CASSETTA) if (voce[campo]) viste.add(voce[campo]);
  return [...viste];
}

const quando = (stato) => {
  const scritto = stato?.last_changed || stato?.last_updated;
  const istante = scritto ? Date.parse(scritto) : Number.NaN;
  return Number.isFinite(istante) ? istante : null;
};

const acceso = (stato) => clean(stato?.state).toLowerCase() === "on";

const muto = (stato) => {
  const grezzo = clean(stato?.state).toLowerCase();
  return !stato || grezzo === "unavailable" || grezzo === "unknown" || grezzo === "";
};

/* Se quel sensore dice «aperto» adesso.
 *
 * Due modi di dirlo, perche' sono due modi di misurarlo: un contatto dice «on»,
 * un luxmetro dice un numero. Chi ha il contatto non ha una soglia da tarare, e
 * chi ha il luxmetro non ha un «on» da aspettare. */
function apertaAdesso(stato, soglia) {
  if (!stato || muto(stato)) return null;
  const lux = numero(stato.state);
  if (lux !== null) return lux >= soglia;
  return acceso(stato);
}

/** Un citofono come sta adesso: chi apre, chi suona, cosa si vede. */
export function letturaDelCitofono(voce = {}, states = {}) {
  const conf = normalizzaCitofono(voce);
  const apri = conf.apri ? states?.[conf.apri] : null;
  const campanello = conf.campanello ? states?.[conf.campanello] : null;
  return {
    id: conf.id,
    nome: conf.nome || clean(apri?.attributes?.friendly_name) || conf.apri || conf.campanello,
    apri: conf.apri,
    /* Un tasto mai premuto sta su «unknown», ed e' un tasto che funziona: non
     * raggiungibile e' solo chi lo dice. */
    puoAprire: Boolean(conf.apri) && puoAprire(conf.apri) && clean(apri?.state) !== "unavailable",
    comando: conf.apri ? comandoDiApertura(conf.apri, states) : null,
    campanello: conf.campanello,
    suona: conf.campanello ? (muto(campanello) ? null : acceso(campanello)) : null,
    squillo: conf.campanello ? quando(campanello) : null,
    telecamera: conf.telecamera,
  };
}

/** Una cassetta come sta adesso: se c'e' posta, da quando, e se e' aperta. */
export function letturaDellaCassetta(voce = {}, states = {}) {
  const conf = normalizzaCassetta(voce);
  const posta = conf.posta ? states?.[conf.posta] : null;
  const ritiro = conf.ritiro ? states?.[conf.ritiro] : null;
  const arrivata = conf.posta ? quando(posta) : null;
  const ritirata = conf.ritiro ? quando(ritiro) : null;
  const aperta = conf.ritiro ? apertaAdesso(ritiro, conf.soglia) : null;
  const contatore = conf.contatore ? numero(states?.[conf.contatore]?.state) : null;
  return {
    id: conf.id,
    nome: conf.nome || clean(posta?.attributes?.friendly_name) || conf.posta || conf.ritiro,
    posta: conf.posta,
    ritiro: conf.ritiro,
    contatore,
    aperta,
    arrivata,
    ritirata,
    muta: Boolean(conf.posta) && muto(posta),
    ce: cePosta({ posta: conf.posta ? posta : null, arrivata, ritirata, aperta }),
  };
}

/* Il verdetto: c'e' posta, non c'e', o non si sa.
 *
 * Con tutti e due i sensori e' un confronto fra due momenti. Con il solo
 * rilevatore si sa che qualcosa si e' mosso, non se e' stato ritirato: allora
 * «c'e'» vale finche' il rilevatore e' acceso, e dopo torna a «non si sa».
 * Nessuno dei due casi inventa un «no» che non c'e'. */
function cePosta({ posta, arrivata, ritirata, aperta }) {
  if (!posta) return null;
  if (muto(posta)) return null;
  if (aperta === true) return false;
  if (ritirata === null) return acceso(posta) ? true : null;
  if (arrivata === null) return null;
  return arrivata > ritirata;
}

/** Tutto insieme, nell'ordine in cui la pagina lo disegna. */
export function lettureDellIngresso(input = {}, states = {}) {
  const conf = normalizzaIngresso(input);
  return {
    citofoni: conf.citofoni.map((voce) => letturaDelCitofono(voce, states)),
    cassette: conf.cassette.map((voce) => letturaDellaCassetta(voce, states)),
  };
}

/** Le tre parole della tessera: quante cassette hanno posta, e se qualcuno suona. */
export function riassuntoDellIngresso(letture = {}) {
  const citofoni = Array.isArray(letture.citofoni) ? letture.citofoni : [];
  const cassette = Array.isArray(letture.cassette) ? letture.cassette : [];
  return {
    citofoni: citofoni.length,
    cassette: cassette.length,
    suona: citofoni.some((voce) => voce.suona === true),
    conPosta: cassette.filter((voce) => voce.ce === true).length,
    aperte: cassette.filter((voce) => voce.aperta === true).length,
    /* Il momento piu' recente fra tutti: e' quello che la tessera racconta. */
    arrivata: cassette.reduce(
      (piu, voce) => (voce.ce === true && voce.arrivata ? Math.max(piu ?? 0, voce.arrivata) : piu),
      null,
    ),
  };
}

/* ── quello che un'integrazione lascia capire ──────────────────────────── */

/* Un citofono e una cassetta si riconoscono da come Home Assistant li chiama.
 *
 * E' la stessa strada degli elettrodomestici, del robot, dei lettori e dei nodi:
 * si sceglie l'integrazione, si sceglie il dispositivo, e le caselle si
 * compilano da sole. Una Ring Intercom pubblica il tasto che apre e il
 * campanello; un Vallhorn pubblica il movimento e la luce. Quello che manca
 * resta vuoto, e quello gia' scritto a mano non si tocca.
 */
const PAROLE = Object.freeze({
  apri: /\b(apri|apre|open|unlock|sblocca|cancello|gate|portone|door|release|buzzer)\b/,
  campanello: /\b(campanello|doorbell|ding|ring|chime|suona|button pressed)\b/,
  posta: /\b(posta|mail|letter|lettere|movimento|motion|pir|occupancy)\b/,
  ritiro: /\b(luce|light|illuminance|lux|luminos|apertura|opened|sportello)\b/,
  contatore: /\b(contatore|counter|lettere|letters|consegne|deliveries)\b/,
});

const parole = (voce, states) =>
  `${clean(voce.entity_id)} ${clean(voce.name)} ${clean(states?.[clean(voce.entity_id)]?.attributes?.friendly_name)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const utilizzabili = (entities) =>
  (Array.isArray(entities) ? entities : []).filter(
    (voce) => voce && !voce.disabled && clean(voce.entity_id).includes("."),
  );

const dominioDi = (voce) => clean(voce.entity_id).split(".")[0];

const classeDi = (voce, states) =>
  clean(voce.device_class || states?.[clean(voce.entity_id)]?.attributes?.device_class);

/** Le caselle di un citofono, da quel dispositivo. */
export function bindCitofonoToDevice({
  device = {},
  entities = [],
  states = {},
  indice = 0,
  precedente = {},
} = {}) {
  const elenco = utilizzabili(entities);
  const apri =
    elenco.find((voce) => dominioDi(voce) === "button" && PAROLE.apri.test(parole(voce, states))) ||
    elenco.find((voce) => dominioDi(voce) === "lock") ||
    elenco.find((voce) => puoAprire(voce.entity_id) && PAROLE.apri.test(parole(voce, states)));
  const campanello =
    elenco.find(
      (voce) =>
        dominioDi(voce) === "event" &&
        (classeDi(voce, states) === "doorbell" || PAROLE.campanello.test(parole(voce, states))),
    ) ||
    elenco.find(
      (voce) => dominioDi(voce) === "binary_sensor" && PAROLE.campanello.test(parole(voce, states)),
    ) ||
    elenco.find(
      (voce) =>
        dominioDi(voce) === "binary_sensor" &&
        ["occupancy", "sound"].includes(classeDi(voce, states)),
    );
  const telecamera = elenco.find((voce) => dominioDi(voce) === "camera");
  return {
    ...normalizzaCitofono(precedente, indice),
    nome: clean(precedente.nome) || clean(device.name),
    apri: clean(apri?.entity_id) || clean(precedente.apri),
    campanello: clean(campanello?.entity_id) || clean(precedente.campanello),
    telecamera: clean(telecamera?.entity_id) || clean(precedente.telecamera),
  };
}

/** Le caselle di una cassetta della posta, da quel dispositivo. */
export function bindCassettaToDevice({
  device = {},
  entities = [],
  states = {},
  indice = 0,
  precedente = {},
} = {}) {
  const elenco = utilizzabili(entities);
  const posta =
    elenco.find(
      (voce) =>
        dominioDi(voce) === "binary_sensor" &&
        ["motion", "occupancy"].includes(classeDi(voce, states)),
    ) ||
    elenco.find(
      (voce) => dominioDi(voce) === "binary_sensor" && PAROLE.posta.test(parole(voce, states)),
    );
  const ritiro =
    elenco.find(
      (voce) => dominioDi(voce) === "sensor" && classeDi(voce, states) === "illuminance",
    ) ||
    elenco.find(
      (voce) =>
        (dominioDi(voce) === "sensor" || dominioDi(voce) === "binary_sensor") &&
        PAROLE.ritiro.test(parole(voce, states)),
    );
  const contatore = elenco.find(
    (voce) =>
      (dominioDi(voce) === "counter" || dominioDi(voce) === "sensor") &&
      PAROLE.contatore.test(parole(voce, states)),
  );
  return {
    ...normalizzaCassetta(precedente, indice),
    nome: clean(precedente.nome) || clean(device.name),
    posta: clean(posta?.entity_id) || clean(precedente.posta),
    ritiro: clean(ritiro?.entity_id) || clean(precedente.ritiro),
    contatore: clean(contatore?.entity_id) || clean(precedente.contatore),
  };
}
