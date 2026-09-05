/* «Riordinare a piacere la Home.»
 *
 * Il gesto e' uno solo — la freccia scambia questa riga con la sua vicina — e
 * vale per le persone, per le azioni rapide e per le tessere. Scriverlo tre
 * volte vorrebbe dire tre occasioni di sbagliare l'ultimo elemento.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { siPuoSpostare, spostaNellElenco } from "../src/core/ordine-a-mano.js";

test("su e giù scambiano con la vicina", () => {
  assert.deepEqual(spostaNellElenco(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
  assert.deepEqual(spostaNellElenco(["a", "b", "c"], 1, 1), ["a", "c", "b"]);
});

test("ai bordi non si sposta niente, e l'elenco resta quello", () => {
  assert.deepEqual(spostaNellElenco(["a", "b"], 0, -1), ["a", "b"]);
  assert.deepEqual(spostaNellElenco(["a", "b"], 1, 1), ["a", "b"]);
  assert.equal(siPuoSpostare(["a", "b"], 0, -1), false);
  assert.equal(siPuoSpostare(["a", "b"], 1, 1), false);
  assert.equal(siPuoSpostare(["a", "b"], 0, 1), true);
});

test("l'elenco di partenza non si tocca", () => {
  const prima = ["a", "b", "c"];
  const dopo = spostaNellElenco(prima, 0, 1);
  assert.deepEqual(prima, ["a", "b", "c"]);
  assert.deepEqual(dopo, ["b", "a", "c"]);
});

test("quello che non è un elenco, o un indice che non c'è, non rompe niente", () => {
  assert.deepEqual(spostaNellElenco(null, 0, 1), []);
  assert.deepEqual(spostaNellElenco(["a", "b"], "x", 1), ["a", "b"]);
  assert.deepEqual(spostaNellElenco(["a", "b"], 0, 0), ["a", "b"]);
  assert.equal(siPuoSpostare(null, 0, 1), false);
});
