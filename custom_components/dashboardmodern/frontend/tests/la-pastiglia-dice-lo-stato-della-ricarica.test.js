/* La pastiglia sulla foto dell'auto torna a dire «Non connessa», «Collegata»,
 * «In carica».
 *
 * «Lo stato dice off ma la vettura e' collegata ora. E' in carica, dice on:
 * prima usciva come stato non collegato, collegato, in ricarica.» La casella
 * dello stato si era riempita con un `binary_sensor.charging` dalla
 * colonnina, e la pastiglia stampava la parola grezza.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
   * rispondere, e se nemmeno quella parla NON si inventa un cavo fuori — si
   * dice quello che si sa, «non in carica». */
  assert.equal(codice("off", { potenza: 3200 }), "B");
  assert.equal(codice("off"), "N");
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

test("il cavo lo dice solo il suo sensore, non un «off» di carica", () => {
  const sezione = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "src", "sections", "ev-stato-e-target-section.js"),
    "utf8",
  );
  assert.match(sezione, /function cavoDichiarato\(\)/);
  assert.match(sezione, /collegata: cavoDichiarato\(\)/);
  /* `vehiclePlugged` indovina dalla potenza e dalle parole dello stato — va
   * bene per la foto, non per una pastiglia che dice «Non connessa». */
  assert.doesNotMatch(sezione, /vehiclePlugged/);
});

test("«connected» con la potenza che passa e' in carica", () => {
  assert.equal(codice("Connected", { potenza: 5000 }), "C");
  assert.equal(codice("Connected", { potenza: 0 }), "B");
});

/* Il pallino verde col trattino (#326).
 *
 * «Il pallino verde con il trattino a cosa si riferisce?» A niente: nel guscio
 * il verde e' il ramo «nessun codice», cioe' proprio il caso in cui la plancia
 * non ha da leggere nulla sulla ricarica — e in una fila di pastiglie il verde
 * vuol dire «tutto bene». Se nessuna delle fonti e' mappata la pastiglia
 * adesso sparisce; se ci sono e non hanno ancora risposto resta dov'e', che
 * fra un attimo parlano. */
test("senza una fonte da cui sapere della ricarica la pastiglia non resta verde", () => {
  const sezione = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "src", "sections", "ev-stato-e-target-section.js"),
    "utf8",
  );
  assert.match(sezione, /function sorgenteDellaRicarica\(\)/);
  /* Le fonti sono quelle da cui il codice si ricava, non altre. */
  for (const ref of ["dm.ev_stato_ricarica", "dm.ev_cavo_collegato", "dm.ev_potenza_wallbox"])
    assert.ok(sezione.includes(`"${ref}"`), ref);
  assert.match(sezione, /scatolaMuta\.hidden = !sorgenteDellaRicarica\(\)/);
  /* E quando invece qualcosa da dire c'e', la pastiglia torna. */
  assert.match(sezione, /if \(scatola\.hidden\) scatola\.hidden = false;/);
});
