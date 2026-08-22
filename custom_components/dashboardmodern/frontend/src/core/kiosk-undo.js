/* Come si disfa quello che la plancia scrive nel documento di Home Assistant.
 *
 * Il modo chiosco manda la plancia a tutto schermo, e per farlo scrive fuori
 * da se': blocca lo scorrimento del documento di Home Assistant, e toglie di
 * mezzo le proprieta' degli antenati che imprigionerebbero un velo fisso. Roba
 * di casa d'altri, che va tolta appena si lascia la plancia.
 *
 * A toglierla era chi l'aveva scritta — la plancia, dentro la sua cornice —
 * chiamata da chi smonta attraverso `frame.contentWindow`. Ma lo smontaggio
 * parte da `disconnectedCallback`, cioe' *dopo* che il pannello e la cornice
 * sono gia' stati staccati dal documento, e li' il contesto della cornice puo'
 * essere gia' finito: Chrome rimanda quella distruzione a un giro successivo e
 * la chiamata fa in tempo, WebKit la fa subito e la chiamata non arriva a
 * nessuno. Su iPhone erano le altre plance a restare sbiancate, e solo un
 * ricaricamento vero le rimetteva a posto — riaprire l'app riprende la stessa
 * pagina senza ricaricarla, quindi non bastava. Su Android non si vedeva, ed
 * e' esattamente la differenza fra i due motori.
 *
 * Qui l'annullamento smette di stare nella testa di qualcuno e si scrive
 * sull'elemento: chi smonta lo legge dal documento che ha davanti, e non deve
 * piu' parlare con una finestra che potrebbe non esserci piu'.
 *
 * Il modulo e' puro: guarda gli elementi che gli passano, non cerca niente da
 * solo. Lo leggono in due — la plancia dentro la cornice e chi la ospita — e
 * sono due programmi diversi, quindi non puo' portarsi dietro nient'altro.
 */

/** Dove un elemento tiene scritto com'era prima che lo toccassimo. */
export const UNDO_ATTR = "data-dm-kiosk-undo";

function leggiPromemoria(element) {
  let voci = [];
  try {
    voci = JSON.parse(element?.getAttribute?.(UNDO_ATTR) || "[]");
  } catch (_error) {}
  return Array.isArray(voci) ? voci : [];
}

/* Si accumula, e il primo valore visto vince: uno stesso elemento puo' essere
 * toccato da piu' punti — il velo, gli antenati, il blocco dello scorrimento —
 * e dal secondo in poi si rileggerebbe quello che ci abbiamo scritto noi. */
export function markUndo(element, prima) {
  if (!element?.setAttribute || !prima?.length) return false;
  const esistenti = leggiPromemoria(element);
  const viste = new Set(esistenti.map((voce) => voce?.nome));
  const unione = [...esistenti, ...prima.filter((voce) => voce && !viste.has(voce.nome))];
  try {
    element.setAttribute(UNDO_ATTR, JSON.stringify(unione));
  } catch (_error) {}
  return true;
}

/**
 * Rimette le dichiarazioni elencate e cancella il promemoria.
 *
 * Si rimette proprieta' per proprieta', mai riassegnando `cssText`: quello non
 * e' una proprieta' ma *tutte* le dichiarazioni in linea dell'elemento, e Home
 * Assistant il tema ce lo tiene esattamente li'.
 */
export function restoreDeclarations(element, prima = []) {
  if (!element?.style) return false;
  for (const { nome, valore, priorita } of prima) {
    if (!nome) continue;
    if (valore) element.style.setProperty(nome, valore, priorita || "");
    else element.style.removeProperty(nome);
  }
  element.removeAttribute?.(UNDO_ATTR);
  return true;
}

/* Cercare anche dentro le radici ombra.
 *
 * `querySelectorAll` si ferma al confine di una radice ombra, e Home Assistant
 * e' fatto di quelle: il velo del chiosco, per non restare imprigionato, va a
 * togliere `transform`, `filter` e compagnia proprio agli antenati che stanno
 * la' dentro. Fermarsi al documento avrebbe voluto dire rimettere a posto solo
 * `<html>` e `<body>` e lasciare modificato tutto il resto — cioe' fare meta'
 * pulizia e crederla finita.
 *
 * Si scende una radice per volta, e si tiene il conto di dove si e' gia'
 * passati: un pezzo di interfaccia puo' comparire da piu' parti, e senza il
 * conto si girerebbe in tondo. */
function raccogliMarcati(radice, viste, uscita, profondita = 0) {
  if (!radice || profondita > 50 || viste.has(radice)) return uscita;
  viste.add(radice);
  const diretti = radice.querySelectorAll?.(`[${UNDO_ATTR}]`);
  if (diretti?.length) uscita.push(...diretti);
  const tutti = radice.querySelectorAll?.("*");
  if (!tutti) return uscita;
  for (const nodo of tutti) {
    if (nodo.shadowRoot) raccogliMarcati(nodo.shadowRoot, viste, uscita, profondita + 1);
  }
  return uscita;
}

/**
 * Rimette a posto un documento leggendo solo lui.
 *
 * E' la strada che resta quando chi ha scritto non c'e' piu': non serve sapere
 * cosa era stato scritto, perche' c'e' scritto sull'elemento. Chiamarla due
 * volte non fa danno — la seconda non trova piu' niente da rimettere.
 *
 * Restituisce quanti elementi ha rimesso a posto.
 */
export function releaseMarkedElements(target, extraAttributes = []) {
  const nodi = raccogliMarcati(target, new Set(), []);
  if (!nodi.length) return 0;
  let rimessi = 0;
  for (const nodo of nodi) {
    restoreDeclarations(nodo, leggiPromemoria(nodo));
    for (const attributo of extraAttributes) nodo.removeAttribute?.(attributo);
    rimessi += 1;
  }
  return rimessi;
}
