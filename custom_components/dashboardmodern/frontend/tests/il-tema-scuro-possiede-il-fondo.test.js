/* Il tema scuro possiede anche il fondo.
 *
 * «Scuro» scuriva le card una per una ma non aveva mai ridefinito le
 * variabili di base: il body restava chiaro sotto le card scure. E in
 * modalita' kiosk il fondo leggeva una variabile del tema di Home Assistant
 * che dentro la plancia non esiste, quindi vinceva sempre il ripiego chiaro.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("le variabili del tema hanno una versione notturna", () => {
  const tema = leggi("sections/theme-foundation-section.js");
  assert.match(tema, /html\[data-theme="dark"\]/);
  for (const variabile of ["--bg-sculpted", "--card-bg", "--text", "--card-border", "--surface-2"])
    assert.ok(tema.includes(variabile), `${variabile} non ha la versione scura`);
  assert.match(tema, /color-scheme:dark/);
});

test("la sezione e' installata col runtime", () => {
  const runtime = leggi("sections/section-runtime.js");
  assert.match(runtime, /installThemeFoundationSection\(\)/);
  assert.match(runtime, /"theme-foundation"/);
});

test("il fondo del kiosk segue il tema della plancia, non quello di Home Assistant", () => {
  const kiosk = leggi("sections/beta12-room-color-lock-section.js");
  assert.match(kiosk, /background:var\(--bg-sculpted,var\(--primary-background-color,#f8fafc\)\)/);
});
