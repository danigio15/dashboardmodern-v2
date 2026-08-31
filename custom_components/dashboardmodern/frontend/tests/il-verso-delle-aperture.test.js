/* Il verso invertito di sensori e tapparelle (#244), provato a secco. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CHIAVE_VERSI,
  apertaSecondoVerso,
  insiemeInvertiti,
  posizioneSecondoVerso,
  versoInvertito,
} from "../src/core/verso-aperture.js";

test("la lista grezza diventa un insieme pulito", () => {
  const versi = insiemeInvertiti([" binary_sensor.porta ", "", null, "binary_sensor.finestra"]);
  assert.equal(versi.size, 2);
  assert.ok(versi.has("binary_sensor.porta"));
  assert.equal(insiemeInvertiti(null).size, 0);
  assert.equal(insiemeInvertiti("roba").size, 0);
});

test("il sensore girato dice il contrario, il muto resta muto", () => {
  assert.equal(apertaSecondoVerso(true, false), true);
  assert.equal(apertaSecondoVerso(true, true), false);
  assert.equal(apertaSecondoVerso(false, true), true);
  assert.equal(apertaSecondoVerso(null, true), null);
  assert.equal(apertaSecondoVerso(undefined, true), undefined);
});

test("la posizione girata legge 100 come 0, e traduce anche in scrittura", () => {
  assert.equal(posizioneSecondoVerso(100, true), 0);
  assert.equal(posizioneSecondoVerso(0, true), 100);
  assert.equal(posizioneSecondoVerso(30, true), 70);
  assert.equal(posizioneSecondoVerso(30, false), 30);
  /* Andata e ritorno: scrivere quello che si e' letto non muove niente. */
  assert.equal(posizioneSecondoVerso(posizioneSecondoVerso(42, true), true), 42);
  assert.equal(posizioneSecondoVerso(null, true), null);
  assert.equal(posizioneSecondoVerso("boh", true), null);
  assert.equal(posizioneSecondoVerso(140, true), 0);
});

test("il flag della riga si riconosce nelle sue vesti", () => {
  assert.equal(versoInvertito({ invertita: true }), true);
  assert.equal(versoInvertito({ invertita: "on" }), true);
  assert.equal(versoInvertito({ inverted: true }), true);
  assert.equal(versoInvertito({}), false);
  assert.equal(versoInvertito(null), false);
});

test("la chiave della lista e' quella sincronizzata", () => {
  assert.equal(CHIAVE_VERSI, "cd_stati_invertiti");
});
