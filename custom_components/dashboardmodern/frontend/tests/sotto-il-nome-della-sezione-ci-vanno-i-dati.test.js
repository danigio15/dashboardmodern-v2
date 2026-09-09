/* «La posizione è sbagliata: sotto c'è "rendi visibile", ma che c'entra?
 *  Coerenza. I dati.»
 *
 * In cima a ogni scheda del Config si dichiaravano primi in due.
 * `ensureTitoloDellaSezione` metteva il nome della sezione come primo figlio;
 * `ensureVisibilityBanner` metteva la fascia verde come primo figlio. Tutti e
 * due a ogni passata, tutti e due con un `prepend`: si spingevano a vicenda, e
 * l'ordine sullo schermo lo decideva chi era passato per ultimo — cioè il
 * carico, non una scelta. Una scrittura nel documento a ogni giro, per niente.
 *
 * E il vincitore era quello sbagliato: sopra «PLANCIA / HOME» compariva una
 * fascia verde che col nome della scheda non c'entra niente.
 *
 * Adesso la regola è una: il nome in cima, i dati sotto, e l'interruttore in
 * fondo. Si apre una scheda per configurarla, non per accenderla; e
 * l'interruttore sta in fondo in OGNI sezione, che è l'unica cosa che lo rende
 * trovabile senza cercarlo.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const uniformita = new URL("../src/sections/config-uniformity-section.js", import.meta.url);
const alberatura = new URL("../src/sections/alberatura-del-config-section.js", import.meta.url);
const assist = new URL("../src/sections/assist-editor-section.js", import.meta.url);

test("la fascia della sezione nasce in fondo, non in cima", async () => {
  const source = await readFile(uniformita, "utf8");
  assert.match(source, /body\.insertBefore\(banner, piedeDelSalvataggio\(body\)\);/);
  assert.doesNotMatch(source, /body\.prepend\(banner\);/);
});

test("e ci resta: a ogni passata si rimette in fondo, non in testa", async () => {
  const source = await readFile(uniformita, "utf8");
  assert.match(
    source,
    /if \(outermost\.parentElement === body && outermost\.nextElementSibling !== piede\)\s*body\.insertBefore\(outermost, piede\);/,
  );
  /* Il `prepend` che se la contendeva col nome della sezione non c'è più:
   * finché c'era, i due si spingevano a ogni giro. */
  assert.doesNotMatch(source, /body\.prepend\(outermost\);/);
  assert.doesNotMatch(source, /body\.firstElementChild !== outermost/);
});

test("«ultimo» resta del salvataggio: non ci si dichiara ultimi in due", async () => {
  /* Dirsi ultimi in due è lo stesso errore del dirsi primi in due, spostato in
   * fondo. Il piede del salvataggio è ultimo per una ragione sua; la fascia gli
   * sta davanti, e dove il piede non c'è `insertBefore(nodo, null)` è
   * esattamente «in fondo». */
  const source = await readFile(uniformita, "utf8");
  assert.match(source, /function piedeDelSalvataggio\(body\)/);
  assert.doesNotMatch(source, /body\.append\(outermost\)/);
  assert.doesNotMatch(source, /body\.append\(banner\)/);
});

test("il nome della sezione resta il primo, e adesso senza contendenti", async () => {
  const source = await readFile(alberatura, "utf8");
  assert.match(source, /if \(corpo\.firstElementChild !== testa\) corpo\.prepend\(testa\);/);
});

test("Assist segue la stessa regola: la fascia in fondo al suo blocco", async () => {
  const source = await readFile(assist, "utf8");
  /* Stava fra il nome e la spiegazione, cioè in mezzo a quello che si era
   * venuti a leggere. */
  assert.doesNotMatch(source, /ed-slot-lbl">🗣️ Assist<\/div>\s*\$\{fasciaMarkup\(\)\}/);
  assert.match(source, /\$\{fasciaMarkup\(\)\}\s*<\/div>`;/);
});

test("nessuno dei due mette più mano allo stesso posto: un padrone per estremità", async () => {
  const [fascia, titolo] = await Promise.all([
    readFile(uniformita, "utf8"),
    readFile(alberatura, "utf8"),
  ]);
  /* Chi tiene il fondo non tocca la testa, e chi tiene la testa non tocca il
   * fondo: è la ragione per cui la rincorsa non può ricominciare. */
  assert.doesNotMatch(fascia, /body\.prepend\(/);
  assert.doesNotMatch(titolo, /corpo\.append\(testa\)/);
});
