/* Una tenda da sole non si disegna come una tapparella.
 *
 * Il tipo veniva riconosciuto bene — l'attributo sulla card diceva
 * `tenda_sole` — e il foglio di stile le dava perfino un fondo a righe. Non si
 * vedeva mai: il telo della tapparella contiene otto stecche piene, elementi
 * veri, e coprivano quel fondo per intero. Accanto a una tapparella era il
 * medesimo disegno, e nessuno poteva distinguerle.
 *
 * Qui si prova la regola che decide il disegno, non il disegno: le tre
 * coperture devono cadere in tre casi distinti.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { COVER_KINDS, coverIsAwning, coverIsSideways } from "../src/core/cover-kind.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

test("ogni tipo cade in un caso suo", () => {
  const casi = COVER_KINDS.map((kind) => [kind, coverIsAwning(kind), coverIsSideways(kind)]);
  assert.deepEqual(casi, [
    ["tapparella", false, false],
    ["tenda", false, true],
    ["tenda_sole", true, false],
  ]);
});

test("la tenda da sole non e' laterale: scende dall'alto come la tapparella", () => {
  assert.equal(coverIsSideways("tenda_sole"), false);
  assert.equal(coverIsAwning("tenda_sole"), true);
});

test("un tipo che non conosciamo non e' una tenda da sole", () => {
  for (const sconosciuto of ["portone", "", null, undefined, "awning"]) {
    assert.equal(coverIsAwning(sconosciuto), false);
  }
});

test("il telo della tenda da sole non porta le stecche della tapparella", () => {
  const scena = readFileSync(join(SRC, "sections/shutter-scene-section.js"), "utf8");
  const disegno = scena.slice(scena.indexOf("function panelMarkup"));
  const corpo = disegno.slice(0, disegno.indexOf("\n}"));
  const ramo = corpo.slice(corpo.indexOf("coverIsAwning"), corpo.indexOf("coverIsSideways"));
  assert.match(ramo, /dm-tendasole/);
  assert.doesNotMatch(ramo, /<i><\/i>/);
  assert.doesNotMatch(ramo, /tapp-shutter/);
});
