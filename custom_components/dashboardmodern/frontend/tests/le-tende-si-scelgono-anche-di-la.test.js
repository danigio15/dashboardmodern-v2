/* Il tipo di una tapparella si sceglie da tutte e due le parti.
 *
 * La sezione sa disegnare le tende — si scostano di lato invece di scendere —
 * ma la scelta esisteva soltanto nella finestra della matita. Chi apriva la
 * scheda Tapparelle e ne aggiungeva una non aveva modo di dire che quella e'
 * una tenda, e le tende, dalla scheda che le riguarda, non si vedevano.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { COVER_KINDS, declaredCoverKind } from "../src/core/cover-kind.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("la scheda Tapparelle stampa il campo del tipo", () => {
  const modulo = leggi("sections/shutter-window-section.js");
  assert.match(modulo, /export function ensureKindField/);
  assert.match(modulo, /id="ed-tp-kind"/);
});

test("il campo si disegna insieme agli altri, a ogni passata", () => {
  const modulo = leggi("sections/shutter-window-section.js");
  assert.match(modulo, /ensureContactField\(\);\s*\n\s*ensureKindField\(\);/);
});

test("quello che si sceglie viene salvato", () => {
  const crud = leggi("sections/editor-crud-section.js");
  assert.match(crud, /kind: clean\(doc\.getElementById\("ed-tp-kind"\)\?\.value\)/);
});

test("riaprendo una voce il campo dice il tipo che ha", () => {
  const crud = leggi("sections/editor-crud-section.js");
  assert.match(crud, /setField\("ed-tp-kind", coverKindValue\(item\)\)/);
});

test("i tipi che si possono scegliere sono quelli che la sezione sa disegnare", () => {
  for (const kind of COVER_KINDS) {
    assert.equal(declaredCoverKind({ kind }), kind);
  }
  assert.equal(declaredCoverKind({ kind: "portone" }), "");
  assert.equal(declaredCoverKind({}), "");
});
