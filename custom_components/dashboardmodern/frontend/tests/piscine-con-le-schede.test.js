/* Con piu' di una piscina si sceglie la vasca, non si scorre.
 *
 * La pagina le impilava: per arrivare alla seconda si scorreva oltre tutta la
 * prima — vasca, qualita' dell'acqua, filtrazione — e confrontarle voleva dire
 * andare su e giu'. Le schede in cima mostrano una vasca per volta.
 *
 * Qui si prova la regola che decide quale scheda e' accesa: e' l'unica parte
 * che puo' sbagliare da sola, quando una piscina viene tolta mentre la si sta
 * guardando.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { poolScelta } from "../src/sections/pool-irrigation-scene-section.js";

const vasche = (...indici) => indici.map((index) => ({ index, id: `p${index}` }));

test("senza piscine non si sceglie niente", () => {
  assert.equal(poolScelta([], 3), 0);
});

test("la scelta di prima regge se la piscina c'e' ancora", () => {
  assert.equal(poolScelta(vasche(0, 1, 2), 2), 2);
});

test("tolta la piscina che si guardava si torna alla prima", () => {
  assert.equal(poolScelta(vasche(0, 1), 5), 0);
});

test("con una piscina sola la scelta e' quella", () => {
  assert.equal(poolScelta(vasche(0), 0), 0);
});

test("se la prima non e' l'indice zero si prende comunque quella che c'e'", () => {
  assert.equal(poolScelta(vasche(2, 3), 9), 2);
});
