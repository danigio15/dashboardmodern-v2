/* «Riordinare a piacere la Home» — anche i blocchi fra loro.
 *
 * Le tessere si riordinavano, le persone si riordinavano, le azioni rapide si
 * riordinavano: sempre DENTRO il loro blocco. L'ordine dei blocchi era scritto
 * nel codice. Qui si prova la parte che decide la fila, che e' una lista e
 * niente altro: chi sposta i nodi nella pagina ha la sua prova a parte.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  BLOCCHI_DELLA_HOME,
  eLOrdineDiSerie,
  ordineDeiBlocchi,
} from "../src/core/ordine-dei-blocchi.js";

test("senza niente salvato vale l'ordine di sempre", () => {
  assert.deepEqual(ordineDeiBlocchi(null), [...BLOCCHI_DELLA_HOME]);
  assert.deepEqual(ordineDeiBlocchi([]), [...BLOCCHI_DELLA_HOME]);
  assert.deepEqual(ordineDeiBlocchi("azioni"), [...BLOCCHI_DELLA_HOME]);
  assert.equal(eLOrdineDiSerie(null), true);
});

test("l'ordine scelto si rispetta, e quello che non c'e' va in coda al suo posto", () => {
  /* Chi rientra in casa e vuole i tasti per primi. */
  assert.deepEqual(ordineDeiBlocchi(["azioni"]), [
    "azioni",
    "persone",
    "widget",
    "dispositivi",
  ]);
  assert.equal(eLOrdineDiSerie(["azioni"]), false);
  assert.deepEqual(ordineDeiBlocchi(["dispositivi", "azioni"]), [
    "dispositivi",
    "azioni",
    "persone",
    "widget",
  ]);
});

test("un ordine sporco non rompe la Home", () => {
  /* Un blocco scritto due volte compare una volta sola: due copie dello stesso
   * nodo non esistono, e la seconda si porterebbe via la prima. */
  assert.deepEqual(ordineDeiBlocchi(["azioni", "persone", "azioni"]), [
    "azioni",
    "persone",
    "widget",
    "dispositivi",
  ]);
  /* Un nome che non esiste piu' — una versione che toglie un blocco — si
   * ignora invece di lasciare un buco nella fila. */
  assert.deepEqual(ordineDeiBlocchi(["fantasma", "widget"]), [
    "widget",
    "persone",
    "azioni",
    "dispositivi",
  ]);
  /* E le voci che non sono nemmeno stringhe. */
  assert.deepEqual(ordineDeiBlocchi([null, 3, { azioni: true }, "persone"]), [
    "persone",
    "widget",
    "azioni",
    "dispositivi",
  ]);
});

test("un blocco NUOVO non si perde e non passa davanti", () => {
  /* Chi ha salvato un ordine prima che un blocco esistesse lo ritrova in coda,
   * al posto che ha di serie: non sparito — sarebbe una Home a cui manca un
   * pezzo — e non primo, che sposterebbe la pagina di chi non ha chiesto
   * niente. */
  const salvato = BLOCCHI_DELLA_HOME.filter((nome) => nome !== "dispositivi").toReversed();
  const fila = ordineDeiBlocchi(salvato);
  assert.equal(fila.length, BLOCCHI_DELLA_HOME.length);
  assert.equal(fila.at(-1), "dispositivi");
  assert.deepEqual(fila.slice(0, -1), salvato);
});
