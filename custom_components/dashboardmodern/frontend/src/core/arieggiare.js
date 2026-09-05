/* Quando conviene aprire la finestra.
 *
 * «Aggiungere una soglia per l'umidita' oltre la quale suggerisce di aprire
 * la finestra per arieggiare, ma solo se l'umidita' esterna e' piu' bassa di
 * quella della stanza» (#330).
 *
 * Le due condizioni sono una sola cosa, e la seconda e' quella che rende il
 * consiglio onesto: con il novanta per cento dentro e il novantacinque fuori,
 * aprire non asciuga niente — peggiora. Un igrometro da solo direbbe di aprire
 * lo stesso, ed e' esattamente il consiglio sbagliato di una giornata di
 * pioggia.
 *
 * Qui dentro non si legge niente: si ricevono tre numeri e si risponde. Chi
 * disegna va a prendere l'umidita' della stanza, quella della stazione meteo e
 * la soglia scritta in configurazione.
 */

/** Dove la soglia sta scritta, e quanto vale se non l'ha scritta nessuno. */
export const CHIAVE_SOGLIA_UMIDITA = "cd_umidita_soglia";

/* Sessanta: sopra questa quota l'aria di casa comincia a posarsi sui muri
 * freddi, ed e' la quota che le norme sulla ventilazione usano come confine
 * del comfort. Chi la vuole diversa la scrive. */
export const SOGLIA_PREDEFINITA = 60;

/* Sotto il trenta il consiglio non avrebbe senso — nessuna casa vive li' — e
 * sopra il novantacinque non scatterebbe mai. Fuori da questo intervallo la
 * soglia si considera non scritta. */
export const SOGLIA_MINIMA = 30;
export const SOGLIA_MASSIMA = 95;

/* Un punto di scarto non e' una differenza: due igrometri diversi nella stessa
 * aria danno numeri diversi di un punto. Sotto questo margine il fuori non e'
 * «piu' asciutto», e' solo un altro strumento. */
export const MARGINE = 2;

const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const letto = Number.parseFloat(String(valore).replace(",", "."));
  return Number.isFinite(letto) ? letto : null;
};

/**
 * La soglia scritta in configurazione, o quella di casa.
 *
 * Zero e i numeri fuori scala spengono il consiglio invece di farlo scattare
 * sempre: una soglia a zero vorrebbe dire «apri la finestra comunque», che non
 * e' un suggerimento, e' un rumore.
 */
export function sogliaDellUmidita(scritto) {
  const letto = numero(scritto);
  if (letto === null) return SOGLIA_PREDEFINITA;
  if (letto === 0) return null;
  if (letto < SOGLIA_MINIMA || letto > SOGLIA_MASSIMA) return null;
  return letto;
}

/**
 * Il verdetto, con il motivo.
 *
 * Il motivo serve a chi disegna e a chi legge una prova rossa: «non l'ho detto
 * perche' fuori e' piu' umido» e «non l'ho detto perche' non ho la misura»
 * sono due silenzi diversi, e confonderli e' come si finisce a suggerire di
 * aprire la finestra sotto la pioggia.
 */
export function consiglioDiArieggiare({ dentro, fuori, soglia } = {}) {
  const stanza = numero(dentro);
  const esterna = numero(fuori);
  const quota = numero(soglia);
  const esito = { arieggia: false, dentro: stanza, fuori: esterna, soglia: quota };
  if (quota === null) return { ...esito, motivo: "senza-soglia" };
  if (stanza === null) return { ...esito, motivo: "senza-misura-dentro" };
  if (stanza <= quota) return { ...esito, motivo: "sotto-soglia" };
  /* Senza il dato di fuori non si sa se aprire aiuta. Si tace: un consiglio
   * dato a meta' e' peggio di nessun consiglio, perche' sembra completo. */
  if (esterna === null) return { ...esito, motivo: "senza-misura-fuori" };
  if (esterna >= stanza - MARGINE) return { ...esito, motivo: "fuori-piu-umido" };
  return { ...esito, arieggia: true, motivo: "conviene" };
}
