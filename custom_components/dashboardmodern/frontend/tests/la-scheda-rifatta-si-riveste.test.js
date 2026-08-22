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
import { readFileSync, readdirSync } from "node:fs";
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

/* Nessuno resta indietro, e non per un elenco scritto a mano.
 *
 * Un modulo che decora la scheda e si aggancia ancora al solo `editorSwitch` e'
 * un modulo la cui decorazione sparisce al primo salvataggio. La prima versione
 * di questa prova elencava i quattordici moduli di allora: un quindicesimo,
 * aggiunto domani con l'aggancio sbagliato, sarebbe passato senza che nessuno
 * se ne accorgesse — cioe' la prova prometteva una cosa che non poteva
 * mantenere.
 *
 * Adesso guarda tutte le sezioni e non ne conosce nessuna: chi si aggancia al
 * cambio di linguetta viene trovato, chiunque sia e da qualunque parte arrivi.
 */
function tutteLeSezioni() {
  const cartella = join(SRC, "sections");
  return readdirSync(cartella)
    .filter((nome) => nome.endsWith(".js"))
    .map((nome) => ({ nome, sorgente: readFileSync(join(cartella, nome), "utf8") }));
}

test("nessun modulo si aggancia al solo cambio di linguetta", () => {
  /* `shared.js` e' l'unico che puo': e' dentro `onEditorRedraw`, cioe' proprio
   * il giro che mette insieme le due cose. */
  const colpevoli = tutteLeSezioni()
    .filter(
      ({ nome, sorgente }) =>
        nome !== "shared.js" && /wrapFunction\(\s*"editorSwitch"/.test(sorgente),
    )
    .map(({ nome }) => nome);
  assert.deepEqual(
    colpevoli,
    [],
    `la decorazione di questi moduli sparisce al primo salvataggio: ${colpevoli.join(", ")}`,
  );
});

test("e chi decora la scheda si accorge del ridisegno", () => {
  /* `shared.js` e' dove `onEditorRedraw` abita, quindi non la usa. */
  const decorano = tutteLeSezioni().filter(
    ({ nome, sorgente }) => nome !== "shared.js" && /onEditorRedraw\(/.test(sorgente),
  );
  assert.ok(decorano.length >= 14, `troppo pochi: ${decorano.length}`);
});

test("le caselle in piu' di un infisso tornano dopo un salvataggio", () => {
  const sezione = leggi("sections/shutter-window-section.js");
  assert.match(sezione, /"dashboardmodern:editor-rendered"/, "sparivano salvando");
});
