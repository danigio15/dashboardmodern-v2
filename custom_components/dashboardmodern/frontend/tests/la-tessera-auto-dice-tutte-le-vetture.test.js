/* La tessera Auto in Home guarda tutte le vetture, non solo quella in uso.
 *
 * Il riferimento `dm.ev_batteria_auto` ne indica una sola: quella che «Usa» ha
 * copiato nelle chiavi globali. E' giusto per la pagina EV, dove si guarda
 * un'auto per volta, ed e' sbagliato per un colpo d'occhio sulla casa: chi ha
 * due auto vedeva sempre e solo l'ultima messa in uso, senza nessun modo di
 * accorgersi che l'altra era a secco.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const sorgente = readFileSync(join(QUI, "..", "src/sections/home-widgets-section.js"), "utf8");
const modello = sorgente.slice(
  sorgente.indexOf("function vetture()"),
  sorgente.indexOf("/* La tessera degli aspirapolvere"),
);

test("le vetture si leggono dai profili, ognuna con la sua mappatura", () => {
  assert.match(modello, /function vetture\(\)/);
  assert.match(modello, /section\("ev", readJson\("cd_ev_cars", \[\]\)\)/,
    "l'elenco e' quello della sezione EV, non una copia");
  assert.match(modello, /auto\?\.ov \|\| auto\?\.overrides/,
    "la mappatura di una vettura sta nel suo profilo: e' la stessa che «Usa» copia");
});

test("con due vetture la tessera nomina l'una e l'altra", () => {
  assert.match(modello, /const piu = letture\.length > 1;/);
  assert.match(modello, /righeVettura\(lettura, piu\)/,
    "le righe portano il nome dell'auto solo quando ce n'e' piu' d'una");
  /* Il valore grande e' la piu' scarica: e' quella che chiede qualcosa. */
  assert.match(modello, /Math\.min\(\.\.\.cariche\)/);
});

test("il profilo comanda appena e' leggibile, anche da solo", () => {
  /* Prima con UNA vettura profilata si leggevano solo le chiavi globali —
   * che si riempiono ai salvataggi successivi, la foto compresa — e un'auto
   * con la batteria mappata nel SUO profilo restava invisibile in Home
   * finche' non si toccava altro. Le chiavi globali restano il ripiego di
   * chi non ha profili, e con una sola vettura le righe restano senza nome:
   * nominarla sarebbe rumore. */
  assert.match(
    modello,
    /profilate\.length \? profilate : \[letturaAttiva\(states, fuori\)\]\.filter\(Boolean\)/,
  );
  assert.match(modello, /function letturaAttiva\(states, fuori\)/);
});

test("un'entita' tolta dai widget resta fuori anche leggendo dai profili", () => {
  assert.match(modello, /widgetIncludes\(entity, fuori\)/,
    "l'interruttore «Nel widget» vale per tutte le auto, non solo per quella in uso");
});
