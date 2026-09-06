/* Quando conviene aprire la finestra.
 *
 * «Aggiungere una soglia per l'umidita' oltre la quale suggerisce di aprire
 * la finestra per arieggiare» (#330). L'umidita' e' quella della STANZA: il
 * sensore che la stanza porta nella scheda Temperature, e che la finestra di
 * quella stanza legge da sola.
 *
 * Il dato di fuori — la stazione meteo — c'era come condizione: «si apre solo
 * se fuori e' piu' asciutto». Sembrava onesto ed era un vincolo in piu' che
 * spegneva tutto: chi non ha una stazione meteo mappata non vedeva mai il
 * consiglio, e la scheda gli chiedeva un sensore che non c'entra con le sue
 * finestre. «L'umidita' si prende SOLO da quella legata al sensore della
 * stanza, non fuori.» Adesso e' cosi': la stanza sopra la soglia fa comparire
 * il consiglio; il fuori, quando c'e', si dice accanto come informazione —
 * «fuori e' piu' umido» — e non decide niente.
 *
 * Qui dentro non si legge niente: si ricevono numeri e si risponde. Chi
 * disegna va a prendere l'umidita' della stanza e la soglia scritta.
 */

/** Dove la soglia di casa sta scritta, e quanto vale se non l'ha scritta nessuno. */
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
 * La soglia di UNA finestra: la sua, se l'ha scritta, altrimenti quella di
 * casa.
 *
 * «La percentuale deve stare sotto alla creazione della singola finestra e
 * legata a ogni finestra.» Il bagno vuole il cinquantacinque e la camera il
 * sessantacinque, e una soglia sola per tutta la casa era una delle due
 * sbagliata. La casella vuota vuol dire «come la casa»; zero, sulla riga,
 * spegne il consiglio per quella finestra sola.
 */
export function sogliaDellaFinestra(cover = {}, casa) {
  const propria = cover?.umidita;
  if (propria === null || propria === undefined || String(propria).trim() === "")
    return sogliaDellUmidita(casa);
  return sogliaDellUmidita(propria);
}

/**
 * Quello che si salva sulla riga da cio' che si e' scritto nella casella.
 *
 * Vuoto o non un numero: niente, cioe' «come la casa». Zero: zero, che spegne.
 * Un numero fuori scala si riporta dentro invece di buttarlo via in silenzio.
 */
export function umiditaDellaRiga(scritto) {
  const letto = numero(scritto);
  if (letto === null) return null;
  if (letto <= 0) return 0;
  return Math.round(Math.max(SOGLIA_MINIMA, Math.min(SOGLIA_MASSIMA, letto)));
}

/**
 * Il verdetto, con il motivo.
 *
 * Il motivo serve a chi disegna e a chi legge una prova rossa: «non l'ho detto
 * perche' non ho la misura» e «non l'ho detto perche' la stanza sta bene»
 * sono due silenzi diversi. Il fuori non decide: quando c'e' ed e' piu' umido
 * di dentro lo si dice (`fuoriPiuUmido`), perche' chi apre lo sappia.
 */
export function consiglioDiArieggiare({ dentro, fuori, soglia } = {}) {
  const stanza = numero(dentro);
  const esterna = numero(fuori);
  const quota = numero(soglia);
  const esito = {
    arieggia: false,
    dentro: stanza,
    fuori: esterna,
    soglia: quota,
    fuoriPiuUmido: false,
  };
  if (quota === null) return { ...esito, motivo: "senza-soglia" };
  if (stanza === null) return { ...esito, motivo: "senza-misura-dentro" };
  if (stanza <= quota) return { ...esito, motivo: "sotto-soglia" };
  const fuoriPiuUmido = esterna !== null && esterna >= stanza - MARGINE;
  return { ...esito, arieggia: true, fuoriPiuUmido, motivo: "conviene" };
}

/* Perche' il consiglio non compare mai.
 *
 * «La funzione umidita' stanza non funziona»: e non funzionava per forza,
 * perche' per comparire vuole tre cose insieme — la soglia, l'igrometro della
 * stanza, una finestra assegnata a quella stanza — e se ne manca una tace.
 * Tacere e' giusto, ma tacere senza dire perche' e' quello che fa sembrare
 * rotta una cosa che sta solo aspettando un dato.
 *
 * Qui si risponde alla domanda «cosa manca», in ordine di cosa si va a
 * sistemare prima. L'elenco vuoto vuol dire che c'e' tutto.
 */
export function cosaMancaPerArieggiare({
  soglia,
  stanzeConUmidita = 0,
  finestreInStanzaConUmidita = 0,
} = {}) {
  const mancanze = [];
  if (sogliaDellUmidita(soglia) === null) mancanze.push("soglia-spenta");
  if (!(stanzeConUmidita > 0)) mancanze.push("senza-igrometro-in-stanza");
  else if (!(finestreInStanzaConUmidita > 0)) mancanze.push("finestra-senza-stanza");
  return mancanze;
}
