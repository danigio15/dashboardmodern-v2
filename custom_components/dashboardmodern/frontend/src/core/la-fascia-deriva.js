/* La fascia sotto il meteo, quando le pastiglie non ci stanno.
 *
 * «La barra sotto al meteo deve essere su una riga: da smartphone, se non
 *  entra, la devi rendere scorrevole o che scorre lei automaticamente.»
 *
 * Era andata a capo per la #400 — «va oltre pagina a destra e devi scorrere
 * per vederle» — e quella obiezione era giusta: uno scorrimento orizzontale in
 * cima a una pagina che scorre in verticale non lo trova nessuno, e quello che
 * sta oltre il bordo destro è di fatto quello che non esiste.
 *
 * Torna su una riga, e l'obiezione cade per un'altra strada: non c'è più
 * niente da trovare, perché la fascia si muove da sola. Va fino al fondo,
 * torna, e così ogni pastiglia passa davanti senza che nessuno debba sapere
 * che si poteva trascinare.
 *
 * ── Perché qui c'è solo aritmetica, e nessun timer ──────────────────────────
 *
 * Il movimento lo fa un'animazione del foglio di stile, non un `setInterval`
 * che sposta lo scorrimento un pixel per volta. Sono la stessa cosa vista da
 * fuori e due cose diverse per la macchina: la prima la disegna il
 * compositore e non sveglia nessuno, la seconda è un risveglio ogni quaranta
 * millesimi finché la Home resta aperta. Questa plancia ha già avuto un giro
 * che scaldava un mini PC, e c'è una prova che tiene il conto di chi fa
 * polling: la fascia non deve entrarci.
 *
 * Al foglio serve una cosa sola che non può calcolare da sé — quanta strada
 * c'è da fare — e una che è meglio non lasciargli decidere: quanto tempo
 * metterci. Stanno qui.
 */

const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) ? n : 0;
};

/* Due pixel di tolleranza: gli scorrimenti frazionari — uno schermo a densità
 * due, un ingrandimento del browser — lasciano scarti sotto il pixel, e senza
 * tolleranza una fascia che ci sta tutta deriverebbe di mezzo pixel. */
const TOLLERANZA = 2;

/**
 * Quanti pixel di pastiglie restano fuori dal bordo: `0` se ci stanno tutte.
 *
 * È anche la condizione da cui la sezione capisce se c'è qualcosa da muovere:
 * su una casa tranquilla, con due voci, non si muove niente.
 */
export function spazioDaPercorrere({ scrollWidth, clientWidth } = {}) {
  const oltre = numero(scrollWidth) - numero(clientWidth);
  return oltre > TOLLERANZA ? Math.round(oltre) : 0;
}

/* Quanto ci mette a percorrerlo, a velocità costante.
 *
 * A velocità costante e non a durata costante, ed è la differenza fra una cosa
 * che si legge e una che non si legge: con una durata fissa, una fascia con
 * due pastiglie di troppo striscerebbe piano e una con sei sfreccerebbe. Sono
 * venticinque pixel al secondo, cioè il passo con cui si legge una parola
 * mentre passa.
 *
 * L'andata si ferma un attimo prima di tornare — lo fa la curva
 * dell'animazione — quindi la durata è quella del solo viaggio. */
const PIXEL_AL_SECONDO = 25;
const ALMENO = 4;
const AL_MASSIMO = 40;

/** La durata di un viaggio, in secondi, per quello spazio. */
export function durataDellaDeriva(spazio) {
  const strada = Math.max(0, numero(spazio));
  if (!strada) return 0;
  const secondi = strada / PIXEL_AL_SECONDO;
  return Math.round(Math.min(AL_MASSIMO, Math.max(ALMENO, secondi)) * 10) / 10;
}
