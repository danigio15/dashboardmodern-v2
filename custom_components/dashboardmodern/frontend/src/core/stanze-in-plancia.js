/* Le stanze in plancia (#493).
 *
 * «Have the option to display a block on the home screen — like a widget or a
 * quick action — showing the rooms or areas of the house (such as the garden,
 * garage, etc.). It should also be possible to choose which rooms or areas
 * appear on the home screen.»
 *
 * Le stanze la plancia le ha già tutte: la loro pagina, le loro entità, la
 * loro icona. Quello che non aveva è il pezzo di casa da cui si guarda senza
 * aprire niente — una fila di stanze in plancia, con dentro la temperatura e
 * quante luci sono accese, e il tocco che porta nella stanza.
 *
 * Quali si vedono lo sceglie chi ha la casa, ed è la seconda metà della
 * richiesta: una casa di dodici stanze non le vuole tutte in plancia, ne vuole
 * tre — il giardino, il garage, la camera dei bambini.
 *
 * Questo modulo decide chi entra e cosa dice; niente DOM e niente Home
 * Assistant, così si prova senza un browser davanti.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** La casella del magazzino: l'elenco degli id delle stanze da mostrare. */
export const CHIAVE_STANZE_IN_PLANCIA = "cd_home_stanze";

/* Quante ce ne stanno. Non è un limite alla casa: è un limite alla plancia,
 * che di stanze in fila ne regge poche prima di diventare un elenco — e un
 * elenco c'è già, ed è la pagina delle Stanze. */
export const STANZE_MASSIME = 8;

/** L'id con cui una stanza si riconosce, uguale a quello della sua pagina. */
export function idDellaStanza(stanza) {
  return pulito(stanza?.id) || pulito(stanza?.name);
}

/**
 * Le stanze scelte, nell'ordine in cui stanno nella configurazione delle
 * stanze — non in quello in cui sono state spuntate.
 *
 * È l'ordine che chi ha la casa ha già deciso una volta, e ritrovarlo diverso
 * in plancia vorrebbe dire due ordini da tenere a mente per la stessa cosa.
 * Un id che non esiste più — una stanza cancellata — sparisce da sé: non lo si
 * va a togliere dal magazzino, perché un elenco che si ripulisce da solo
 * mentre nessuno guarda è il modo in cui si perdono le configurazioni.
 */
export function stanzeInPlancia(scelte, stanze) {
  const volute = new Set(
    (Array.isArray(scelte) ? scelte : []).map((voce) => pulito(voce)).filter(Boolean),
  );
  if (!volute.size) return [];
  return (Array.isArray(stanze) ? stanze : [])
    .filter((stanza) => stanza && typeof stanza === "object")
    .filter((stanza) => volute.has(idDellaStanza(stanza)))
    .slice(0, STANZE_MASSIME);
}

/** Se questa stanza è fra quelle scelte. */
export function laStanzaSiVede(scelte, stanza) {
  const id = idDellaStanza(stanza);
  if (!id) return false;
  return (Array.isArray(scelte) ? scelte : []).map((voce) => pulito(voce)).includes(id);
}

/**
 * Quante, fra quelle scritte, una stanza ce l'hanno ancora.
 *
 * Senza l'elenco delle stanze si contano tutte, che è l'unica cosa che si può
 * dire. Con l'elenco davanti si contano solo quelle che esistono: un id
 * rimasto scritto dopo che la stanza è stata cancellata non occupa un posto in
 * plancia — `stanzeInPlancia` non lo trova e lo salta — e non deve occuparne
 * uno nel tetto. Chi ne aveva otto e ne cancellava una si ritrovava sette
 * stanze in plancia e il tetto pieno lo stesso: nessuna spunta nuova entrava
 * più, e la casella tornava indietro da sola senza dire perché.
 */
function quanteSiVedono(fila, stanze) {
  if (!Array.isArray(stanze)) return fila.length;
  const esistono = new Set(stanze.map((stanza) => idDellaStanza(stanza)).filter(Boolean));
  return fila.filter((voce) => esistono.has(voce)).length;
}

/**
 * L'elenco con una stanza accesa o spenta.
 *
 * Torna sempre un elenco nuovo: chi chiama lo scrive nel magazzino, e scrivere
 * l'oggetto che si è appena letto vuol dire non accorgersi del cambiamento.
 *
 * Le stanze di casa sono l'ultimo pezzo e si possono non passare: servono solo
 * a contare il tetto su quelle vere. Gli id orfani restano scritti — ripulirli
 * qui vorrebbe dire cancellare una configurazione mentre nessuno guarda, che è
 * la regola di `stanzeInPlancia` e vale anche qui.
 */
export function conLaStanza(scelte, stanza, accesa, stanze = null) {
  const id = idDellaStanza(stanza);
  const fila = (Array.isArray(scelte) ? scelte : []).map((voce) => pulito(voce)).filter(Boolean);
  if (!id) return fila;
  const senza = fila.filter((voce) => voce !== id);
  if (!accesa) return senza;
  if (quanteSiVedono(senza, stanze) >= STANZE_MASSIME) return senza;
  return [...senza, id];
}
