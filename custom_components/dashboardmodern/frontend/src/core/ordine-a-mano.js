/* Spostare una riga su e giu', in un elenco che l'ordine ce l'ha addosso.
 *
 * «Riordinare a piacere la Home»: le persone, le azioni rapide, le tessere.
 * Sono tre elenchi diversi, ma il gesto e' uno solo — la freccia in su scambia
 * questa riga con quella sopra — e scriverlo tre volte vorrebbe dire tre
 * occasioni di sbagliare l'ultimo elemento.
 *
 * L'ordine di questi elenchi e' la loro posizione: non c'e' un campo `order` da
 * ricalcolare, e va bene cosi' — un numero d'ordine accanto a una posizione
 * sono due verita' sulla stessa cosa, e prima o poi si contraddicono.
 *
 * Fuori dai bordi non si sposta niente e si torna l'elenco com'era: chi chiama
 * puo' confrontare per sapere se e' cambiato qualcosa, senza dover ricontrollare
 * gli indici da se'.
 */

/** L'elenco con la riga `indice` spostata di `passo` posti. */
export function spostaNellElenco(elenco, indice, passo = -1) {
  const lista = Array.isArray(elenco) ? [...elenco] : [];
  const da = Number(indice);
  const salto = Number(passo);
  if (!Number.isInteger(da) || da < 0 || da >= lista.length) return lista;
  if (!Number.isInteger(salto) || salto === 0) return lista;
  const a = da + salto;
  if (a < 0 || a >= lista.length) return lista;
  [lista[da], lista[a]] = [lista[a], lista[da]];
  return lista;
}

/** Se il gesto avrebbe effetto: serve a spegnere la freccia che non porta da nessuna parte. */
export function siPuoSpostare(elenco, indice, passo = -1) {
  const lunghezza = Array.isArray(elenco) ? elenco.length : 0;
  const da = Number(indice);
  const a = da + Number(passo);
  return Number.isInteger(da) && da >= 0 && da < lunghezza && a >= 0 && a < lunghezza;
}
