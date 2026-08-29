/* Ogni modulo si legge, e se non si legge si sa quale.
 *
 * Il difetto che questa prova rende leggibile: il CSS di questo progetto vive
 * dentro template literal, e dentro un template literal il backtick lo chiude.
 * Un commento che nomina una proprieta' fra backtick — il modo naturale di
 * scriverlo in JavaScript — taglia il foglio a meta' e rompe il modulo.
 * Scrivendo le spiegazioni delle correzioni di oggi e' successo sei volte in
 * cinque file.
 *
 * Le prove lo dicevano gia', ma male: «missing ) after argument list» a
 * centinaia di righe dal punto vero, e dietro sette prove rosse che col
 * difetto non c'entravano niente — erano tutte le prove che importavano quel
 * modulo. Ci vuole mezz'ora per capire che il colpevole e' uno solo.
 *
 * Qui si prova a leggere ogni modulo per conto suo, e si dice il nome. Non e'
 * un controllo di stile: e' la differenza fra «qualcosa e' rotto» e «e' rotto
 * questo file». Nei commenti dentro un foglio si usano le virgolette basse.
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import test from "node:test";

const QUI = dirname(fileURLToPath(import.meta.url));
const CARTELLE = ["core", "sections", "legacy", "transport"].map((n) => join(QUI, "..", "src", n));

function moduli() {
  const fuori = [];
  for (const cartella of CARTELLE) {
    let nomi = [];
    try {
      nomi = readdirSync(cartella).filter((n) => n.endsWith(".js"));
    } catch (_errore) {
      continue;
    }
    for (const nome of nomi) fuori.push({ nome, percorso: join(cartella, nome) });
  }
  return fuori;
}

test("ogni modulo si legge da solo", async () => {
  const elenco = moduli();
  assert.ok(elenco.length > 100, `dovrebbero essere piu' di cento moduli, ne ho visti ${elenco.length}`);
  const rotti = [];
  for (const { nome, percorso } of elenco) {
    try {
      await import(pathToFileURL(percorso).href);
    } catch (errore) {
      const messaggio = String(errore?.message || errore).split("\n")[0];
      /* La causa piu' frequente ha un nome, e vale la pena dirlo qui invece di
       * lasciarlo scoprire: un backtick dentro un foglio di stile. */
      const indizio = /missing \) after argument list|Unexpected token/.test(messaggio)
        ? " — spesso e' un backtick dentro un foglio di stile, che chiude il template literal"
        : "";
      rotti.push(`${nome}: ${messaggio}${indizio}`);
    }
  }
  assert.deepEqual(rotti, [], `questi moduli non si leggono:\n  ${rotti.join("\n  ")}`);
});
