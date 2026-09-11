/* Il codice che si digita su un tastierino, e la regola per confrontarlo.
 *
 * In plancia i codici si chiedono in tre posti: la centrale d'allarme vera
 * (che il codice lo dichiara lei, con `code_format`), le aperture della
 * Sicurezza — portone, cancello — e i tasti d'inserimento su misura di chi una
 * centrale non ce l'ha (#336, #413). Sono tre porte diverse sullo stesso
 * gesto, e la regola del codice deve essere una sola: se sta scritta in tre
 * posti, un giorno due di quei posti accettano codici che il terzo rifiuta.
 *
 * Quattro-otto cifre: quattro perche' e' il tastierino piu' corto che esista,
 * otto perche' e' quello che la centrale di Home Assistant accetta. Niente
 * spazi, niente lettere — su un tastierino a dieci tasti non si scrivono.
 *
 * Un codice che non rispetta la regola vale come nessun codice: non e' un
 * errore da lanciare, e' una casella lasciata a meta'. Chi vuole correggere
 * chi scrive lo fa dove si scrive — nella scheda, col messaggio — non qui,
 * dove si decide se una porta si apre.
 *
 * Niente DOM e niente stato: due funzioni pure.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Il codice ripulito, o `""` se non e' un codice: quattro-otto cifre. */
export function normalizzaIlCodice(valore) {
  const codice = pulito(valore);
  return /^\d{4,8}$/.test(codice) ? codice : "";
}

/** Se questo codice e' stato scritto davvero, e quindi va chiesto. */
export function ilCodiceServe(atteso) {
  return Boolean(normalizzaIlCodice(atteso));
}

/**
 * Il codice digitato apre?
 *
 * Senza un codice atteso si', sempre: una porta senza chiave non e' una porta
 * chiusa, ed e' la scelta di chi ha configurato — non un permesso concesso
 * qui.
 */
export function ilCodiceCombacia(atteso, digitato) {
  const giusto = normalizzaIlCodice(atteso);
  if (!giusto) return true;
  return pulito(digitato) === giusto;
}
