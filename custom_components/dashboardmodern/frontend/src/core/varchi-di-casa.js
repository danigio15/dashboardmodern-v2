/* I varchi di casa: quali contatti guardare, e come stanno (#367, #377).
 *
 * «In verde dovrebbe segnare i sensori contact chiusi e in rosso quelli
 * aperti … almeno a colpo d'occhio so quante finestre sono aperte in questo
 * momento» (#367).
 *
 * «Si potrebbe avere una sezione porte: c'e' gia' Finestre per le tapparelle,
 * ma porte sarebbe utile per notificare lo stato delle porte che hanno sensori,
 * magari che la card principale come per le luci mostri solo il numero di porte
 * aperte» (#377).
 *
 * Sono la stessa domanda, fatta da due persone: dei contatti porta-finestra si
 * vuole sapere quanti sono aperti adesso, e quali. Non e' la sezione Finestre —
 * quella governa le tapparelle, e ha un motore per comandarle — e non e'
 * «Apri porte/cancelli», che manda comandi a serrature e rele'. Qui non si
 * comanda niente: si guarda, ed e' proprio quello che serviva.
 *
 * Non c'e' niente da configurare per cominciare, come per il fumo e per
 * l'aria: un contatto lo dichiara Home Assistant col suo `device_class`, e chi
 * ne ha uno se lo ritrova. La configurazione serve solo a correggere quel
 * rilevamento — togliere il sensore del frigo che qualcuno ha etichettato
 * «door», aggiungere quello che nessuno ha etichettato, dare un nome piu'
 * chiaro di «Contact 4B» — ed e' la stessa forma della scheda dell'aria,
 * perche' e' lo stesso problema.
 *
 * Il verso girato lo dice `verso-aperture.js`, e il giudizio aperto/chiuso lo
 * dice `varchi-in-configurazione.js`: sono gia' scritti, e riscriverli qui
 * vorrebbe dire che prima o poi la pagina e la configurazione si
 * contraddicono.
 */

import { CLASSI_DEL_VARCO, comeStaIlVarco, eUnVarco } from "./varchi-in-configurazione.js";

const clean = (valore) => String(valore ?? "").trim();

/** Dove si scrive la configurazione dei varchi. */
export const CHIAVE_VARCHI = "cd_varchi";

/** Le classi che contano come varco: le stesse del rilevamento, non una copia. */
export { CLASSI_DEL_VARCO };

/* Le parole con cui Home Assistant chiama un varco, e il disegno che gli va
 * addosso. Un portone del garage non e' una finestra, e vederlo si capisce
 * prima di leggerlo. */
const DISEGNI = Object.freeze({
  door: "🚪",
  window: "🪟",
  garage_door: "🏚️",
  opening: "🚧",
});

/** Il disegno di un varco, dalla classe che Home Assistant gli ha dato. */
export function disegnoDelVarco(classe) {
  return DISEGNI[clean(classe)] || "🚪";
}

/**
 * La configurazione, ripulita.
 *
 * `escluse` e `aggiunte` sono elenchi di entita'; `nomi` e' il nome che si e'
 * voluto dare a un contatto quando quello dell'integrazione non dice niente.
 */
export function normalizzaVarchi(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const elenco = (valori) =>
    (Array.isArray(valori) ? valori : [])
      .map(clean)
      .filter((entity) => entity.includes("."))
      .filter((entity, indice, tutti) => tutti.indexOf(entity) === indice);
  const nomi = {};
  for (const [entity, nome] of Object.entries(
    dato.nomi && typeof dato.nomi === "object" ? dato.nomi : {},
  )) {
    const id = clean(entity);
    const scritto = clean(nome);
    if (id.includes(".") && scritto) nomi[id] = scritto;
  }
  return { escluse: elenco(dato.escluse), aggiunte: elenco(dato.aggiunte), nomi };
}

/**
 * Se questa entita' e' un varco di casa.
 *
 * Lo dice Home Assistant col `device_class`, e lo dice chi ha la casa: uno
 * escluso non e' un varco per questa plancia, uno aggiunto lo e' anche se
 * Home Assistant non lo dichiara.
 */
export function eUnVarcoDiCasa(entity, stato, config) {
  const id = clean(entity);
  const scelte = normalizzaVarchi(config);
  if (scelte.escluse.includes(id)) return false;
  if (scelte.aggiunte.includes(id)) return id.includes(".");
  return eUnVarco(id, stato);
}

/** Se c'e' qualcosa da mostrare: almeno un varco leggibile in casa. */
export function varchiConfigurati(states = {}, config) {
  return Object.entries(states || {}).some(([entity, stato]) =>
    eUnVarcoDiCasa(entity, stato, config),
  );
}

/**
 * I varchi di casa, letti: nome, classe, e come stanno.
 *
 * L'ordine e' quello che serve a chi guarda: prima gli aperti — sono la
 * risposta alla domanda — poi i muti, che sono una sorveglianza che manca, e
 * in fondo i chiusi, che sono la buona notizia. Dentro ogni gruppo, per nome.
 */
/* Quando questo varco ha cambiato stato l'ultima volta.
 *
 * `last_changed` e' l'ultimo cambio di STATO, che e' quello che serve:
 * `last_updated` si muove anche quando cambia solo un attributo, e direbbe
 * «aperta da un minuto» di una porta ferma da ieri. Torna `null` quando Home
 * Assistant non lo dice: una porta senza storia non e' una porta appena
 * aperta. */
export function istanteDelCambio(stato) {
  const quando = Date.parse(clean(stato?.last_changed) || clean(stato?.last_updated) || "");
  return Number.isFinite(quando) ? quando : null;
}

export function varchiDiCasa(states = {}, config, invertiti, nomeDi = (entity) => entity) {
  const scelte = normalizzaVarchi(config);
  const righe = [];
  for (const [entity, stato] of Object.entries(states || {})) {
    if (!eUnVarcoDiCasa(entity, stato, config)) continue;
    const classe = clean(stato?.attributes?.device_class) || "door";
    righe.push({
      entity,
      name: scelte.nomi[entity] || clean(nomeDi(entity)) || entity,
      classe,
      glifo: disegnoDelVarco(classe),
      stato: comeStaIlVarco(entity, stato, invertiti),
      /* Da quando sta cosi' (#406): «l'ultima apertura o cambio stato». Sotto
       * il nome c'era l'entity_id, che chi guarda la pagina non ha mai
       * chiesto — «volendo il nome del sensore potrebbe essere obsoleto». Qui
       * si porta l'istante grezzo di Home Assistant; a dirlo in parole ci
       * pensa chi disegna, che sa che lingua si parla. */
      da: istanteDelCambio(stato),
    });
  }
  const peso = (riga) => (riga.stato === "aperto" ? 0 : riga.stato === "" ? 1 : 2);
  return righe.sort((a, b) => peso(a) - peso(b) || a.name.localeCompare(b.name));
}

/**
 * Il conto: quanti aperti, quanti chiusi, quanti non rispondono.
 *
 * Chi non risponde non conta ne' fra gli aperti ne' fra i chiusi: contarlo
 * chiuso sarebbe una bugia tranquillizzante, ed e' la stessa regola con cui li
 * conta la configurazione.
 */
export function contoDeiVarchi(righe = []) {
  const tutte = Array.isArray(righe) ? righe : [];
  const aperti = tutte.filter((riga) => riga?.stato === "aperto");
  const muti = tutte.filter((riga) => !clean(riga?.stato));
  return {
    aperti: aperti.length,
    chiusi: tutte.length - aperti.length - muti.length,
    muti: muti.length,
    totale: tutte.length,
    nomi: aperti.map((riga) => clean(riga.name)).filter(Boolean),
  };
}

const UN_MINUTO = 60000;
const UNORA = 60 * UN_MINUTO;
const UN_GIORNO = 24 * UNORA;

/**
 * Fra quanto la scritta «da quanto» dira' un'altra cosa.
 *
 * La riga dice «Aperto da 5 minuti», e quel numero lo fa l'orologio, non lo
 * stato: finche' il contatto non si muove la plancia non ridisegna niente e il
 * «5 minuti» resta li'. Su una plancia appesa al muro resta li' per ore, ed e'
 * il genere di bugia che non si nota perche' sembra un dato.
 *
 * Qui si dice quando quella scritta cambia davvero — il minuto dopo, l'ora
 * dopo, il giorno dopo — cosi' chi disegna si sveglia una volta sola, al
 * momento giusto, invece di guardare l'orologio in continuazione.
 *
 * E' puro: l'istante di adesso arriva da fuori.
 */
export function quandoCambiaIlDaQuando(da, adesso) {
  if (!Number.isFinite(da) || !Number.isFinite(adesso)) return null;
  const passati = Math.max(0, adesso - da);
  if (passati < UNORA) return UN_MINUTO - (passati % UN_MINUTO);
  if (passati < UN_GIORNO) return UNORA - (passati % UNORA);
  return UN_GIORNO - (passati % UN_GIORNO);
}

/** Fra quanto la PRIMA delle righe cambiera' scritta, o `null` se nessuna. */
export function prossimoCambioDelDaQuando(righe = [], adesso = 0) {
  let minimo = null;
  for (const riga of Array.isArray(righe) ? righe : []) {
    const fra = quandoCambiaIlDaQuando(riga?.da, adesso);
    if (fra == null) continue;
    if (minimo == null || fra < minimo) minimo = fra;
  }
  return minimo;
}
