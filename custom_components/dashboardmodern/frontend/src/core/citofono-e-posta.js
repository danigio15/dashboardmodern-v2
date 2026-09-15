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

/* Quando la posta e' stata ritirata, detto da chi l'ha ritirata (#536).
 *
 * «Vorrei che la gestione della posta sia gestita anche tramite sensore di
 * movimento nella cassetta e non solo tramite sensore porta.»
 *
 * Il rilevatore c'era gia' — la cassetta nasce intorno a un PIR — ma da solo
 * non bastava a gestirla: senza il sensore dello sportello non esiste il
 * momento del ritiro, e il verdetto reggeva solo finche' il PIR restava
 * acceso. Un PIR si spegne dopo trenta secondi: la posta arrivata alle nove
 * era gia' dimenticata alle nove e un minuto.
 *
 * Il momento del ritiro puo' dirlo una persona, e allora la regola non cambia
 * di una riga: restano due momenti da confrontare, e il piu' recente vince.
 * Viaggia fra i dispositivi perche' e' un fatto della casa — se la posta l'ho
 * presa io, l'ho presa anche per chi guarda dal tablet in cucina. */
export const CHIAVE_RITIRO_A_MANO = "cd_posta_ritirata";

/* Quando la posta e' arrivata, scritto la prima volta che si vede il
 * rilevatore acceso.
 *
 * Serve perche' `last_changed` di un rilevatore dice l'ULTIMO cambio, non
 * l'arrivo: quando il PIR si spegne dopo i suoi trenta secondi, quel momento
 * diventa piu' recente del ritiro appena dichiarato, e la cassetta tornerebbe
 * piena da sola. Il fronte di SALITA e' l'arrivo; quello di discesa non e'
 * niente. Si ricorda il primo e si ignora il secondo.
 *
 * Viaggia coi ritiri, e per lo stesso motivo: l'arrivo e' un fatto della casa.
 * La posta e' arrivata per tutti, non per il vetro che l'ha vista per primo. */
export const CHIAVE_ARRIVO_VISTO = "cd_posta_arrivata";

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
export function letturaDellaCassetta(
  voce = {},
  states = {},
  ritiriAMano = null,
  arriviVisti = null,
) {
  const conf = normalizzaCassetta(voce);
  const posta = conf.posta ? states?.[conf.posta] : null;
  const ritiro = conf.ritiro ? states?.[conf.ritiro] : null;
  /* Chi ha solo lo sportello (#564).
   *
   * «Non serve il sensore che si mette per l'apertura della cassetta della
   * posta»: chi aveva messo il solo contatto sullo sportello vedeva la parola
   * «Aperta» mentre lo sportello era aperto e «Non si sa» per tutto il resto
   * del tempo, senza nemmeno il tasto per dire «l'ho presa». Il sensore c'era
   * e non serviva a niente, ed era vero.
   *
   * La sezione e' nata intorno al Vallhorn — un rilevatore dentro che dice
   * «e' arrivato qualcosa» e un luxmetro che dice «lo sportello e' stato
   * aperto» — e il verdetto e' il confronto fra i due momenti. Con un
   * contatto solo quei due momenti sono lo stesso momento, e il confronto
   * dava sempre «pari», cioe' niente.
   *
   * Con un sensore solo l'unica cosa che si sa e' che qualcuno ha aperto lo
   * sportello: il postino che infila o chi ritira, e da fuori non si
   * distinguono. Allora quell'apertura vale come arrivo — «e' successo
   * qualcosa, guarda» — e a dire che e' finita e' la persona, col tasto che
   * c'e' gia'. E' come funziona una cassetta vera: la posta non se ne va da
   * sola, e chi l'ha presa lo sa. */
  const soloSportello = !conf.posta && Boolean(conf.ritiro);
  /* Acceso: il cambio che si vede E' l'arrivo, ed e' il piu' fresco che ci
   * sia. Spento: vale quello che ci si era segnati, perche' `last_changed`
   * adesso dice quando il rilevatore ha smesso — che non e' un arrivo. Chi
   * non ha ancora visto niente si tiene il cambio buono in mancanza d'altro:
   * e' quello che faceva prima, e senza ritiri dichiarati non sbaglia. */
  const visto = numero(arriviVisti?.[conf.id]);
  const arrivata = soloSportello
    ? quando(ritiro)
    : !conf.posta
      ? null
      : acceso(posta)
        ? quando(posta)
        : (visto ?? quando(posta));
  /* Il ritiro puo' dirlo lo sportello o puo' dirlo una persona: e' lo stesso
   * fatto, e conta il piu' recente dei due. Chi ha tutti e due i sensori non
   * si accorge di niente — il momento dichiarato, se non c'e', non esiste.
   *
   * Con il solo sportello lo dice la persona e basta: quel sensore adesso e'
   * l'arrivo, e non puo' essere anche il suo contrario. */
  const daSensore = soloSportello || !conf.ritiro ? null : quando(ritiro);
  const aMano = numero(ritiriAMano?.[conf.id]);
  const ritirata =
    daSensore === null ? aMano : aMano === null ? daSensore : Math.max(daSensore, aMano);
  const aperta = conf.ritiro ? apertaAdesso(ritiro, conf.soglia) : null;
  /* Chi porta la notizia: il rilevatore se c'e', altrimenti lo sportello. */
  const sorgente = conf.posta ? posta : soloSportello ? ritiro : null;
  const contatore = conf.contatore ? numero(states?.[conf.contatore]?.state) : null;
  return {
    id: conf.id,
    nome: conf.nome || clean(sorgente?.attributes?.friendly_name) || conf.posta || conf.ritiro,
    posta: conf.posta,
    ritiro: conf.ritiro,
    contatore,
    aperta,
    arrivata,
    ritirata,
    muta: Boolean(sorgente) && muto(sorgente),
    /* Se il ritiro l'ha detto una persona e non lo sportello: la pagina lo
     * scrive con parole sue, perche' «ultima apertura» sarebbe una bugia. */
    ritiroAMano: daSensore === null && aMano !== null,
    /* Con il solo sportello l'arrivo E' un'apertura, e la pagina lo scrive
     * cosi': «ultimo movimento» sarebbe il nome di un rilevatore che non c'e'. */
    daSportello: soloSportello,
    ce: cePosta({ sorgente, arrivata, ritirata, aperta }),
  };
}

/* Il verdetto: c'e' posta, non c'e', o non si sa.
 *
 * E' sempre un confronto fra due momenti: quando e' arrivato qualcosa, e
 * quando e' stato tolto. Chi li dice cambia — lo sportello che si apre, o la
 * persona che dice «l'ho presa» — ma la domanda e la regola sono le stesse.
 *
 * Restava scoperto il caso di chi ha il solo rilevatore (#536): «c'e'» valeva
 * finche' il rilevatore era acceso, e un PIR si spegne dopo trenta secondi,
 * quindi la posta arrivata alle nove era dimenticata alle nove e un minuto.
 * Adesso, quando il momento del ritiro puo' esistere, l'ultimo movimento vale
 * finche' qualcuno non dice di averla presa — che e' come funziona una
 * cassetta vera: la posta non se ne va da sola.
 *
 * Quello che non si fa, e non si e' mai fatto, e' inventare un «no»: senza un
 * sensore che porti la notizia, o con quel sensore muto, la risposta resta
 * «non si sa». Chi porta la notizia e' il rilevatore quando c'e'; chi ha solo
 * il contatto sullo sportello ha quello, e con un sensore solo un'apertura e'
 * l'unica notizia che esista (#564). */
function cePosta({ sorgente, arrivata, ritirata, aperta }) {
  if (!sorgente) return null;
  if (muto(sorgente)) return null;
  if (aperta === true) return false;
  /* Senza un arrivo da confrontare resta solo il presente: il sensore acceso
   * adesso dice «c'e'», spento non dice niente. */
  if (arrivata === null) return acceso(sorgente) ? true : null;
  /* Mai ritirata e mai svuotata: qualcosa si e' mosso e nessuno l'ha tolto. */
  if (ritirata === null) return true;
  /* Il confronto vale anche col rilevatore ancora acceso: chi dice «l'ho
   * presa» mentre il PIR e' ancora caldo l'ha presa davvero, e i suoi trenta
   * secondi residui non sono una seconda consegna. */
  return arrivata > ritirata;
}

/* Il registro degli arrivi aggiornato con quello che si vede adesso.
 *
 * Si scrive solo sul fronte di SALITA — rilevatore acceso — perche' e' l'unico
 * momento in cui `last_changed` significa «e' arrivato qualcosa». Torna la
 * stessa mappa quando non c'e' niente da aggiungere, cosi' chi la salva non
 * riscrive per niente. */
export function arriviDaRicordare(input = {}, states = {}, visti = null) {
  const conf = normalizzaIngresso(input);
  const prima = visti && typeof visti === "object" && !Array.isArray(visti) ? visti : {};
  let dopo = prima;
  for (const voce of conf.cassette) {
    const posta = voce.posta ? states?.[voce.posta] : null;
    if (!posta || !acceso(posta)) continue;
    const salita = quando(posta);
    if (salita === null || numero(prima[voce.id]) === salita) continue;
    if (dopo === prima) dopo = { ...prima };
    dopo[voce.id] = salita;
  }
  return dopo;
}

/** Tutto insieme, nell'ordine in cui la pagina lo disegna. */
export function lettureDellIngresso(
  input = {},
  states = {},
  ritiriAMano = null,
  arriviVisti = null,
) {
  const conf = normalizzaIngresso(input);
  return {
    citofoni: conf.citofoni.map((voce) => letturaDelCitofono(voce, states)),
    cassette: conf.cassette.map((voce) =>
      letturaDellaCassetta(voce, states, ritiriAMano, arriviVisti),
    ),
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
