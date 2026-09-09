/* Distinguere un tocco da uno scorrimento.
 *
 * «Quando sei in un menù pieno di entità, tipo le luci o le temperature,
 *  quando scorri con il dito oltre allo scorrere prende anche il comando.
 *  Sulle luci mentre passi con il dito per scorrere le accende pure.» (#397)
 *
 * La plancia comanda con il `click`, e di solito basta: un browser, dopo uno
 * scorrimento, il click non lo manda. «Di solito» pero' non e' «sempre» —
 * dipende dal motore, dal contenitore che scorre, da come e' finito il dito —
 * e il prezzo dello sbaglio non e' simmetrico: una pagina che non scorre la si
 * riprova, una luce accesa per sbaglio mentre si cercava un'altra cosa e' una
 * luce accesa in una stanza dove non c'e' nessuno.
 *
 * Il criterio e' quello che usa chiunque debba distinguere le due cose: quanto
 * si e' spostato il dito fra quando ha toccato e quando ha lasciato. Sotto una
 * certa distanza e' un tocco, sopra e' uno scorrimento. Non c'entra il tempo:
 * un dito appoggiato a lungo e fermo sta comunque toccando quella cosa li'.
 *
 * La distanza e' in pixel di CSS. Dodici e' abbastanza larga da perdonare la
 * mano che trema su un telefono in movimento, e abbastanza stretta da non
 * mangiarsi un tocco fermo: sotto i dodici pixel il dito non ha «tirato»
 * niente, e nemmeno la pagina si e' mossa in modo visibile.
 *
 * E' puro: guarda due punti e torna un giudizio. Chi ha gli eventi in mano —
 * la sezione — decide cosa farne.
 */

/** Oltre questi pixel il dito stava scorrendo, non toccando. */
export const SCARTO_DEL_TOCCO = 12;

/**
 * Oltre questi, il dito ha TIRATO: e non importa piu' se la pagina l'ha
 * seguito.
 *
 * Serve al bordo dello scorrimento. Un elenco gia' in fondo non ha piu' niente
 * da scorrere: le posizioni restano quelle, e la regola qui sotto — «e' un
 * tocco se niente si e' mosso» — direbbe tocco anche a una spazzata larga
 * mezzo schermo, riaccendendo la luce che #397 aveva smesso di accendere.
 *
 * Quaranta pixel stanno larghi sopra il pollice appoggiato che rulla (una
 * dozzina) e stretti sotto qualunque spazzata vera, che su un telefono e'
 * lunga come mezzo elenco. Fra i dodici e i quaranta decide la pagina; sopra i
 * quaranta decide il dito.
 */
export const SCARTO_DEL_TRASCINAMENTO = 40;

const numero = (valore) => (Number.isFinite(+valore) ? +valore : null);

/**
 * Quanto si e' spostato il dito fra due punti, o `null` se uno dei due manca.
 *
 * Si misura in diagonale e non asse per asse: chi scorre di traverso — succede
 * su ogni elenco che scorre in verticale dentro una pagina che scorre anche in
 * orizzontale — si sposta poco su ciascun asse e parecchio in totale.
 */
export function quantoSiEMosso(partenza, arrivo) {
  const x0 = numero(partenza?.x);
  const y0 = numero(partenza?.y);
  const x1 = numero(arrivo?.x);
  const y1 = numero(arrivo?.y);
  if (x0 === null || y0 === null || x1 === null || y1 === null) return null;
  return Math.hypot(x1 - x0, y1 - y0);
}

/**
 * Se fra questi due punti il dito stava scorrendo.
 *
 * Senza un punto di partenza la risposta e' no, e deve esserlo: un click che
 * arriva dalla tastiera, da uno screen reader o da `element.click()` non ha
 * nessun dito dietro, e rifiutarlo vorrebbe dire rompere la plancia per chi
 * non la tocca con le dita.
 */
export function stavaScorrendo(partenza, arrivo, scarto = SCARTO_DEL_TOCCO) {
  const distanza = quantoSiEMosso(partenza, arrivo);
  if (distanza === null) return false;
  return distanza > Math.max(0, Number(scarto) || 0);
}

/**
 * Se qualcosa si e' davvero mosso sotto il dito.
 *
 * «In alcuni casi lo switch non e' cliccabile.» La distanza da sola non basta
 * a dire che si stava scorrendo: su un bersaglio largo tutta la scheda — la
 * fascia verde che accende una sezione e' larga cosi' — il pollice appoggiato
 * rulla di una dozzina di pixel senza che nessuno abbia inteso scorrere, e il
 * comando finiva buttato via. Chi lo subiva ritoccava, e a volte funzionava:
 * «in alcuni casi», appunto.
 *
 * Il fatto che decide non e' quanto si e' mosso il dito: e' se la pagina si e'
 * mossa. Uno scorrimento sposta qualcosa — la finestra o il contenitore che
 * scorre — e un tocco no, per quanto la mano trabalzi. Si confrontano le
 * posizioni di scorrimento di prima e di adesso: se sono le stesse, non si
 * stava scorrendo, e il comando passa.
 *
 * Le posizioni arrivano gia' lette da chi ha il documento in mano: qui si
 * confrontano e basta.
 */
export function haScorsoDavvero(prima, adesso) {
  if (!prima || !adesso) return false;
  const chiavi = new Set([...Object.keys(prima), ...Object.keys(adesso)]);
  for (const chiave of chiavi) {
    const a = numero(prima[chiave]);
    const b = numero(adesso[chiave]);
    if (a === null || b === null) continue;
    if (a !== b) return true;
  }
  return false;
}

/**
 * Il giudizio intero: se questo click e' la coda di uno scorrimento.
 *
 * Mette insieme i due fatti, e sta qui perche' la regola e' una sola e chi ha
 * gli eventi in mano non deve ricomporla. Il dito dev'essersi mosso piu' del
 * tocco, e poi o la pagina l'ha seguito, o si e' mosso cosi' tanto che non
 * serve chiederlo.
 */
export function eraUnoScorrimento(partenza, arrivo, prima, adesso) {
  if (!stavaScorrendo(partenza, arrivo)) return false;
  if (haScorsoDavvero(prima, adesso)) return true;
  return stavaScorrendo(partenza, arrivo, SCARTO_DEL_TRASCINAMENTO);
}
