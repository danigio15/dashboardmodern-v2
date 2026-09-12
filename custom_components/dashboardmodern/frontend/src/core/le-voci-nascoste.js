/* Quello che un apparecchio sa dire, e che non si vuole vedere (#512).
 *
 * «Negli elettrodomestici poter gestire, esempio negli stati o nei comandi,
 * cosa visualizzare o meno: ci sono cose che magari vengono rilevate ma alla
 * fine graficamente uno puo' non interessare.»
 *
 * Collegare un'integrazione porta dentro tutto quello che il dispositivo
 * pubblica, e un dispositivo moderno pubblica molto: la lavatrice dichiara il
 * programma e i giri, ma anche il numero di serie, la versione del firmware e
 * tre diagnostiche che a chi guarda la finestra non dicono niente. Rilevarle e'
 * giusto — sono davvero sue — mostrarle tutte non lo e'.
 *
 * Qui c'e' solo l'elenco di quelle che si e' scelto di non vedere, e la
 * domanda «questa si vede?». Due regole:
 *
 *   · si scrive cio' che si NASCONDE, non cio' che si mostra. Un apparecchio
 *     senza questo campo mostra tutto, che e' com'era prima e com'e' giusto che
 *     sia di serie; e un'entita' nuova che l'integrazione pubblica domani
 *     compare da sola, invece di restare invisibile perche' non era in un
 *     elenco scritto ieri;
 *   · si nasconde un'ENTITA', non un riquadro. La stessa entita' puo' uscire
 *     fra le misure e fra i comandi — un interruttore dice «acceso» ed e'
 *     anche il tasto — e chi la toglie la toglie da tutte e due: nasconderla
 *     in un posto e ritrovarla nell'altro sarebbe una scelta che non funziona.
 *
 * Il modulo e' puro: entrano un apparecchio e un identificativo, esce una
 * risposta. Niente DOM, niente Home Assistant.
 */

const clean = (valore) => String(valore ?? "").trim();

/** Il campo in cui l'apparecchio tiene cio' che non vuole mostrare. */
export const CAMPO_NASCOSTE = "nascoste";

/**
 * L'elenco com'e' scritto, ripulito.
 *
 * Accetta l'array salvato e anche la stringa con le virgole che arriva dal
 * campo nascosto della scheda: e' la stessa forma con cui viaggiano gli altri
 * comandi e le altre letture, e chiedere a chi chiama di distinguerle vorrebbe
 * dire lo stesso `split` scritto in tre posti.
 */
export function elencoNascoste(scritto) {
  const grezzo = Array.isArray(scritto) ? scritto : clean(scritto).split(",");
  const viste = new Set();
  const elenco = [];
  for (const voce of grezzo) {
    const id = clean(typeof voce === "string" ? voce : voce?.entity || voce?.entity_id);
    /* Un identificativo di Home Assistant ha sempre il punto. Senza questa
     * riga, una virgola di troppo diventava una voce vuota che non nasconde
     * niente e resta scritta per sempre nella configurazione. */
    if (!id || !id.includes(".") || viste.has(id)) continue;
    viste.add(id);
    elenco.push(id);
  }
  return elenco;
}

/** Le entita' nascoste di questo apparecchio, pronte da interrogare. */
export function vociNascoste(apparecchio = {}) {
  return new Set(elencoNascoste(apparecchio?.[CAMPO_NASCOSTE]));
}

/** Questa entita' si vede? Senza elenco, si vede tutto. */
export function siVede(apparecchio = {}, entity = "") {
  const id = clean(typeof entity === "string" ? entity : entity?.entity || entity?.entity_id);
  if (!id) return true;
  return !vociNascoste(apparecchio).has(id);
}

/**
 * Le sole voci che si vedono, da un elenco qualunque.
 *
 * `prendi` dice dove sta l'identificativo nella voce, perche' le liste della
 * finestra non hanno tutte la stessa forma — una misura ha `entity`, una voce
 * del dispositivo ha `entity_id`. Di serie si guardano tutte e due.
 */
export function soloQuelleViste(elenco = [], apparecchio = {}, prendi) {
  const nascoste = vociNascoste(apparecchio);
  if (!nascoste.size) return Array.isArray(elenco) ? [...elenco] : [];
  const identificativo =
    typeof prendi === "function"
      ? prendi
      : (voce) => (typeof voce === "string" ? voce : voce?.entity || voce?.entity_id);
  return (Array.isArray(elenco) ? elenco : []).filter(
    (voce) => !nascoste.has(clean(identificativo(voce))),
  );
}

/**
 * Lo stesso apparecchio, con questa entita' mostrata o nascosta.
 *
 * Non modifica l'originale: la scheda lavora su una copia finche' non si
 * salva, ed e' cosi' che «annulla» resta possibile.
 */
export function conVoce(apparecchio = {}, entity = "", mostrata = true) {
  const id = clean(entity);
  if (!id) return { ...apparecchio };
  const nascoste = vociNascoste(apparecchio);
  if (mostrata) nascoste.delete(id);
  else nascoste.add(id);
  const prossimo = { ...apparecchio };
  /* Un elenco vuoto non e' una configurazione: il campo se ne va, e
   * l'apparecchio torna esattamente com'era prima che qualcuno aprisse questa
   * scheda. E' la stessa regola degli altri comandi e delle altre letture. */
  if (nascoste.size) prossimo[CAMPO_NASCOSTE] = [...nascoste];
  else delete prossimo[CAMPO_NASCOSTE];
  return prossimo;
}
