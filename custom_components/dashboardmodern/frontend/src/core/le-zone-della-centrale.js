/* Le zone e gli ingressi della centrale (#511).
 *
 * «Tutti i miei sensori di presenza sono riferiti alla centrale: magari
 * aprendo Sicurezza, dove leggo zone — sarebbero i sensori di presenza — e
 * dove leggo ingressi — sarebbero i varchi mappati dalla centrale.»
 *
 * E' il vocabolario di chi ha una centrale d'allarme vera: quello che la
 * plancia chiama «presenza» sul pannello si chiama ZONA, e quello che chiama
 * «varco» si chiama INGRESSO. Le due pagine esistono gia' e restano dove sono;
 * qui c'e' il modo di rivederle dalla parte della Sicurezza, che e' il posto da
 * cui uno guarda quando vuole sapere se puo' inserire l'antifurto.
 *
 * Non nasce nessun elenco nuovo. Le righe sono quelle che la Presenza e i
 * Varchi costruiscono gia' — stessi nomi, stessi stati, stesso conto — perche'
 * due elenchi della stessa casa sono il modo di far dire due numeri diversi
 * alle stesse porte. Qui si sceglie soltanto QUALI di quelle righe appartengono
 * a questa centrale.
 *
 * E la regola di appartenenza e' una sola, ed e' quella che fa funzionare la
 * cosa senza configurare niente: una centrale che non dichiara le sue zone le
 * ha TUTTE. Chi ha una centrale sola — che e' il caso della segnalazione — apre
 * Sicurezza e le trova li', senza aver toccato niente. Dichiararle serve a chi
 * ha due aree e vuole separarle.
 *
 * Il modulo e' puro: entrano le righe e una centrale, escono le righe che sono
 * sue.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Dove una centrale tiene le sue zone e i suoi ingressi. */
export const CAMPO_ZONE = "zone";
export const CAMPO_INGRESSI = "ingressi";

/**
 * L'elenco com'e' scritto, ripulito.
 *
 * Accetta l'array salvato e la stringa con le virgole del campo nascosto: e'
 * la stessa forma con cui viaggiano gli altri elenchi di entita' della
 * plancia, e chiederlo a ogni chiamante vorrebbe dire lo stesso `split`
 * scritto in tre posti.
 */
export function elencoDiEntita(scritto) {
  const grezzo = Array.isArray(scritto) ? scritto : pulito(scritto).split(",");
  const viste = new Set();
  const elenco = [];
  for (const voce of grezzo) {
    const id = pulito(typeof voce === "string" ? voce : voce?.entity || voce?.entity_id);
    if (!id || !id.includes(".") || viste.has(id)) continue;
    viste.add(id);
    elenco.push(id);
  }
  return elenco;
}

/** Le entita' che questa centrale dichiara come sue zone. */
export function zoneScritte(centrale = {}) {
  return elencoDiEntita(centrale?.[CAMPO_ZONE]);
}

/** Le entita' che questa centrale dichiara come suoi ingressi. */
export function ingressiScritti(centrale = {}) {
  return elencoDiEntita(centrale?.[CAMPO_INGRESSI]);
}

/* Chi appartiene a una centrale che non ha dichiarato niente: tutti.
 *
 * E' la riga che fa funzionare la segnalazione senza configurare niente, ed e'
 * anche l'unica risposta onesta: un elenco vuoto vuol dire «non l'ho detto»,
 * non «nessuno». Rispondere «nessuno» avrebbe mostrato una pagina Sicurezza
 * con due riquadri vuoti a chi ha la casa piena di sensori. */
function suoi(righe, scelte) {
  if (!scelte.length) return [...righe];
  const insieme = new Set(scelte);
  return righe.filter((riga) => insieme.has(pulito(riga?.entity)));
}

/**
 * Le zone di questa centrale: le righe della Presenza che le appartengono.
 *
 * `righe` sono quelle di `presenzaDiCasa`, gia' fatte e gia' ordinate.
 */
export function zoneDellaCentrale(righe = [], centrale = {}) {
  return suoi(Array.isArray(righe) ? righe : [], zoneScritte(centrale));
}

/** Gli ingressi di questa centrale: le righe dei Varchi che le appartengono. */
export function ingressiDellaCentrale(righe = [], centrale = {}) {
  return suoi(Array.isArray(righe) ? righe : [], ingressiScritti(centrale));
}

/**
 * La stessa centrale, con questa entita' dentro o fuori da un elenco.
 *
 * Non modifica l'originale, e un elenco che resta vuoto sparisce: una centrale
 * a cui non si e' dichiarato niente deve restare esattamente com'era, o la
 * regola del «vuoto vuol dire tutti» smetterebbe di valere per lei al primo
 * tocco dato e ritirato.
 */
export function conEntita(centrale = {}, campo, entity, dentro = true) {
  const id = pulito(entity);
  const chiave = campo === CAMPO_INGRESSI ? CAMPO_INGRESSI : CAMPO_ZONE;
  if (!id) return { ...centrale };
  const elenco = new Set(elencoDiEntita(centrale?.[chiave]));
  if (dentro) elenco.add(id);
  else elenco.delete(id);
  const prossima = { ...centrale };
  if (elenco.size) prossima[chiave] = [...elenco];
  else delete prossima[chiave];
  return prossima;
}

/**
 * Se vale la pena disegnare il riquadro: senza righe non si scrive niente.
 *
 * Un titolo «Zone» sopra il vuoto non dice che non ci sono zone, sembra che la
 * pagina si sia rotta.
 */
export function ceQualcosaDaMostrare(zone = [], ingressi = []) {
  return zone.length > 0 || ingressi.length > 0;
}
