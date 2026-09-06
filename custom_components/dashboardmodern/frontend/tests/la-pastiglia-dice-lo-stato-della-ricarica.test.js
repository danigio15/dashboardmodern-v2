/* La pastiglia sulla foto dell'auto torna a dire «Non connessa», «Collegata»,
 * «In carica».
 *
 * «Lo stato dice off ma la vettura e' collegata ora. E' in carica, dice on:
 * prima usciva come stato non collegato, collegato, in ricarica.» La casella
 * dello stato si era riempita con un `binary_sensor.charging` dalla
 * colonnina, e la pastiglia stampava la parola grezza.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { codiceDellaRicarica } from "../src/core/stato-della-ricarica.js";

const codice = (stato, extra = {}) => codiceDellaRicarica({ stato, ...extra });

test("le lettere della norma restano quelle", () => {
  assert.equal(codice("A"), "A");
  assert.equal(codice("b"), "B");
  assert.equal(codice("C"), "C");
  assert.equal(codice("D"), "C");
  assert.equal(codice("F"), "F");
});

test("un sensore «charging» acceso e' in carica; spento, e' collegata se il cavo e' dentro", () => {
  assert.equal(codice("on"), "C");
  assert.equal(codice("off", { collegata: true }), "B");
  assert.equal(codice("off", { collegata: false }), "A");
  /* Senza il sensore del cavo, «off» dice solo «non carica»: la potenza puo'
   * rispondere, e se nemmeno quella parla non si inventa niente. */
  assert.equal(codice("off", { potenza: 3200 }), "B");
  assert.equal(codice("off"), "");
});

test("le parole delle integrazioni, con i negativi letti per primi", () => {
  assert.equal(codice("Charging"), "C");
  assert.equal(codice("charging"), "C");
  assert.equal(codice("In carica"), "C");
  assert.equal(codice("Connected"), "B");
  assert.equal(codice("plugged_in"), "B");
  assert.equal(codice("Preparing"), "B");
  assert.equal(codice("Not connected"), "A");
  assert.equal(codice("disconnected"), "A");
  assert.equal(codice("unplugged"), "A");
  assert.equal(codice("no_vehicle"), "A");
  assert.equal(codice("not_charging"), "B");
  assert.equal(codice("not_charging", { collegata: false }), "A");
  assert.equal(codice("charging_complete"), "B");
  assert.equal(codice("SuspendedEV"), "B");
  assert.equal(codice("Error"), "F");
  assert.equal(codice("fault"), "F");
});

test("senza uno stato che parli restano il cavo e la potenza", () => {
  assert.equal(codice("unknown", { potenza: 7300 }), "C");
  assert.equal(codice("unavailable", { collegata: true }), "B");
  assert.equal(codice("", { collegata: false }), "A");
  assert.equal(codice(""), "");
  assert.equal(codice(null), "");
});

test("«connected» con la potenza che passa e' in carica", () => {
  assert.equal(codice("Connected", { potenza: 5000 }), "C");
  assert.equal(codice("Connected", { potenza: 0 }), "B");
});
