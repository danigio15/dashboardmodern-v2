/* Quali entità contano come batterie. Una risposta sola, per tre che chiedono.
 *
 * La tessera in Home, la pagina Batterie e la scheda della configurazione
 * devono guardare lo STESSO elenco: se la scheda ne toglie una e la tessera
 * continua a contarla, chi ha tolto quella riga vede il numero non muoversi e
 * pensa che la plancia non l'abbia sentito.
 *
 * L'elenco non nasce qui e non è nuovo. Lo compone già il motore delle tessere
 * di Home, e sa fare tutte e tre le cose che servono: le batterie che Home
 * Assistant dichiara da sé, più quelle aggiunte a mano (`cd_gruppi_extra`),
 * meno quelle tolte (`cd_gruppi_removed`) e meno quelle escluse dai widget.
 * Qui c'è soltanto il nome della domanda, così nessuno deve ricordarsi che la
 * chiave si scrive «batt».
 */
import { gruppoEntita } from "./home-widgets-section.js";

/** Le batterie sorvegliate adesso, come le vede tutta la plancia. */
export function batterieSorvegliate() {
  try {
    return gruppoEntita("batt");
  } catch (_error) {
    return [];
  }
}
