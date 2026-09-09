/* Fra quanto una scritta «da quanto» dirà un'altra cosa.
 *
 * La riga di una sezione dice «Aperto da 5 minuti», «Libero da 2 ore», e quel
 * numero lo fa l'orologio, non lo stato: finché il sensore non si muove la
 * plancia non ridisegna niente e il «5 minuti» resta lì. Su una plancia appesa
 * al muro resta lì per ore, ed è il genere di bugia che non si nota perché
 * sembra un dato.
 *
 * Qui si dice quando quella scritta cambia davvero — il minuto dopo, l'ora
 * dopo, il giorno dopo — così chi disegna si sveglia una volta sola, al momento
 * giusto, invece di guardare l'orologio in continuazione.
 *
 * Stava dentro `varchi-di-casa.js`, dove è servito per primo. Non è dei varchi:
 * è di chiunque scriva «da quanto», e adesso lo scrivono anche i rilevatori di
 * presenza (#432). Chiedere l'ora al modulo delle porte era il genere di
 * dipendenza che fra un anno fa domandare «ma perché la presenza dipende dai
 * varchi?».
 *
 * L'istante di adesso arriva sempre da fuori: qui dentro non si guarda mai
 * l'orologio, così chi prova questo modulo può dire lui che ora è.
 */
import { pick } from "./i18n.js";

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

/**
 * Quanto tempo, in parole: «appena adesso», «5 minuti», «2 ore», «3 giorni».
 *
 * Il numero sta SEMPRE fuori dalla frase da tradurre. `daQuanto` in
 * `racconto-tessera.js` componeva «da 5 minuti» e poi lo passava a tradurre:
 * quella chiave e' diversa per ogni minuto, e nessuna di quelle si trova in un
 * catalogo. Qui le parole sono quattro, fisse, e la cifra le sta accanto.
 *
 * La frase davanti — «Aperto da», «Libero da» — la mette chi chiama: cambia da
 * sezione a sezione, e una porta aperta non e' una stanza libera.
 */
export function quantoTempoInParole(minuti) {
  if (!Number.isFinite(minuti) || minuti < 1) return pick("appena adesso", "just now");
  if (minuti < 60) return `${Math.round(minuti)} ${pick("minuti", "minutes")}`;
  const ore = Math.floor(minuti / 60);
  if (ore < 24) return `${ore} ${pick("ore", "hours")}`;
  return `${Math.floor(ore / 24)} ${pick("giorni", "days")}`;
}
