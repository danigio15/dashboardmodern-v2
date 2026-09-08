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
