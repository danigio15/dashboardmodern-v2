/* Le altre letture del robot (#468).
 *
 * «Sarebbe possibile aggiungere più valori tra quelli che mostra?» Un robot
 * pubblica molto piu' di quello che la scheda mostrava: quanto manca al
 * filtro, quanto alle spazzole, quanti metri quadri ha pulito, quante volte,
 * per quante ore. Erano tutti li', accanto al robot, e nessuno li guardava.
 *
 * L'elenco non e' scritto qui dentro: i sensori cambiano da un'integrazione
 * all'altra e da un modello all'altro, e un elenco fisso sarebbe giusto per
 * un robot e sbagliato per il prossimo. Chi configura sceglie le sue letture;
 * qui si dice quali entita' possono esserlo, quali si riconoscono da sole
 * perche' le hanno quasi tutti, e come si scrive il numero che portano.
 *
 * Il modulo e' puro: non parla con Home Assistant e non tocca il DOM.
 */

import { getLocale, pick } from "./i18n.js";
import { nomeAccantoAlDispositivo } from "./nome-accanto-al-dispositivo.js";
import { numero } from "./racconto-tessera.js";

const clean = (value) => String(value ?? "").trim();

/* Dieci: una scheda e' una scheda, come per i comandi. */
export const LETTURE_MASSIME = 10;

/* Cosa puo' essere una lettura: qualcosa che si legge. Un `button` non lo e' —
 * quello e' un comando, e ha gia' la sua riga. */
export const DOMINI_LETTURA = Object.freeze([
  "sensor",
  "binary_sensor",
  "number",
  "input_number",
  "input_text",
]);

/** Se quell'entita' e' una cosa che si legge. */
export function eUnaLettura(entity) {
  return DOMINI_LETTURA.includes(clean(entity).split(".")[0]);
}

/** L'elenco pulito: solo letture, una volta sola, non piu' di dieci. */
export function elencoLetture(input) {
  const grezzi = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[\s,;]+/)
      : [];
  const visti = new Set();
  const fuori = [];
  for (const voce of grezzi) {
    const entity = clean(voce && typeof voce === "object" ? voce.entity : voce);
    if (!entity || !eUnaLettura(entity) || visti.has(entity)) continue;
    visti.add(entity);
    fuori.push(entity);
    if (fuori.length >= LETTURE_MASSIME) break;
  }
  return fuori;
}

/* Le letture che hanno quasi tutti i robot.
 *
 * Non sono un elenco chiuso di cosa si puo' mostrare — quello lo decide chi
 * configura — ma di cosa si riconosce da solo: sono queste che la scheda
 * propone per prime e che il legame con l'integrazione sceglie senza chiedere.
 * L'ordine conta: «durata spazzola principale» e' una spazzola prima che una
 * durata, e va riconosciuta come tale o porterebbe l'icona sbagliata.
 */
export const LETTURE_NOTE = Object.freeze([
  {
    chiave: "principale",
    disegno: "broom",
    re: /\b(spazzola principale|main brush|brush life|spazzola)\b/,
  },
  { chiave: "laterale", disegno: "broom", re: /\b(spazzola laterale|side brush)\b/ },
  { chiave: "mocio", disegno: "water", re: /\b(mocio|mop|panno)\b/ },
  { chiave: "filtro", disegno: "wind", re: /\b(filtro|filter)\b/ },
  {
    chiave: "quante",
    disegno: "list",
    re: /\b(pulizie|cleanings|clean count|cleaning count|conteggio)\b/,
  },
  { chiave: "area", disegno: "clean", re: /\b(area|superficie|mq)\b/ },
  { chiave: "durata", disegno: "timer", re: /\b(durata|duration|tempo|time)\b/ },
]);

/* Quello che una lettura non e'.
 *
 * L'indirizzo IP e la potenza del wi-fi sono diagnostica: stanno accanto al
 * robot come tutto il resto, ma nessuno li vuole in mezzo ai metri quadri
 * puliti. La batteria e l'errore hanno gia' il loro posto sulla scheda, e
 * scriverli due volte sarebbe la stessa cosa detta due volte. Restano
 * scegliibili a mano — si propongono per ultimi, non si nascondono.
 */
const DIAGNOSTICA =
  /\b(ip|indirizzo ip|ssid|wi fi|wifi|rssi|segnale|signal|mac|firmware|versione|version|batteria|battery|errore|error|stato|state|update|aggiornamento)\b/;

/* Le parole di un'entita', tutte insieme e senza punteggiatura: l'id ha gli
 * underscore, il nome ha gli spazi, e le due cose vanno confrontate con lo
 * stesso metro. */
const parole = (entity, states) =>
  `${clean(entity)} ${clean(states?.[clean(entity)]?.attributes?.friendly_name)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Quale delle letture note e' questa — o niente, se e' una lettura sua. */
export function letturaNota(entity, states = {}) {
  const testo = parole(entity, states);
  return LETTURE_NOTE.find((nota) => nota.re.test(testo)) || null;
}

/** Il disegno di una lettura: quello della sua famiglia, o nessuno. */
export function disegnoDellaLettura(entity, states = {}) {
  return letturaNota(entity, states)?.disegno || "";
}

/* Un tempo scritto come si dice.
 *
 * Un filtro che dura 8100 minuti sono 135 ore, e nessuno pensa in minuti a
 * quella distanza. Sotto le due ore invece i minuti sono la misura giusta, e
 * tradurli in ore renderebbe illeggibile «45 min». La soglia e' quella: due
 * ore.
 */
const ORE = ["h", "ore", "hours", "hour", "ora"];
const MINUTI = ["min", "minuti", "minutes", "minute", "m"];
const SECONDI = ["s", "sec", "secondi", "seconds", "second"];

export function durataLeggibile(valore, unita, lingua = getLocale()) {
  const misura = clean(unita).toLowerCase();
  let minuti = null;
  if (MINUTI.includes(misura)) minuti = valore;
  else if (SECONDI.includes(misura)) minuti = valore / 60;
  else if (ORE.includes(misura)) minuti = valore * 60;
  else return null;
  if (Math.abs(minuti) < 120)
    return `${numero(minuti, Number.isInteger(minuti) ? 0 : 1, lingua)} ${pick("min", "min", lingua)}`;
  const ore = minuti / 60;
  return `${numero(ore, Math.abs(ore) >= 100 ? 0 : 1, lingua)} ${pick("h", "h", lingua)}`;
}

/* Quanti decimali vuole un numero.
 *
 * Cento e passa metri quadri non hanno virgole; due virgola tre metri quadri
 * si': la precisione che serve dipende da quanto e' grande il numero, non da
 * un decimale scelto una volta per tutte. Un intero resta intero. */
function decimaliPer(valore) {
  if (Number.isInteger(valore)) return 0;
  if (Math.abs(valore) >= 100) return 0;
  if (Math.abs(valore) >= 10) return 1;
  return 2;
}

const SPENTO = new Set(["unavailable", "unknown", "none", ""]);

/**
 * Una lettura, come si legge adesso.
 *
 * `testo` e' quello che va sulla scheda; `valore` il numero che c'era sotto,
 * per chi volesse farci altro. Un sensore che non risponde non scrive uno
 * zero: scrive il trattino, che e' la verita'.
 */
export function letturaDelRobot(entity, robot = {}, states = {}, lingua = getLocale()) {
  const voce = clean(entity);
  const corrente = states?.[voce];
  const grezzo = clean(corrente?.state);
  const attributi = corrente?.attributes || {};
  const unita = clean(attributi.unit_of_measurement);
  const nota = letturaNota(voce, states);
  const base = {
    entity: voce,
    name: nomeAccantoAlDispositivo(voce, robot, states),
    disegno: nota?.disegno || "",
    chiave: nota?.chiave || "",
    unita,
  };
  if (!corrente || SPENTO.has(grezzo.toLowerCase()))
    return { ...base, available: false, valore: null, testo: "—" };
  /* Un binary_sensor dice si' o no, e «on» non e' una risposta. */
  if (voce.startsWith("binary_sensor.")) {
    const acceso = grezzo.toLowerCase() === "on";
    return {
      ...base,
      available: true,
      valore: null,
      testo: acceso ? pick("Sì", "Yes", lingua) : pick("No", "No", lingua),
    };
  }
  const valore = Number.parseFloat(grezzo.replace(",", "."));
  if (!Number.isFinite(valore)) return { ...base, available: true, valore: null, testo: grezzo };
  const tempo = durataLeggibile(valore, unita, lingua);
  if (tempo) return { ...base, available: true, valore, testo: tempo };
  const scritto = numero(valore, decimaliPer(valore), lingua);
  return { ...base, available: true, valore, testo: unita ? `${scritto} ${unita}` : scritto };
}

/** Le letture di un robot come stanno adesso, nell'ordine in cui sono scelte. */
export function lettureDelRobot(robot = {}, states = {}, lingua = getLocale()) {
  return elencoLetture(robot?.letture).map((entity) =>
    letturaDelRobot(entity, robot, states, lingua),
  );
}

/* Le entita' del robot che non sono ne' comandi ne' gia' in uso altrove.
 *
 * Quelle che la scheda ha gia' — la batteria, la mappa, il robot stesso — non
 * si ripropongono: sarebbero la stessa cosa scritta due volte. */
function giaInUso(robot = {}) {
  const usate = new Set([clean(robot?.entity), clean(robot?.battery)].filter(Boolean));
  for (const mappa of Array.isArray(robot?.mappe) ? robot.mappe : []) usate.add(clean(mappa));
  const mappa = clean(robot?.mapEntity);
  if (mappa) usate.add(mappa);
  return usate;
}

/* Le letture che stanno accanto al robot, da proporre a chi configura.
 *
 * Si riconoscono come i comandi: l'id comincia con l'id del robot, oppure il
 * nome comincia col nome del robot. Davanti quelle che tutti hanno — filtro,
 * spazzole, area, durata — nell'ordine in cui sono scritte qui sopra; in fondo
 * la diagnostica, che si sceglie di rado ma si puo' scegliere.
 */
export function lettureSuggerite(robot = {}, states = {}) {
  const entity = clean(robot?.entity);
  const radice = entity.split(".")[1] || "";
  if (!radice) return [];
  const nome = clean(states?.[entity]?.attributes?.friendly_name).toLowerCase();
  const gia = new Set(elencoLetture(robot?.letture));
  const usate = giaInUso(robot);
  const trovate = [];
  for (const [id, corrente] of Object.entries(states || {})) {
    if (gia.has(id) || usate.has(id) || !eUnaLettura(id)) continue;
    const oggetto = id.split(".")[1] || "";
    const suoNome = clean(corrente?.attributes?.friendly_name).toLowerCase();
    if (!oggetto.startsWith(`${radice}_`) && !(nome && suoNome.startsWith(`${nome} `))) continue;
    trovate.push(id);
  }
  const rango = (id) => {
    if (DIAGNOSTICA.test(parole(id, states))) return LETTURE_NOTE.length + 1;
    const nota = letturaNota(id, states);
    return nota ? LETTURE_NOTE.indexOf(nota) : LETTURE_NOTE.length;
  };
  return trovate.sort((a, b) => rango(a) - rango(b) || a.localeCompare(b));
}

/**
 * Le letture che un robot nato da un'integrazione porta con se'.
 *
 * Solo quelle che si riconoscono: il filtro, le spazzole, il mocio, l'area,
 * le pulizie, la durata. La diagnostica no — chi la vuole se la aggiunge.
 */
export function lettureConsigliate(robot = {}, states = {}) {
  return elencoLetture(
    lettureSuggerite(robot, states).filter(
      (id) => letturaNota(id, states) && !DIAGNOSTICA.test(parole(id, states)),
    ),
  );
}
