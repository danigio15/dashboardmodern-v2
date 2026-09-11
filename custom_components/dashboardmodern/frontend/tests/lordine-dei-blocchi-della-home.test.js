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
  BLOCCO_DEL_METEO,
  eLOrdineDiSerie,
  ilMeteoStaInTestata,
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
    /* Il meteo (#492) e' nato dopo, e va DAVANTI, non in coda: il suo posto di
     * serie e' l'intestazione, cioe' sopra la pagina. In coda vorrebbe dire
     * che chi si era gia' riordinato la Home, aggiornando, trova il riquadro
     * col meteo staccato dall'intestazione e buttato in fondo. */
    "meteo",
    "azioni",
    "persone",
    "widget",
    /* Le stanze (#493) sono nate dopo, e in coda al loro posto di serie: chi
     * aveva gia' un ordine salvato non se lo vede scombinare. */
    "stanze",
    "dispositivi",
  ]);
  assert.equal(eLOrdineDiSerie(["azioni"]), false);
  assert.deepEqual(ordineDeiBlocchi(["dispositivi", "azioni"]), [
    "meteo",
    "dispositivi",
    "azioni",
    "persone",
    "widget",
    "stanze",
  ]);
});

test("un ordine sporco non rompe la Home", () => {
  /* Un blocco scritto due volte compare una volta sola: due copie dello stesso
   * nodo non esistono, e la seconda si porterebbe via la prima. */
  assert.deepEqual(ordineDeiBlocchi(["azioni", "persone", "azioni"]), [
    "meteo",
    "azioni",
    "persone",
    "widget",
    "stanze",
    "dispositivi",
  ]);
  /* Un nome che non esiste piu' — una versione che toglie un blocco — si
   * ignora invece di lasciare un buco nella fila. */
  assert.deepEqual(ordineDeiBlocchi(["fantasma", "widget"]), [
    "meteo",
    "widget",
    "persone",
    "azioni",
    "stanze",
    "dispositivi",
  ]);
  /* E le voci che non sono nemmeno stringhe. */
  assert.deepEqual(ordineDeiBlocchi([null, 3, { azioni: true }, "persone"]), [
    "meteo",
    "persone",
    "widget",
    "azioni",
    "stanze",
    "dispositivi",
  ]);
});

test("il meteo mancante va DAVANTI, non in coda", () => {
  /* Il solo blocco che, quando manca dall'ordine salvato, non va in fondo.
   *
   * Il suo posto di serie e' l'intestazione — sopra la pagina — e in una lista
   * quel posto si scrive «per primo». Chi aveva gia' un ordine salvato prima
   * che il meteo fosse spostabile non deve vederselo scendere in fondo alla
   * Home per il solo fatto di aver aggiornato. */
  assert.equal(ordineDeiBlocchi(["dispositivi"])[0], BLOCCO_DEL_METEO);
  assert.equal(ilMeteoStaInTestata(["dispositivi"]), true);
  assert.equal(ilMeteoStaInTestata(null), true);
  /* E chi lo sposta davvero se lo vede scendere in pagina. */
  assert.equal(ilMeteoStaInTestata(["persone", "meteo"]), false);
  assert.equal(ilMeteoStaInTestata(["meteo", "persone"]), true);
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
