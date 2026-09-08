/* L'ordine dei blocchi della Home.
 *
 * «Riordinare a piacere la Home» voleva dire tre cose, e finora ne erano state
 * fatte due e mezzo: le tessere si riordinano, le persone si riordinano, le
 * azioni rapide si riordinano — ma sempre DENTRO il loro blocco. L'ordine dei
 * blocchi fra loro era scritto nel codice: prima le persone, poi i widget, poi
 * le azioni rapide, poi i dispositivi. Chi entra in casa e vuole i tasti per
 * primi non poteva averli.
 *
 * Qui c'e' solo la lista e come si mette in fila. Chi sposta i nodi nella
 * pagina sta altrove; questo si prova senza un documento.
 */

/* I blocchi che la Home sa spostare, nell'ordine in cui sono sempre stati.
 *
 * Le pastiglie di stato — caldaia accesa, antifurto inserito — non sono un
 * blocco: compaiono da sole quando hanno qualcosa da dire e stanno in cima
 * perche' sono un avviso. Metterle in fila con gli altri vorrebbe dire poterle
 * mandare in fondo, cioe' non vederle. */
export const BLOCCHI_DELLA_HOME = Object.freeze([
  "persone",
  /* Il flusso dell'energia (#415): «sulla home, accanto magari alle card delle
   * persone, un'immagine con il flusso dal fotovoltaico alla casa, dalla casa
   * alle batterie, dalla casa all'auto». Nasce li' perche' li' e' stato
   * chiesto, e da li' si sposta come tutti gli altri. */
  "flusso",
  "widget",
  "azioni",
  "dispositivi",
]);

const NOTI = new Set(BLOCCHI_DELLA_HOME);

/**
 * L'ordine da usare, ripulito da quello salvato.
 *
 * Regge tre cose che capitano davvero: un blocco scritto due volte, un nome
 * che non esiste piu' (una versione che toglie un blocco), e un blocco NUOVO
 * che nella configurazione salvata non c'e' ancora — quello va in coda al suo
 * posto di serie, non perso e non messo per primo.
 */
export function ordineDeiBlocchi(salvato) {
  const scritto = Array.isArray(salvato) ? salvato : [];
  const fila = [];
  for (const voce of scritto) {
    const nome = String(voce ?? "").trim();
    if (NOTI.has(nome) && !fila.includes(nome)) fila.push(nome);
  }
  for (const nome of BLOCCHI_DELLA_HOME) if (!fila.includes(nome)) fila.push(nome);
  return fila;
}

/** Se questo ordine e' gia' quello di serie: allora non c'e' niente da salvare. */
export function eLOrdineDiSerie(ordine) {
  const fila = ordineDeiBlocchi(ordine);
  return fila.every((nome, indice) => nome === BLOCCHI_DELLA_HOME[indice]);
}
