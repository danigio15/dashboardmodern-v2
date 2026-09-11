/* Le altre letture che stanno accanto a un dispositivo (#468, #451).
 *
 * «Sarebbe possibile aggiungere più valori tra quelli che mostra?» — di un
 * robot. E poi: «le TV dove vanno messe?», che è la stessa domanda con un
 * altro apparecchio davanti. Un robot pubblica quanto manca al filtro, quanto
 * alle spazzole, quanti metri quadri ha pulito; una TV il canale, la sorgente,
 * il volume, quanto consuma. Sono tutti li', accanto all'entita' principale, e
 * la scheda non li guardava.
 *
 * L'elenco di cosa mostrare non e' scritto qui dentro: i sensori cambiano da
 * un'integrazione all'altra e da un modello all'altro, e un elenco fisso
 * sarebbe giusto per un apparecchio e sbagliato per il prossimo. Chi configura
 * sceglie le sue letture; qui si dice quali entita' possono esserlo, quali si
 * riconoscono da sole perche' le hanno quasi tutti, e come si scrive il numero
 * che portano.
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
  /* Quelle di una TV (#451): il canale, la sorgente, cosa sta facendo, il
   * volume. Un robot non ha un canale e una TV non ha una spazzola: un
   * dizionario piu' largo non confonde nessuno, e la plancia riconosce le
   * letture di tutt'e due senza due elenchi da tenere allineati. */
  { chiave: "canale", disegno: "tv", re: /\b(canale|channel)\b/ },
  { chiave: "sorgente", disegno: "sliders", re: /\b(sorgente|source|input)\b/ },
  { chiave: "riproduzione", disegno: "play", re: /\b(playback|riproduzione|media status)\b/ },
  { chiave: "volume", disegno: "speaker", re: /\b(volume)\b/ },
  {
    chiave: "quante",
    disegno: "list",
    re: /\b(pulizie|cleanings|clean count|cleaning count|conteggio)\b/,
  },
  { chiave: "area", disegno: "clean", re: /\b(area|superficie|mq)\b/ },
  { chiave: "durata", disegno: "timer", re: /\b(durata|duration|tempo|time)\b/ },
  /* Il consumo si riconosce ma non si sceglie da solo.
   *
   * Una TV di SmartThings pubblica sette sensori fra energia e potenza —
   * `energy`, `powerenergy`, `deltaenergy`, `energy_meter`, `energysaved`,
   * `power`, `power_meter` — e metterli tutti su una scheda vorrebbe dire una
   * scheda fatta di consumi. Chi ne vuole uno lo sceglie, e quello che sceglie
   * porta il suo disegno; il posto dei consumi restano Carichi ed Energia. */
  {
    chiave: "energia",
    disegno: "power",
    soloAMano: true,
    re: /\b(energia|energy|potenza|power|consumo|kwh)\b/,
  },
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
/* «m» qui non c'e', ed e' voluto: in Home Assistant «m» sono i metri, e nella
 * plancia lo sono dappertutto. Un sensore di distanza scelto a mano — «50 m» —
 * finiva scritto «50 min». I minuti si dichiarano «min», che e' quello che
 * scrivono le integrazioni quando parlano di tempo. */
const ORE = ["h", "ore", "hours", "hour", "ora"];
const MINUTI = ["min", "minuti", "minutes", "minute"];
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

/* I contatti che dicono se qualcosa e' aperto: sono i generi con cui Home
 * Assistant marca porte, finestre, portoni e aperture generiche. */
const APERTURE = new Set(["door", "garage_door", "window", "opening"]);

const SPENTO = new Set(["unavailable", "unknown", "none", ""]);

/**
 * Una lettura, come si legge adesso.
 *
 * `testo` e' quello che va sulla scheda; `valore` il numero che c'era sotto,
 * per chi volesse farci altro. Un sensore che non risponde non scrive uno
 * zero: scrive il trattino, che e' la verita'.
 */
export function letturaDelDispositivo(entity, dispositivo = {}, states = {}, lingua = getLocale()) {
  const voce = clean(entity);
  const corrente = states?.[voce];
  const grezzo = clean(corrente?.state);
  const attributi = corrente?.attributes || {};
  const unita = clean(attributi.unit_of_measurement);
  const nota = letturaNota(voce, states);
  const base = {
    entity: voce,
    name: nomeAccantoAlDispositivo(voce, dispositivo, states),
    disegno: nota?.disegno || "",
    chiave: nota?.chiave || "",
    unita,
  };
  if (!corrente || SPENTO.has(grezzo.toLowerCase()))
    return { ...base, available: false, valore: null, testo: "—" };
  /* Un binary_sensor dice si' o no, e «on» non e' una risposta.
   *
   * Su un contatto pero' nemmeno «si'» lo e': un sensore sulla porta del
   * congelatore che scrive «Sì» non ha risposto alla domanda che gli si fa
   * (#471, «utilizzo dei sensori zigbee su entrambe le porte»). Quando Home
   * Assistant dichiara che quel contatto e' un'apertura, si dice aperta o
   * chiusa — che e' la stessa parola che la plancia usa nei Varchi. Per tutti
   * gli altri generi resta il si' e il no, che e' la verita' che si sa. */
  if (voce.startsWith("binary_sensor.")) {
    const acceso = grezzo.toLowerCase() === "on";
    if (APERTURE.has(clean(attributi.device_class).toLowerCase()))
      return {
        ...base,
        available: true,
        valore: null,
        testo: acceso ? pick("Aperta", "Open", lingua) : pick("Chiusa", "Closed", lingua),
      };
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

/** Le letture di un dispositivo adesso, nell'ordine in cui sono state scelte. */
export function lettureDelDispositivo(dispositivo = {}, states = {}, lingua = getLocale()) {
  return elencoLetture(dispositivo?.letture).map((entity) =>
    letturaDelDispositivo(entity, dispositivo, states, lingua),
  );
}

/* Le entita' che la scheda mostra gia' da un'altra parte.
 *
 * L'entita' principale, la batteria, le mappe: riproporle fra le letture
 * sarebbe la stessa cosa scritta due volte. Una sezione che quei campi non li
 * ha — un lettore non ha mappe — semplicemente non ne porta nessuno. */
function giaInUso(dispositivo = {}) {
  const usate = new Set([clean(dispositivo?.entity), clean(dispositivo?.battery)].filter(Boolean));
  for (const mappa of Array.isArray(dispositivo?.mappe) ? dispositivo.mappe : [])
    usate.add(clean(mappa));
  const mappa = clean(dispositivo?.mapEntity);
  if (mappa) usate.add(mappa);
  for (const comando of Array.isArray(dispositivo?.comandi) ? dispositivo.comandi : [])
    usate.add(clean(comando));
  return usate;
}

/* Le letture che stanno accanto a quel dispositivo, da proporre a chi configura.
 *
 * Si riconoscono come i comandi: l'id comincia con l'id dell'entita'
 * principale, oppure il nome comincia col suo nome. Davanti quelle che tutti
 * hanno — filtro, spazzole, canale, sorgente, volume — nell'ordine in cui sono
 * scritte qui sopra; in fondo la diagnostica, che si sceglie di rado ma si
 * puo' scegliere.
 */
export function lettureVicine(dispositivo = {}, states = {}, candidate = null) {
  const entity = clean(dispositivo?.entity);
  const gia = new Set(elencoLetture(dispositivo?.letture));
  const usate = giaInUso(dispositivo);
  const trovate = [];
  /* Quando si sa gia' quali entita' sono di quel dispositivo, si guardano
   * quelle e basta.
   *
   * Il menu delle integrazioni le sa dal registro di Home Assistant: e' l'elenco
   * esatto, e indovinarlo dal nome sbaglia in tutt'e due i versi — lascia fuori
   * una lettura che l'integrazione ha chiamato in un altro modo, e prende
   * dentro l'aiutante di qualcun altro che comincia uguale. Senza quell'elenco
   * — succede quando si guarda un dispositivo gia' configurato — si torna a
   * riconoscerlo dal nome, che e' l'unica cosa che resta. */
  if (Array.isArray(candidate)) {
    for (const grezzo of candidate) {
      const id = clean(grezzo);
      if (!id || gia.has(id) || usate.has(id) || !eUnaLettura(id)) continue;
      trovate.push(id);
    }
  } else {
    const radice = entity.split(".")[1] || "";
    if (!radice) return [];
    const nome = clean(states?.[entity]?.attributes?.friendly_name).toLowerCase();
    for (const [id, corrente] of Object.entries(states || {})) {
      if (gia.has(id) || usate.has(id) || !eUnaLettura(id)) continue;
      const oggetto = id.split(".")[1] || "";
      const suoNome = clean(corrente?.attributes?.friendly_name).toLowerCase();
      if (!oggetto.startsWith(`${radice}_`) && !(nome && suoNome.startsWith(`${nome} `))) continue;
      trovate.push(id);
    }
  }
  const rango = (id) => {
    if (DIAGNOSTICA.test(parole(id, states))) return LETTURE_NOTE.length + 1;
    const nota = letturaNota(id, states);
    return nota ? LETTURE_NOTE.indexOf(nota) : LETTURE_NOTE.length;
  };
  return trovate.sort((a, b) => rango(a) - rango(b) || a.localeCompare(b));
}

/**
 * Le letture che un dispositivo nato da un'integrazione porta con se'.
 *
 * Solo quelle che si riconoscono, e solo quelle che si scelgono da sole: la
 * diagnostica no, e nemmeno i consumi — chi li vuole se li aggiunge.
 */
export function lettureRiconosciute(dispositivo = {}, states = {}, candidate = null) {
  return elencoLetture(
    lettureVicine(dispositivo, states, candidate).filter((id) => {
      const nota = letturaNota(id, states);
      return nota && !nota.soloAMano && !DIAGNOSTICA.test(parole(id, states));
    }),
  );
}
