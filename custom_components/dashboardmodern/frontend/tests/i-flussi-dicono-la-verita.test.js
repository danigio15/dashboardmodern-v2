/* I flussi dicono quello che succede, coi numeri delle segnalazioni vere. */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allocateSourceFlows, batteryReadout } from "../src/core/energy-flow-truth.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const vicino = (avuto, atteso) => assert.ok(Math.abs(avuto - atteso) < 0.01, `${avuto} ≠ ${atteso}`);

test("di notte la rete alimenta casa E ricarica la batteria", () => {
  /* Il video delle 06:38: solare 0, rete 577.7 in prelievo, batteria in
   * carica a 189 (nel modello: -189), casa 302.7. Il disegno diceva «rete e
   * batteria alimentano casa»; la realta' e' rete → casa e rete → batteria. */
  const flussi = allocateSourceFlows({ solar: 0, grid: 577.7, battery: -189 });
  vicino(flussi.gridToBattery, 189);
  vicino(flussi.gridToHome, 388.7);
  vicino(flussi.batteryToHome, 0);
  vicino(flussi.solarToHome, 0);
});

test("il solare che finisce tutto in batteria non accende «solare → casa»", () => {
  /* Il video delle 07:46: solare 146.3, batteria in carica a 201, rete 295.9
   * in prelievo, casa 295.9. Il solare copre parte della carica, la rete il
   * resto e tutta la casa: la linea solare → casa deve restare spenta. */
  const flussi = allocateSourceFlows({ solar: 146.3, grid: 295.9, battery: -201 });
  vicino(flussi.solarToBattery, 146.3);
  vicino(flussi.solarToHome, 0);
  vicino(flussi.gridToBattery, 54.7);
  vicino(flussi.gridToHome, 241.2);
});

test("la scarica alimenta casa, e l'immissione esce dal solare prima che dalla batteria", () => {
  const scarica = allocateSourceFlows({ solar: 0, grid: 100, battery: 300 });
  vicino(scarica.batteryToHome, 300);
  vicino(scarica.gridToHome, 100);
  const immissione = allocateSourceFlows({ solar: 900, grid: -400, battery: 0 });
  vicino(immissione.solarToGrid, 400);
  vicino(immissione.solarToHome, 500);
  const insieme = allocateSourceFlows({ solar: 100, grid: -400, battery: 500 });
  vicino(insieme.solarToGrid, 100);
  vicino(insieme.batteryToGrid, 300);
  vicino(insieme.batteryToHome, 200);
});

test("la bolla della batteria dice grandezza e verso, non il segno del modello", () => {
  assert.equal(batteryReadout(-201), "▼ 201 W");
  assert.equal(batteryReadout(189), "▲ 189 W");
  assert.equal(batteryReadout(0), null);
  assert.equal(batteryReadout("x"), null);
});

test("la scena dei flussi legge gli archi veri e possiede l'arco che mancava", () => {
  const sezione = readFileSync(join(SRC, "sections/energy-flow-section.js"), "utf8");
  assert.match(sezione, /instantSourceFlows\(\)/,
    "l'istantanea si spartisce dagli stati, non dai testi delle bolle");
  assert.match(sezione, /line-grid-battery/, "l'arco rete → batteria non esisteva proprio");
  assert.match(sezione, /m-line-grid-battery/, "anche la scena mobile ha il suo arco");
  assert.match(sezione, /batteryReadout/, "la bolla della batteria dice grandezza e verso");
});

test("una sorgente configurata ma muta non vale zero, e l'immissione della batteria ha il suo arco", () => {
  const sezione = readFileSync(join(SRC, "sections/energy-flow-section.js"), "utf8");
  /* Un sensore in `unavailable` per un attimo non e' «zero»: spartire gli
   * altri due inventerebbe percorsi falsi. L'istantanea si fa da parte. */
  assert.match(sezione, /fonte\.configurata && fonte\.valore === null/,
    "configurata ma muta: si cede il passo alla lettura dei testi");
  assert.match(sezione, /return null;\n  const raw|if \(!nodo \|\| nodo\.state === undefined\) return null;/,
    "potenzaViva distingue «spento» da «non configurato»");
  /* E la batteria che immette in rete non si traveste da solare. */
  assert.match(sezione, /line-battery-grid/, "l'arco batteria → rete esiste");
  assert.match(sezione, /m-line-battery-grid/, "anche nella scena mobile");
  assert.match(sezione, /id\.includes\("battery-grid"\)\) return flussi\.batteryToGrid/,
    "l'arco legge il suo flusso, non la somma sul solare");
});
