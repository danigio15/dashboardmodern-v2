/* «Quando sei in un menù pieno di entità, tipo le luci, o temperature, quando
 * scorri con il dito oltre allo scorrere prende anche il comando. Sulle luci
 * mentre passi con il dito per scorrere le accende pure.» (#397)
 *
 * Il prezzo dello sbaglio non è simmetrico: una pagina che non scorre la si
 * riprova, una luce accesa per sbaglio resta accesa in una stanza dove non c'è
 * nessuno. Il criterio è quello di sempre — quanto si è spostato il dito fra
 * il tocco e il rilascio — e il resto sono i casi in cui NON si deve fermare
 * niente, che sono la parte che si può rompere.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  SCARTO_DEL_TOCCO,
  SCARTO_DEL_TRASCINAMENTO,
  eraUnoScorrimento,
  quantoSiEMosso,
  stavaScorrendo,
  haScorsoDavvero,
} from "../src/core/il-dito-scorre-o-tocca.js";

test("un dito fermo tocca, un dito che tira scorre", () => {
  assert.equal(stavaScorrendo({ x: 100, y: 200 }, { x: 100, y: 200 }), false);
  assert.equal(stavaScorrendo({ x: 100, y: 200 }, { x: 102, y: 203 }), false);
  /* Il caso segnalato: si scorre l'elenco delle luci verso l'alto. */
  assert.equal(stavaScorrendo({ x: 100, y: 400 }, { x: 100, y: 120 }), true);
});

test("si misura in diagonale, non asse per asse", () => {
  /* Chi scorre di traverso si sposta poco su ciascun asse e parecchio in
   * totale: guardare un asse alla volta lo lascerebbe passare per un tocco. */
  const obliquo = { x: 110, y: 210 };
  assert.equal(Math.round(quantoSiEMosso({ x: 100, y: 200 }, obliquo)), 14);
  assert.equal(stavaScorrendo({ x: 100, y: 200 }, obliquo), true);
  /* E lo stesso spostamento su un asse solo sarebbe stato un tocco. */
  assert.equal(stavaScorrendo({ x: 100, y: 200 }, { x: 110, y: 200 }), false);
});

test("la soglia è quella dichiarata, e si può cambiare", () => {
  const appena = { x: 0, y: SCARTO_DEL_TOCCO };
  assert.equal(stavaScorrendo({ x: 0, y: 0 }, appena), false, "sul limite è ancora un tocco");
  assert.equal(stavaScorrendo({ x: 0, y: 0 }, { x: 0, y: SCARTO_DEL_TOCCO + 1 }), true);
  assert.equal(stavaScorrendo({ x: 0, y: 0 }, { x: 0, y: 5 }, 2), true);
  assert.equal(stavaScorrendo({ x: 0, y: 0 }, { x: 0, y: 5 }, 100), false);
});

test("un click senza un dito dietro passa sempre", () => {
  /* Tastiera, lettore di schermo, `element.click()` da un altro modulo: non
   * hanno un punto di partenza, e rifiutarli vorrebbe dire rompere la plancia
   * per chi non la tocca con le dita. */
  assert.equal(stavaScorrendo(null, { x: 0, y: 400 }), false);
  assert.equal(stavaScorrendo(undefined, undefined), false);
  assert.equal(stavaScorrendo({ x: 0, y: 0 }, null), false);
  assert.equal(quantoSiEMosso({ x: 0, y: 0 }, { x: NaN, y: 0 }), null);
});

test("la guardia sta sul documento in cattura, e lascia stare ciò che si trascina", () => {
  const sorgente = readFileSync(
    new URL("../src/sections/il-dito-scorre-o-tocca-section.js", import.meta.url),
    "utf8",
  );
  /* In cattura sul documento: è l'unico posto da cui si arriva prima di ogni
   * sezione, comprese quelle che ancora non esistono. */
  assert.match(sorgente, /doc\.addEventListener\("click", fermaSeScorreva, true\)/);
  assert.match(sorgente, /doc\.addEventListener\("pointerdown", segnaLaPartenza, true\)/);
  /* Un cursore si USA spostando il dito: lì lo spostamento è il comando. */
  assert.match(sorgente, /input,textarea,select,\[draggable="true"\],\[data-dm-si-trascina\]/);
  /* E un tocco annullato non lascia in giro la sua partenza. */
  assert.match(sorgente, /doc\.addEventListener\("pointercancel", scordaLaPartenza, true\)/);
});

test("è installata dal runtime, non da chi se la ricorda", () => {
  const runtime = readFileSync(
    new URL("../src/sections/section-runtime.js", import.meta.url),
    "utf8",
  );
  assert.match(runtime, /installIlDitoScorreOTocca\(\);/);
});

/* ── il dito si muove, ma la pagina no ─────────────────────────────────── */

/* «In alcuni casi lo switch non e' cliccabile.»
 *
 * La distanza da sola non basta a dire che si stava scorrendo. Su un bersaglio
 * largo tutta la scheda — la fascia verde che accende una sezione — il pollice
 * appoggiato rulla di una dozzina di pixel senza che nessuno abbia inteso
 * scorrere, e il comando finiva buttato via. Il fatto che decide non e' quanto
 * si e' mosso il dito: e' se la pagina si e' mossa.
 */
test("se niente si e' mosso, non si stava scorrendo", () => {
  const fermo = { finestraX: 0, finestraY: 120, v1: 40 };
  assert.equal(haScorsoDavvero(fermo, { ...fermo }), false);
});

test("la finestra che scorre basta a dirlo", () => {
  assert.equal(
    haScorsoDavvero({ finestraX: 0, finestraY: 120 }, { finestraX: 0, finestraY: 260 }),
    true,
  );
});

test("anche un solo contenitore che scorre basta", () => {
  assert.equal(haScorsoDavvero({ finestraY: 0, v1: 40 }, { finestraY: 0, v1: 300 }), true);
});

test("scorrere di traverso conta come scorrere", () => {
  assert.equal(haScorsoDavvero({ o1: 0, v1: 10 }, { o1: 90, v1: 10 }), true);
});

test("senza misure non si accusa nessuno", () => {
  assert.equal(haScorsoDavvero(null, { finestraY: 10 }), false);
  assert.equal(haScorsoDavvero({ finestraY: 10 }, null), false);
  assert.equal(haScorsoDavvero(undefined, undefined), false);
});

test("una misura che non c'e' piu' non conta come movimento", () => {
  /* Un contenitore sparito fra il tocco e il click — la scheda si ridisegna —
   * lascia una chiave senza numero dall'altra parte: non e' uno scorrimento. */
  assert.equal(haScorsoDavvero({ finestraY: 10, v1: 5 }, { finestraY: 10 }), false);
});

/* In fondo all'elenco non c'e' piu' niente da scorrere, e li' decide il dito.
 *
 * «Se la pagina non si e' mossa era un tocco» tiene finche' la pagina PUO'
 * muoversi. A fine corsa non puo': una spazzata larga mezzo schermo lascia le
 * posizioni identiche, e la regola da sola direbbe tocco — cioe' riaccenderebbe
 * la luce che #397 aveva smesso di accendere, proprio dove capita di piu', in
 * fondo a un elenco lungo. Sopra il trascinamento non si chiede piu' niente
 * alla pagina.
 */
test("a fine corsa una spazzata resta uno scorrimento, anche se niente si e' mosso", () => {
  const fermo = { finestraX: 0, finestraY: 0, v1: 900, o1: 0 };
  const partenza = { x: 200, y: 600 };

  /* Il pollice appoggiato che rulla: sotto il trascinamento, e la pagina non si
   * e' mossa. E' un comando, e passa — «in alcuni casi lo switch non e'
   * cliccabile» resta corretto. */
  assert.equal(eraUnoScorrimento(partenza, { x: 204, y: 585 }, fermo, fermo), false);

  /* La spazzata vera, allo stesso posto: centoventi pixel. */
  assert.equal(eraUnoScorrimento(partenza, { x: 200, y: 480 }, fermo, fermo), true);

  /* E quando la pagina si muove basta lo scarto del tocco, come prima. */
  assert.equal(eraUnoScorrimento(partenza, { x: 204, y: 585 }, fermo, { ...fermo, v1: 860 }), true);

  /* Un dito che non si e' mosso non scorre mai, per quanto scorra la pagina. */
  assert.equal(eraUnoScorrimento(partenza, partenza, fermo, { ...fermo, v1: 100 }), false);
  /* E senza un dito dietro — tastiera, `.click()` — non si accusa nessuno. */
  assert.equal(eraUnoScorrimento(null, { x: 1, y: 1 }, fermo, fermo), false);
});

test("le due soglie sono dichiarate, e la seconda sta larga sopra la prima", () => {
  assert.equal(SCARTO_DEL_TOCCO, 12);
  assert.equal(SCARTO_DEL_TRASCINAMENTO, 40);
  assert.ok(SCARTO_DEL_TRASCINAMENTO > SCARTO_DEL_TOCCO * 3);
});
