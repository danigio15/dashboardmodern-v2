/* Le riparazioni della scheda non girano quando la scheda non c'e'.
 *
 * Tre giri camminavano su tutto il documento a ogni evento di stato — cioe'
 * piu' volte al secondo in una casa vera — per aggiustare cose che stanno
 * dentro la scheda di configurazione: le righe delle temperature, la card del
 * costo, e le superfici da decorare con le icone. La scheda pero' non si
 * nasconde: il runtime la crea quando si apre e la toglie dal documento quando
 * si chiude, quindi per quasi tutto il tempo quei giri non trovavano niente e
 * lo cercavano lo stesso.
 *
 * E uno dei tre rastrellava elementi che nessuno disegna piu':
 * `[data-energy-load-node]` e compagni erano del disegno di ripiego dei
 * carichi, sostituito da un pezzo, ma il rastrello e la regola che li
 * nascondeva erano rimasti.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("le riparazioni della scheda chiedono prima se la scheda e' aperta", () => {
  const modulo = leggi("sections/beta22-load-slots-hotfix-section.js");
  assert.match(modulo, /function schedaAperta\(\)/);
  assert.match(modulo, /getElementById\?\.\("editor-modal"\)/);
  assert.match(modulo, /if \(!schedaAperta\(\)\) return;/);
});

test("le superfici delle icone si decorano solo quando ce ne sono", () => {
  const modulo = leggi("sections/icon-engine-section.js");
  assert.match(modulo, /function superficiDaDecorare\(\)/);
  assert.match(modulo, /if \(!doc \|\| !superficiDaDecorare\(\)\) return false;/);
});

test("il rastrello dei carichi di ripiego non c'e' piu', ne' la sua regola", () => {
  const modulo = leggi("sections/beta22-load-slots-hotfix-section.js");
  assert.doesNotMatch(modulo, /removeTemporaryEnergyLoads/);
  assert.doesNotMatch(modulo, /data-energy-load-node|data-energy-load-arc/);
  /* E nessuno li disegna piu': se un giorno tornassero, qui si accorge. */
  for (const altro of [
    "sections/energy-flow-section.js",
    "sections/beta24-energy-recovery-section.js",
  ])
    assert.doesNotMatch(leggi(altro), /data-energy-load-node|data-energy-load-arc/, altro);
});
