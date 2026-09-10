/* Le stampanti di casa (#469).
 *
 * «Volevo chiedere se c'era la possibilita' del controllo delle tv e
 * stampanti.»
 *
 * Della stampante non si vuole il controllo — non si stampa dalla plancia —
 * si vuole sapere due cose, e sempre le stesse due: se e' pronta, e quanto
 * inchiostro le resta. Sono le domande che uno si fa PRIMA di mandare in
 * stampa, e la risposta di solito arriva quando la stampante e' gia' ferma a
 * meta' foglio.
 *
 * Home Assistant quelle cose le sa gia': l'integrazione IPP, quelle HP e le
 * altre portano un'entita' per lo stato — `idle`, `printing`, `stopped` — e
 * un'entita' per ogni cartuccia, in percentuale. Il lavoro qui non e'
 * inventare niente: e' leggere quei dialetti e ridurli alla risposta.
 *
 * Le cartucce non si configurano a mano. Chi ha tre stampanti a colori
 * dovrebbe scrivere dodici entita', e sbagliarne una vuol dire una barra che
 * non c'e': si cercano da sole, partendo dal nome dell'entita' dello stato —
 * `sensor.laser_ufficio` porta a `sensor.laser_ufficio_nero` — e chi vuole
 * puo' comunque scriverle.
 *
 * E' puro: entrano la configurazione e gli stati, esce la lettura. Le parole
 * per dirlo a schermo stanno nella sezione.
 */

const pulito = (valore) => String(valore ?? "").trim();
const minuscolo = (valore) => pulito(valore).toLowerCase();

const chiave = (valore) =>
  pulito(valore)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** La casella in cui vivono le stampanti. */
export const CHIAVE_STAMPANTI = "cd_stampanti";

/* Un tetto: otto stampanti in una casa sono gia' un ufficio. */
export const MASSIMO_STAMPANTI = 8;

/* Gli stati con cui Home Assistant dice «non lo so». */
const STATI_MUTI = new Set(["", "unknown", "unavailable", "none"]);

/* I domini che possono dire com'e' messa una stampante: il sensore dello
 * stato (IPP, CUPS, HP) e il binario di chi dice solo acceso/spento. */
export const DOMINI_STAMPANTE = Object.freeze(["sensor", "binary_sensor"]);

/** Se questa e' un'entita' che puo' dire lo stato di una stampante. */
export function eEntitaDiStampante(valore) {
  const testo = minuscolo(valore);
  return DOMINI_STAMPANTE.some((dominio) => new RegExp(`^${dominio}\\.[a-z0-9_]+$`).test(testo));
}

/* Le parole con cui gli stati arrivano, in inglese e in italiano.
 *
 * `stopped` non vuol dire spenta: vuol dire ferma per un motivo — carta
 * finita, sportello aperto, inchiostro esaurito — ed e' l'unico stato per cui
 * vale la pena accendere una pastiglia rossa. */
const IN_STAMPA = /^(printing|processing|in stampa|stampa)$/;
const FERMA = /^(stopped|error|jam|paused|offline|fermata|errore)$/;
const PRONTA = /^(idle|ready|on|home|pronta|standby)$/;

/** In che stato e' la stampante, in una parola sola. */
export function statoDellaStampante(grezzo) {
  const testo = minuscolo(grezzo);
  if (STATI_MUTI.has(testo)) return "muta";
  if (IN_STAMPA.test(testo)) return "stampa";
  if (FERMA.test(testo)) return "ferma";
  if (PRONTA.test(testo)) return "pronta";
  if (testo === "off") return "spenta";
  /* Uno stato che non conosciamo non e' un errore: e' una stampante che parla
   * un dialetto suo, e la sua parola si dice com'e'. */
  return "altro";
}

/* Il colore di una cartuccia, dal suo nome. Sono i colori veri delle
 * cartucce, non una tinta scelta qui: chi guarda la barra riconosce prima il
 * colore del nome. */
const COLORI = Object.freeze([
  [/\b(nero|black|k)\b/, "#0f2942"],
  [/\b(ciano|cyan|c)\b/, "#06b6d4"],
  [/\b(magenta|m)\b/, "#d946ef"],
  [/\b(giallo|yellow|y)\b/, "#eab308"],
  [/\b(colore|colour|color|tricromia|tri-?color)\b/, "#0ea5e9"],
  [/\b(foto|photo)\b/, "#64748b"],
]);

/** Il colore di una cartuccia dal suo nome; l'accento se non si capisce. */
export function coloreDellaCartuccia(nome) {
  /* I punti e i trattini bassi contano come spazi: dentro
   * `sensor.hp_cyan_ink` la parola «cyan» c'e', ma per una regola sui confini
   * di parola non c'e' — l'underscore e' una lettera come le altre. */
  const testo = minuscolo(nome).replace(/[^a-z]+/g, " ");
  for (const [indizio, colore] of COLORI) if (indizio.test(testo)) return colore;
  return "#0ea5e9";
}

/* Come si riconosce l'entita' di una cartuccia: il nome lo dice, e l'unita' e'
 * la percentuale. Servono tutt'e due — `sensor.laser_pagine_nero_bianco`
 * conta i fogli, e non e' una cartuccia. */
const NOME_DI_CARTUCCIA =
  /(inchiostro|cartuccia|toner|ink|cartridge|marker|nero|black|ciano|cyan|magenta|giallo|yellow|colore|colour|color|tricrom)/;

function percentuale(stato) {
  const grezzo = pulito(stato?.state);
  if (STATI_MUTI.has(minuscolo(grezzo))) return null;
  const numero = Number(grezzo.replace(",", "."));
  if (!Number.isFinite(numero)) return null;
  return Math.min(100, Math.max(0, Math.round(numero)));
}

function nomeLeggibile(entity, stato) {
  const amichevole = pulito(stato?.attributes?.friendly_name);
  if (amichevole) return amichevole;
  const coda = pulito(entity).split(".")[1] || "";
  return coda.replaceAll("_", " ").replace(/^\p{Ll}/u, (lettera) => lettera.toUpperCase());
}

/* Il prefisso da cui cercare le cartucce: `sensor.laser_ufficio` cerca fra le
 * entita' che cominciano per `sensor.laser_ufficio_`. Il pezzo finale dello
 * stato si toglie — molte integrazioni chiamano il sensore dello stato
 * `..._stato` o `..._printer` — o non si troverebbe mai niente. */
function radiceDelNome(entity) {
  const coda = minuscolo(entity).split(".")[1] || "";
  return coda.replace(/_(stato|state|status|printer|stampante)$/, "");
}

/**
 * Le cartucce di una stampante, cercate da sole.
 *
 * Si guardano le entita' che cominciano come quella dello stato, hanno un nome
 * da cartuccia e un valore in percentuale. Chi le ha scritte a mano nella
 * configurazione vince: quelle sono la sua parola, queste sono un indovinello.
 */
export function cartucceTrovate(entity, states = {}) {
  const radice = radiceDelNome(entity);
  if (!radice) return [];
  const trovate = [];
  for (const [id, stato] of Object.entries(states || {})) {
    const nome = minuscolo(id);
    if (!nome.startsWith(`sensor.${radice}`)) continue;
    if (nome === minuscolo(entity)) continue;
    const unita = minuscolo(stato?.attributes?.unit_of_measurement);
    const leggibile = `${nome} ${minuscolo(stato?.attributes?.friendly_name)}`;
    if (unita !== "%" || !NOME_DI_CARTUCCIA.test(leggibile)) continue;
    trovate.push(id);
  }
  return trovate.sort();
}

/** Una cartuccia letta: nome, quanta ne resta, di che colore e' e se e' agli sgoccioli. */
export function letturaDellaCartuccia(entity, states = {}) {
  const stato = states?.[entity] || null;
  const quanta = percentuale(stato);
  const nome = nomeLeggibile(entity, stato);
  return {
    entity,
    nome,
    quanta,
    colore: coloreDellaCartuccia(`${entity} ${nome}`),
    /* Sotto il dieci per cento una cartuccia non finisce domani: finisce a
     * meta' del documento che stai per mandare. */
    agliSgoccioli: quanta !== null && quanta <= 10,
    scarsa: quanta !== null && quanta <= 25,
  };
}

function normalizzata(voce, indice) {
  const entity = pulito(voce?.entity || voce?.entita || voce?.entity_id);
  const nome = pulito(voce?.nome || voce?.name);
  const cartucce = Array.isArray(voce?.cartucce) ? voce.cartucce.map(pulito).filter(Boolean) : [];
  return {
    id: pulito(voce?.id) || `stampante-${chiave(nome || entity) || indice + 1}`,
    nome,
    entity,
    cartucce,
    pagine: pulito(voce?.pagine),
    stanza: pulito(voce?.stanza || voce?.room_id),
  };
}

/** L'elenco delle stampanti configurate, in ordine e senza doppioni. */
export function normalizzaStampanti(stored) {
  const grezze = Array.isArray(stored) ? stored : Array.isArray(stored?.righe) ? stored.righe : [];
  const viste = new Set();
  const righe = [];
  for (const voce of grezze) {
    const riga = normalizzata(voce, righe.length);
    if (!riga.entity || viste.has(riga.entity)) continue;
    viste.add(riga.entity);
    righe.push(riga);
    if (righe.length >= MASSIMO_STAMPANTI) break;
  }
  return righe;
}

/**
 * Le righe come stanno scritte, comprese quelle a meta'.
 *
 * `normalizzaStampanti` butta le righe senza entita', ed e' giusto: una riga
 * cosi' non ha niente da dire alla pagina. La scheda pero' comincia SEMPRE da
 * una riga vuota — la si aggiunge e poi ci si scrive dentro — e se la buttasse
 * il tasto «Aggiungi» non farebbe niente. Questa e' la stessa forma senza
 * quel filtro: la usa chi sta ancora scrivendo.
 */
export function bozzaDelleStampanti(stored) {
  const grezze = Array.isArray(stored) ? stored : Array.isArray(stored?.righe) ? stored.righe : [];
  return grezze.slice(0, MASSIMO_STAMPANTI).map((voce, indice) => normalizzata(voce, indice));
}

/** Le entita' che le stampanti guardano: serve al cancello degli stati. */
export function entitaDelleStampanti(stored, states = {}) {
  const elenco = [];
  for (const riga of normalizzaStampanti(stored)) {
    elenco.push(riga.entity);
    if (riga.pagine) elenco.push(riga.pagine);
    const cartucce = riga.cartucce.length ? riga.cartucce : cartucceTrovate(riga.entity, states);
    elenco.push(...cartucce);
  }
  return [...new Set(elenco.filter(Boolean))];
}

/** Cosa dice una stampante adesso. */
export function letturaDellaStampante(voce, states = {}, resolve = (valore) => valore) {
  const riga = normalizzata(voce, 0);
  let entity = riga.entity;
  try {
    entity = pulito(resolve(riga.entity)) || riga.entity;
  } catch (_errore) {
    entity = riga.entity;
  }
  const stato = states?.[entity] || states?.[riga.entity] || null;
  const grezzo = pulito(stato?.state);
  const quale = statoDellaStampante(grezzo);
  const scelte = riga.cartucce.length ? riga.cartucce : cartucceTrovate(entity, states);
  const cartucce = scelte.map((id) => letturaDellaCartuccia(id, states));
  const conValore = cartucce.filter((cartuccia) => cartuccia.quanta !== null);
  const pagineStato = riga.pagine ? states?.[riga.pagine] : null;
  const pagine = pagineStato ? percentualeLibera(pagineStato) : null;
  return {
    id: riga.id,
    entity,
    nome: riga.nome || nomeLeggibile(entity, stato),
    stanza: riga.stanza,
    stato: quale,
    /* La parola che ha detto la stampante: serve quando lo stato e' «altro»,
     * dove tradurlo sarebbe inventarselo. */
    parola: grezzo,
    /* Il perche' si e' fermata, quando l'integrazione lo dice: «carta finita»
     * risparmia il giro fino alla stampante. */
    motivo: pulito(stato?.attributes?.printer_state_message || stato?.attributes?.reason),
    muta: quale === "muta",
    stampa: quale === "stampa",
    ferma: quale === "ferma",
    cartucce,
    /* La cartuccia messa peggio: e' quella che decide se la stampante e'
     * pronta davvero, e quella che va scritta sulla tessera. */
    piuScarica: conValore.length
      ? conValore.reduce((peggio, voce2) => (voce2.quanta < peggio.quanta ? voce2 : peggio))
      : null,
    pagine,
  };
}

/* Le pagine stampate sono un numero, non una percentuale: si legge com'e'. */
function percentualeLibera(stato) {
  const grezzo = pulito(stato?.state);
  if (STATI_MUTI.has(minuscolo(grezzo))) return null;
  const numero = Number(grezzo.replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

/** Le letture di tutte le stampanti configurate. */
export function lettureDelleStampanti(stored, states = {}, resolve) {
  return normalizzaStampanti(stored).map((voce) => letturaDellaStampante(voce, states, resolve));
}

/**
 * Il riassunto per la tessera in Home.
 *
 * La tessera dice una cosa sola, e deve essere quella che fa alzare la testa:
 * una stampante ferma batte una cartuccia agli sgoccioli, che batte una che
 * sta stampando, che batte «tutte pronte».
 */
export function riassuntoDelleStampanti(letture = []) {
  const elenco = Array.isArray(letture) ? letture : [];
  const ferme = elenco.filter((voce) => voce.ferma);
  const sgoccioli = elenco.filter((voce) => voce.piuScarica?.agliSgoccioli);
  const stampano = elenco.filter((voce) => voce.stampa);
  const mute = elenco.filter((voce) => voce.muta);
  return {
    quante: elenco.length,
    ferme,
    sgoccioli,
    stampano,
    mute,
    /* Il verdetto in una parola: e' quello che colora la tessera. */
    verdetto: ferme.length
      ? "ferma"
      : sgoccioli.length
        ? "inchiostro"
        : stampano.length
          ? "stampa"
          : mute.length === elenco.length && elenco.length
            ? "muta"
            : "pronta",
  };
}

/** Se c'e' almeno una stampante da mostrare. */
export function stampantiConfigurate(stored) {
  return normalizzaStampanti(stored).length > 0;
}
