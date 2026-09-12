/* Quando la casa sta tirando troppo (#508).
 *
 * «Possibilità di avere un campo dove inserire un valore massimo di potenza
 * che fa colorare di color ambra o rosso la card per capire un sovraccarico.»
 *
 * Una tessera che dice «4,8 kW» non dice niente finche' non si sa quanto e'
 * tanto: tre chilowatt sono la sera di una casa con l'induzione accesa, e sono
 * il distacco del contatore in una casa da tre. Il numero che separa le due
 * cose lo sa solo chi abita li', quindi lo scrive lui.
 *
 * Due numeri e non uno: ambra e' «occhio», rossa e' «adesso salta». Chi ne
 * vuole uno solo ne scrive uno solo — l'altro resta vuoto e non colora niente.
 *
 * E si sceglie su COSA guardarli, perche' le due domande sono diverse:
 *
 *   · il CARICO DI CASA e' quanto stanno consumando gli apparecchi. E' la
 *     domanda di chi ha un fotovoltaico: la casa puo' tirare sei chilowatt
 *     senza che il contatore se ne accorga, perche' li sta facendo il sole;
 *   · il CARICO DI RETE e' quanto sta passando dal contatore. E' la domanda
 *     di chi teme il distacco, perche' il limite del contratto sta li' e non
 *     sul consumo.
 *
 * Della rete si guarda solo il PRELIEVO. Il verso negativo e' l'immissione —
 * sole che va fuori — e sei chilowatt regalati alla rete non sono un
 * sovraccarico: sono una bella giornata. Leggere il valore assoluto avrebbe
 * acceso il rosso a mezzogiorno d'agosto, che e' il momento in cui la casa sta
 * meglio di sempre.
 *
 * Il modulo e' puro: entrano la soglia come l'ha scritta chi abita la casa e
 * le letture gia' fatte, esce un verdetto. Niente DOM, niente Home Assistant.
 */

const clean = (valore) => String(valore ?? "").trim();

/* Dove si tiene la soglia. Non e' di questo dispositivo: chi ha un contatore
 * da tre chilowatt ce l'ha da tre anche guardando dal telefono, quindi viaggia
 * con la configurazione — come la soglia delle batterie e quella delle
 * tapparelle. */
export const SOGLIA_POTENZA_KEY = "cd_energia_soglia";

/** Su cosa si misura il sovraccarico. */
export const SORGENTE_CASA = "casa";
export const SORGENTE_RETE = "rete";

/** Il verdetto: in quiete, da tenere d'occhio, o oltre. */
export const LIVELLO_QUIETE = "quiete";
export const LIVELLO_AMBRA = "ambra";
export const LIVELLO_ROSSA = "rossa";

/* I due colori sono quelli che la segnalazione chiede per nome — ambra e
 * rosso — e sono gli stessi che la plancia usa gia' per «guarda» e «non va»:
 * l'ambra delle allerte, il rosso delle aperture. Una tavolozza sola. */
export const COLORE_AMBRA = "#f59e0b";
export const COLORE_ROSSA = "#dc2626";

/* Un numero scritto a mano.
 *
 * La virgola e' come si scrive un decimale in mezza Europa, e chi scrive
 * «3,3» non sta sbagliando: `Number("3,3")` invece e' `NaN`, e una soglia
 * NaN non colora niente senza dirlo a nessuno. Vuoto vuol dire «non l'ho
 * messa», e non zero: zero e' una soglia scritta, e vuol dire «qualunque
 * consumo e' troppo» — strano, ma e' una risposta, non un'assenza. */
function numero(scritto) {
  if (scritto === null || scritto === undefined || clean(scritto) === "") return null;
  const valore = Number(String(scritto).replace(",", "."));
  return Number.isFinite(valore) && valore >= 0 ? valore : null;
}

/**
 * La soglia com'e' salvata, riportata in forma.
 *
 * Accetta anche la stringa JSON che arriva dalla casella, perche' e' li' che
 * vive: chiedere a ogni chiamante di fare `JSON.parse` in un `try` vorrebbe
 * dire lo stesso `try` scritto in tre posti.
 */
export function sogliaDellaPotenza(grezzo) {
  let fonte = grezzo;
  if (typeof fonte === "string") {
    try {
      fonte = JSON.parse(fonte);
    } catch (_errore) {
      fonte = null;
    }
  }
  const base = fonte && typeof fonte === "object" && !Array.isArray(fonte) ? fonte : {};
  return {
    sorgente: clean(base.sorgente) === SORGENTE_RETE ? SORGENTE_RETE : SORGENTE_CASA,
    ambra: numero(base.ambra),
    rossa: numero(base.rossa),
  };
}

/** Se c'e' almeno un numero da confrontare. Senza, non si colora niente. */
export function sogliaScritta(soglia) {
  return soglia?.ambra != null || soglia?.rossa != null;
}

/**
 * I watt da sorvegliare, dalle letture di casa.
 *
 * `letture` e' quello che la plancia gia' sa — `{casa, rete}` in watt, con la
 * rete positiva quando si preleva. Non si legge nessun sensore qui: leggerlo
 * una seconda volta e' il modo di far dire due numeri diversi alla stessa
 * corrente, ed e' gia' successo (#435).
 */
export function wattDaSorvegliare(letture = {}, sorgente = SORGENTE_CASA) {
  const grezzo = sorgente === SORGENTE_RETE ? letture?.rete : letture?.casa;
  if (typeof grezzo !== "number" || !Number.isFinite(grezzo)) return null;
  /* Il prelievo, non lo scambio: l'immissione non e' un sovraccarico. */
  if (sorgente === SORGENTE_RETE) return Math.max(0, grezzo);
  return grezzo;
}

/**
 * Il verdetto sulla potenza di adesso.
 *
 * Sopra la soglia rossa e' rossa, sopra l'ambra e' ambra, «esattamente sopra»
 * conta come sopra — chi scrive 3300 vuol dire «da tremilatrecento in su ci
 * siamo». La rossa si guarda per prima, cosi' chi le ha scritte al contrario
 * — rossa piu' bassa dell'ambra, che non e' una configurazione sensata ma e'
 * una configurazione possibile — vede comunque il colore piu' grave e non
 * resta in ambra per sempre.
 *
 * @returns {{livello:string, watt:number|null, sorgente:string, limite:number|null}}
 */
export function livelloDellaPotenza(soglia, letture = {}) {
  const regola = sogliaDellaPotenza(soglia);
  const watt = wattDaSorvegliare(letture, regola.sorgente);
  const fermo = { livello: LIVELLO_QUIETE, watt, sorgente: regola.sorgente, limite: null };
  if (watt === null || !sogliaScritta(regola)) return fermo;
  if (regola.rossa != null && watt >= regola.rossa)
    return { livello: LIVELLO_ROSSA, watt, sorgente: regola.sorgente, limite: regola.rossa };
  if (regola.ambra != null && watt >= regola.ambra)
    return { livello: LIVELLO_AMBRA, watt, sorgente: regola.sorgente, limite: regola.ambra };
  return fermo;
}

/** Il colore di un verdetto, o `null` quando non c'e' niente da colorare. */
export function coloreDelLivello(livello) {
  if (livello === LIVELLO_ROSSA) return COLORE_ROSSA;
  if (livello === LIVELLO_AMBRA) return COLORE_AMBRA;
  return null;
}
