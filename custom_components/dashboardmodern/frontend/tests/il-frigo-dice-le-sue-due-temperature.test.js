/* «Ho un frigorifero smart: ha cinque temperature diverse — ambiente, target
 * frigo, attuale frigo, target freezer, attuale freezer — e mi ha preso in
 * automatico quella ambiente, che e' inutile.»
 *
 * Due cose, e la prima e' la piu' importante: la scelta automatica prendeva il
 * PRIMO sensore in gradi che trovava. Su un apparecchio che ne pubblica cinque
 * il primo era «ambiente», cioe' la stanza intorno — il numero che di
 * quell'apparecchio non dice niente. Adesso i nomi che parlano della stanza o
 * di un obiettivo si mettono da parte, e se restano ancora piu' candidati non
 * si sceglie: una casella vuota si nota, un numero sbagliato no.
 *
 * La seconda: i vani sono due, e le caselle adesso pure.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { temperatureInfo } from "../src/core/appliance-card-view-model.js";

const gradi = (nome, valore) => ({
  state: String(valore),
  attributes: { friendly_name: nome, unit_of_measurement: "°C" },
});

/* Le cinque che pubblica il frigorifero, nell'ordine in cui arrivano. */
const STATI = {
  "sensor.frigo_ambiente": gradi("Frigorifero temperatura ambiente", 26),
  "sensor.frigo_target": gradi("Frigorifero target frigo", 4),
  "sensor.frigo_attuale": gradi("Frigorifero frigo", 5.2),
  "sensor.freezer_target": gradi("Frigorifero target freezer", -18),
  "sensor.freezer_attuale": gradi("Frigorifero freezer", -19.4),
};

const CINQUE = Object.keys(STATI);

test("con cinque temperature non se ne sceglie nessuna a caso", () => {
  const lettura = temperatureInfo({ entities: CINQUE }, STATI);
  assert.equal(lettura, null, "meglio nessun numero che quello della stanza");
});

test("l'ambiente non viene mai scelto quando c'e' dell'altro", () => {
  const lettura = temperatureInfo(
    { entities: ["sensor.frigo_ambiente", "sensor.frigo_attuale"] },
    STATI,
  );
  assert.equal(lettura?.value, 5.2);
});

test("con una temperatura sola si prende quella, anche se e' l'ambiente", () => {
  const lettura = temperatureInfo({ entities: ["sensor.frigo_ambiente"] }, STATI);
  assert.equal(lettura?.value, 26, "qualcosa e' meglio di niente");
});

test("la casella scelta a mano vince sull'indovinello", () => {
  const lettura = temperatureInfo(
    { entities: CINQUE, temperature_entity: "sensor.freezer_attuale" },
    STATI,
  );
  assert.equal(lettura?.value, -19.4);
});

test("la seconda casella legge la seconda temperatura, e non indovina mai", () => {
  const device = {
    entities: CINQUE,
    temperature_entity: "sensor.frigo_attuale",
    temperature_entity_2: "sensor.freezer_attuale",
  };
  assert.equal(temperatureInfo(device, STATI, 1)?.value, 5.2);
  assert.equal(temperatureInfo(device, STATI, 2)?.value, -19.4);
  /* Lasciata vuota resta vuota: un secondo numero indovinato sarebbe lo stesso
     errore di prima, raddoppiato. */
  assert.equal(temperatureInfo({ entities: CINQUE }, STATI, 2), null);
});
