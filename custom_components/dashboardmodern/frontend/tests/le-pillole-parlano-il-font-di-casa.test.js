/* Le pillole non parlano una lingua tipografica loro.
 *
 * «Font tag stanze non ancora sistemato non e' congruo alla dashboard»: le
 * pillole delle stanze in Temperature uscivano in un font che sulla plancia non
 * si vede da nessun'altra parte. Non era una scelta, era una dimenticanza: un
 * <button> non eredita il font-family del documento, e nessuno gliel'aveva mai
 * detto. Il resto della plancia e' in Inter; loro cadevano sul font di sistema,
 * diverso su ogni telefono.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const leggi = (percorso) => readFile(new URL(percorso, import.meta.url), "utf8");

for (const lingua of ["it", "en"]) {
  test(`le pillole ereditano il font del documento (${lingua})`, async () => {
    const css = await leggi(`../legacy/dashboard-runtime-${lingua}.css`);
    const regola = css.match(/\.sub-tab-btn \{[\s\S]*?\}/);
    assert.ok(regola, "la regola .sub-tab-btn non c'e' piu'");
    assert.match(regola[0], /font-family:\s*inherit/);
  });
}

test("anche le pillole delle stanze, che hanno una regola propria", async () => {
  const modulo = await leggi("../src/sections/beta26-real-device-stability-section.js");
  const regola = modulo.match(
    /#dm-beta16-temperature-tabs \.dm-beta27-temperature-tab\{[^}]*\}/,
  );
  assert.ok(regola, "la regola delle pillole delle stanze non c'e' piu'");
  /* Quella regola scrive tutto con !important: senza un font-family suo,
   * l'eredita' di .sub-tab-btn basterebbe — ma il giorno che qualcuno tocca
   * l'ordine dei fogli si torna al font di sistema senza accorgersene. */
  assert.match(regola[0], /font-family:inherit!important/);
});

test("un nome lungo di stanza ha piu' spazio da schermo largo", async () => {
  const modulo = await leggi("../src/sections/beta26-real-device-stability-section.js");
  // «CAMERA MAT…» tagliava a meta' una stanza che sullo schermo ci stava.
  assert.match(modulo, /@media\(min-width:900px\)\{#dm-beta16-temperature-tabs[^}]*max-width:220px!important/);
});
