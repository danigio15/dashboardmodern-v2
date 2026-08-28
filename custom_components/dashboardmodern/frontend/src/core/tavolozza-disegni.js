/* La tavolozza dei disegni della plancia, in un posto solo.
 *
 * Gli elettrodomestici avevano gia' i loro disegni: fondo azzurro arrotondato,
 * scocca blu notte, frontale avorio, oblo' azzurro chiaro, un accento e i
 * tratti. Venti disegni fatti a mano, tutti della stessa famiglia.
 *
 * Tutto il resto no. Le azioni rapide, i carichi, le stanze nel selettore dei
 * carichi uscivano a emoji — quelle del sistema, che cambiano faccia da un
 * telefono all'altro e non c'entrano niente con la scocca blu notte accanto.
 * «Le icone non sono stilizzate nello stesso modo»: e' vero, ed erano tre stili
 * diversi nella stessa schermata.
 *
 * Qui stanno i colori e i tratti di quella famiglia, presi dal disegno degli
 * elettrodomestici e scritti una volta sola. Chi disegna una cosa nuova li
 * chiede a questo modulo: e' l'unico modo perche' fra sei mesi la
 * trentanovesima icona somigli ancora alla prima.
 *
 * Il riquadro e' 96 per 96, come quello degli elettrodomestici, cosi' un
 * disegno vale l'altro ovunque venga messo.
 */

/** Il fondo azzurro col riflesso, uguale per ogni disegno della famiglia. */
export const PANNELLO =
  '<rect class="dm-art-panel" x="3" y="3" width="90" height="90" rx="20" fill="#e0f2fe"/>' +
  '<path class="dm-art-highlight" fill="#ffffff" opacity=".75" d="M15 13h66a10 10 0 0 1 10 10v8C70 18 42 17 5 39V23A10 10 0 0 1 15 13Z"/>';

/** La scocca: il blu notte con cui e' fatto il corpo di ogni cosa. */
export const SCOCCA = 'fill="#0f2942"';
/** Il frontale avorio: sportelli, pannelli, superfici chiare. */
export const FRONTALE = 'fill="#f8fafc"';
/** L'azzurro chiaro degli oblo', dei vetri, dell'acqua. */
export const VETRO = 'fill="#8be2ff"';
/** L'accento: spie, tasti, la cosa che conta. */
export const ACCENTO = 'fill="#0ea5e9"';
/** Il grigio delle parti che non chiedono attenzione. */
export const SPENTO = 'fill="#94a3b8"';
/** Il tratto scuro, per i dettagli sopra il chiaro. */
export const TRATTO =
  'fill="none" stroke="#0f2942" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
/** Il tratto chiaro, per i dettagli sopra la scocca. */
export const TRATTO_CHIARO =
  'fill="none" stroke="#f8fafc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
/** Il tratto d'accento, quando il dettaglio e' la cosa che conta. */
export const TRATTO_ACCENTO =
  'fill="none" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';

/** Il giallo del caldo e della luce accesa: l'unica tinta fuori dalla scala. */
export const CALDO = 'fill="#fbbf24"';
/** Il verde di quello che cresce e di quello che va bene. */
export const VERDE = 'fill="#22c55e"';

/**
 * Il guscio SVG attorno a un disegno.
 *
 * @param {string} chiave  il nome del disegno, che finisce nel documento
 * @param {string} corpo   le forme, gia' col pannello
 * @param {number} misura  quanti pixel a lato
 */
export function guscio(chiave, corpo, misura = 96) {
  if (!corpo) return "";
  return (
    `<span class="dm-appliance-art dm-catalogo-art" data-dm-art="${chiave}" data-dm-art-style="panel">` +
    `<svg width="${misura}" height="${misura}" viewBox="0 0 96 96" role="img" aria-hidden="true" focusable="false">${corpo}</svg>` +
    "</span>"
  );
}
