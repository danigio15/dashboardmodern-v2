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
  BLOCCO_INTESTAZIONE,
  eLOrdineDiSerie,
  ilMeteoStaInTestata,
  lIntestazioneStaInCima,
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
    /* I due che stanno sopra la pagina vanno DAVANTI, non in coda, e
     * nell'ordine in cui si vedono: prima la striscia col menu, poi il
     * riquadro del tempo. In coda vorrebbero dire che chi si era gia'
     * riordinato la Home, aggiornando, trova l'hamburger e il meteo staccati
     * dall'alto e buttati in fondo alla pagina. */
    "intestazione",
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
    "intestazione",
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
    "intestazione",
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
    "intestazione",
    "meteo",
    "widget",
    "persone",
    "azioni",
    "stanze",
    "dispositivi",
  ]);
  /* E le voci che non sono nemmeno stringhe. */
  assert.deepEqual(ordineDeiBlocchi([null, 3, { azioni: true }, "persone"]), [
    "intestazione",
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
  /* Davanti, non in coda: subito dopo la striscia col menu, che sta sopra la
   * pagina come lui. */
  assert.equal(ordineDeiBlocchi(["dispositivi"])[1], BLOCCO_DEL_METEO);
  assert.equal(ilMeteoStaInTestata(["dispositivi"]), true);
  assert.equal(ilMeteoStaInTestata(null), true);
  /* E chi lo sposta davvero se lo vede scendere in pagina. */
  assert.equal(ilMeteoStaInTestata(["persone", "meteo"]), false);
  assert.equal(ilMeteoStaInTestata(["meteo", "persone"]), true);
  /* E la striscia col menu davanti non lo fa scendere: sono tutte e due sopra
   * la pagina. Chiedendo «e' il primo», il giorno in cui la striscia e'
   * diventata spostabile il riquadro sarebbe sceso in pagina a tutti quelli
   * che non avevano mai toccato niente. */
  assert.equal(ilMeteoStaInTestata(["intestazione", "meteo", "persone"]), true);
  assert.equal(ilMeteoStaInTestata(["persone", "intestazione", "meteo"]), false);
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

/* ── l'intestazione, hamburger compreso ───────────────────────────────────
 *
 * «Prevedi di spostare anche intestazione della home, quindi la prima sezione
 * compresa di hamburger.»
 *
 * La striscia col menu non e' un blocco come gli altri: sta FUORI dalla Home e
 * la usano anche l'Energia, il Clima, la Sicurezza. Le prove qui sotto tengono
 * ferme le due cose che, sbagliate, romperebbero la plancia invece di
 * riordinarla.
 */
test("l'intestazione e' il primo blocco, e di serie non si muove", () => {
  assert.equal(BLOCCHI_DELLA_HOME[0], BLOCCO_INTESTAZIONE);
  assert.equal(lIntestazioneStaInCima(null), true);
  assert.equal(lIntestazioneStaInCima([]), true);
  /* E chi aveva gia' un ordine salvato prima che esistesse non se la ritrova
   * in fondo: l'hamburger in coda alla pagina sarebbe un menu che sparisce. */
  assert.equal(lIntestazioneStaInCima(["azioni", "persone"]), true);
  assert.equal(ordineDeiBlocchi(["azioni"])[0], BLOCCO_INTESTAZIONE);
});

test("spostata sotto un blocco della pagina, scende", () => {
  assert.equal(lIntestazioneStaInCima(["persone", "intestazione"]), false);
  /* Il meteo davanti non la fa scendere: stanno tutte e due sopra la pagina. */
  assert.equal(lIntestazioneStaInCima(["meteo", "intestazione", "persone"]), true);
});
