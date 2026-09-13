/* Quali entità accendono la card, e quali no (#519, #520).
 *
 * «Fra le varie note di rilascio avevo letto che aggiunti esempio i sensori
 *  porta ad un frigo o un sensore ad un'asciugatrice o lavatrice la card
 *  diventava ambra per avvisare, ma sicuro non sarà un bug ma mi perdo io
 *  qualcosa.» (#519)
 *
 * «Dove si aggiungono i sensori nelle card elettrodomestici ci sarebbe modo di
 *  aggiungere un'opzione per scegliere se quell'entità fa colorare la card nei
 *  widget? Esempio: frigorifero, aggiunto sensore porta frigo o freezer
 *  (opzione colore sfondo se ON); lavatrice, aggiungo sensore fine ciclo
 *  (opzione colore sfondo se ON).» (#520)
 *
 * Sono la stessa cosa vista da due lati, e la prima non era un difetto: a
 * colorare la card c'era una casella sola, «Entità allarme/anomalia», e la
 * porta del frigo di proposito non ci passava — un frigo aperto per prendere
 * il latte non è un guasto, ed è per questo che la porta è una pastiglia. Solo
 * che «non è un guasto» non vuol dire «non me ne importa»: a chi ha il
 * congelatore in garage quella porta importa eccome, e a chi aspetta la
 * lavatrice importa il fine ciclo.
 *
 * Chi decide non è il codice, è chi ha la casa. Qui c'è l'elenco delle entità
 * che quella persona ha scelto, e la domanda «ce n'è una accesa?».
 *
 * Due regole, le stesse delle voci nascoste — è la stessa scheda, ed è la
 * stessa forma apposta:
 *
 *   · si scrive cio' che si SCEGLIE, non cio' che si esclude. Un apparecchio
 *     senza questo campo si comporta esattamente come prima, e nessuno si
 *     ritrova la casa piena di card accese per un aggiornamento;
 *   · si sceglie un'ENTITA', non un riquadro. La stessa entità può uscire fra
 *     le misure e fra gli stati, e vale in tutti e due i posti.
 *
 * Il modulo è puro: entrano un apparecchio e degli stati, esce una risposta.
 */

const clean = (valore) => String(valore ?? "").trim();

/** Il campo in cui l'apparecchio tiene le entità che lo accendono. */
export const CAMPO_COLORANO = "colorano";

/* Le parole con cui un'entità dice «adesso sì».
 *
 * Sono i dialetti che girano davvero: `on` dei binary_sensor, `open` dei
 * contatti e delle integrazioni che la porta la dichiarano a parole, e i nomi
 * che i sensori di problema si danno. È lo stesso elenco che usa l'allarme
 * dell'apparecchio, e sta qui perché adesso lo leggono in due: scriverlo due
 * volte vorrebbe dire due elenchi che un giorno si scollano, e allora la
 * stessa entità accende la card e non conta fra gli allarmi. */
const ACCESA = /^(on|problem|triggered|alert|alarm|fault|error|leak|open|opened)$/i;

/** Questo stato dice «adesso sì»? */
export function eAccesa(stato) {
  return ACCESA.test(clean(stato));
}

/**
 * L'elenco com'è scritto, ripulito.
 *
 * Accetta l'array salvato e anche la stringa con le virgole che arriva dal
 * campo nascosto della scheda: è la stessa forma con cui viaggiano le voci
 * nascoste, i comandi e le letture.
 */
export function elencoColorano(scritto) {
  const grezzo = Array.isArray(scritto) ? scritto : clean(scritto).split(",");
  const viste = new Set();
  const elenco = [];
  for (const voce of grezzo) {
    const id = clean(typeof voce === "string" ? voce : voce?.entity || voce?.entity_id);
    /* Un identificativo di Home Assistant ha sempre il punto: senza questa
     * riga una virgola di troppo diventa una voce vuota che non accende
     * niente e resta scritta per sempre nella configurazione. */
    if (!id || !id.includes(".") || viste.has(id)) continue;
    viste.add(id);
    elenco.push(id);
  }
  return elenco;
}

/** Le entità scelte da questo apparecchio, pronte da interrogare. */
export function vociCheColorano(apparecchio = {}) {
  return new Set(elencoColorano(apparecchio?.[CAMPO_COLORANO]));
}

/** Questa entità è stata scelta per accendere la card? */
export function coloraLaCard(apparecchio = {}, entity = "") {
  const id = clean(typeof entity === "string" ? entity : entity?.entity || entity?.entity_id);
  if (!id) return false;
  return vociCheColorano(apparecchio).has(id);
}

/**
 * Ce n'è una accesa adesso?
 *
 * Una scelta che non risponde non accende niente: «non lo so» non è «sì», e
 * una card accesa per un sensore muto sarebbe un avviso che non si può
 * chiudere perché non è mai cominciato.
 */
export function qualcosaColora(apparecchio = {}, states = {}) {
  for (const entity of vociCheColorano(apparecchio))
    if (eAccesa(states?.[entity]?.state)) return true;
  return false;
}

/**
 * Lo stesso apparecchio, con questa entità scelta o lasciata stare.
 *
 * Non modifica l'originale: la scheda lavora su una copia finché non si salva,
 * ed è così che «annulla» resta possibile.
 */
export function conVoceCheColora(apparecchio = {}, entity = "", colora = true) {
  const id = clean(entity);
  const scelte = vociCheColorano(apparecchio);
  if (!id || !id.includes(".")) return apparecchio;
  if (colora) scelte.add(id);
  else scelte.delete(id);
  return { ...apparecchio, [CAMPO_COLORANO]: [...scelte] };
}
