/* «Dopo aver salvato non compare piu' modifica.»
 *
 * La configurazione non e' solo quello che stampa il runtime: la matita sulle
 * righe salvate, le tre caselle di un infisso, le righe degli allagamenti, le
 * pastiglie dei campi — tutto questo lo aggiungiamo noi dopo, e ci si
 * agganciava a `editorSwitch`, cioe' al cambio di linguetta.
 *
 * Ma il corpo della scheda lo rifa' anche `renderCurrentEditor`, che gira a
 * ogni cambio del modello e non passa di li'. Si salva una tapparella: il
 * modello cambia, la scheda viene ridisegnata da capo, e tutto quello che ci
 * avevamo messo sopra sparisce. Restava la riga col solo cestino — niente
 * matita per riaprirla — e le caselle della tenda e del contatto non c'erano
 * piu'. Per rivederle bisognava uscire dalla linguetta e rientrarci.
 *
 * Quel ridisegno lo annunciava gia': `dashboardmodern:editor-rendered`. Erano
 * due nomi per lo stesso avviso — «la scheda e' nuova, rimetti la tua roba» —
 * e chiederli uno per uno era il modo di dimenticarne uno.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

/* Chi ridisegna avvisa. */
test("il ridisegno della scheda si annuncia", () => {
  const entry = readFileSync(join(SRC, "..", "legacy", "modules-entry.js"), "utf8");
  assert.match(entry, /dashboardmodern:editor-rendered/, "il ridisegno non dice niente a nessuno");
});

/* Chi decora ascolta — e ascolta tutte e due le cose insieme. */
test("chi si agganciava alla linguetta adesso si aggancia al ridisegno", () => {
  const shared = leggi("sections/shared.js");
  assert.match(shared, /export function onEditorRedraw\(marker, callback\)/);
  assert.match(shared, /wrapFunction\("editorSwitch", marker, callback\)/, "il cambio linguetta");
  assert.match(shared, /"dashboardmodern:editor-rendered"/, "e il ridisegno del modello");
});

test("l'ascolto si registra una volta sola per contrassegno", () => {
  /* `wrapFunction` si rifiuta di avvolgere due volte, ma questa funzione viene
   * richiamata a ogni giro di installazione: senza il conto gli ascoltatori si
   * impilerebbero, e ogni salvataggio ridisegnerebbe la scheda N volte. */
  const shared = leggi("sections/shared.js");
  assert.match(shared, /__dmEditorRedrawMarkers/);
  assert.match(shared, /if \(!gia\.has\(marker\)\)/);
});

/* Nessuno resta indietro.
 *
 * Un modulo che decora la scheda e si aggancia ancora al solo `editorSwitch` e'
 * un modulo la cui decorazione sparisce al primo salvataggio. La prova elenca i
 * moduli, cosi' che uno nuovo non possa nascere gia' sbagliato senza che
 * qualcuno se ne accorga. */
const DECORANO = [
  "sections/alerts-section.js",
  "sections/beta6-feedback-section.js",
  "sections/config-uniformity-section.js",
  "sections/editor-contracts-section.js",
  "sections/editor-crud-section.js",
  "sections/editor-slots-section.js",
  "sections/energy-guidance-section.js",
  "sections/energy-section.js",
  "sections/ev-section.js",
  "sections/flood-alerts-section.js",
  "sections/lights-alerts-section.js",
  "sections/pool-editor-section.js",
  "sections/report-editor-section.js",
  "sections/robot-editor-section.js",
];

test("nessun modulo si aggancia ancora al solo cambio di linguetta", () => {
  for (const modulo of DECORANO) {
    const sorgente = leggi(modulo);
    assert.doesNotMatch(
      sorgente,
      /wrapFunction\("editorSwitch"/,
      `${modulo}: la sua decorazione sparisce al primo salvataggio`,
    );
    assert.match(sorgente, /onEditorRedraw\(/, `${modulo} non si accorge del ridisegno`);
  }
});

test("le caselle in piu' di un infisso tornano dopo un salvataggio", () => {
  const sezione = leggi("sections/shutter-window-section.js");
  assert.match(sezione, /"dashboardmodern:editor-rendered"/, "sparivano salvando");
});
