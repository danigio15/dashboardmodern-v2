/* «La scheda friggitrice ad aria prende i valori di temperatura, umidità e
 * qualità dell'aria da un Air quality monitor di Amazon che ho integrato, senza
 * però che nessuno abbia detto di farlo da nessuna parte … anche la temperatura
 * esterna non è utile per ciò che deve fare la friggitrice.» (#374)
 *
 * La barra della temperatura la card la disegna solo per gli apparecchi che
 * tengono il freddo: si vede dai confini che sceglie — da -25 a -10 per un
 * congelatore, da 0 a 10 per un frigorifero. Su tutto il resto quella barra non
 * c'e', e indovinare un sensore per riempirla era lavoro fatto per niente che
 * pero' un numero lo tirava fuori lo stesso: quasi sempre la stanza, non
 * l'apparecchio.
 *
 * Adesso si indovina solo dove una temperatura vuol dire qualcosa. Chi ce l'ha
 * davvero e non e' in quell'elenco la scrive nella sua casella, che e' li'
 * apposta: una casella vuota si nota, un numero sbagliato no.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { temperatureInfo } from "../src/core/appliance-card-view-model.js";

const MONITOR = {
  "sensor.air_monitor_temp": {
    state: "23.4",
    attributes: { unit_of_measurement: "°C", friendly_name: "Air monitor temperatura" },
  },
};

test("una friggitrice non si prende la temperatura di un sensore d'ambiente", () => {
  const friggitrice = {
    name: "Friggitrice ad aria",
    device_type: "friggitrice",
    visual_key: "friggitrice",
    entities: ["switch.sonoff_friggitrice", "sensor.air_monitor_temp"],
  };
  assert.equal(temperatureInfo(friggitrice, MONITOR), null);
});

test("un frigorifero se la prende ancora: e' la sua barra", () => {
  const frigo = {
    name: "Frigorifero",
    device_type: "fridge",
    visual_key: "fridge",
    entities: ["sensor.air_monitor_temp"],
  };
  const lettura = temperatureInfo(frigo, MONITOR);
  assert.equal(lettura.value, 23.4);
  assert.equal(lettura.min, 0);
  assert.equal(lettura.max, 10);
});

test("un congelatore pure, coi suoi confini", () => {
  const congelatore = {
    name: "Congelatore",
    device_type: "congelatore",
    entities: ["sensor.air_monitor_temp"],
  };
  const lettura = temperatureInfo(congelatore, MONITOR);
  assert.equal(lettura.min, -25);
  assert.equal(lettura.max, -10);
});

test("chi la casella la riempie a mano la vede comunque", () => {
  /* La regola nuova tocca solo l'indovinare. Una friggitrice con una sonda
   * vera — c'e' chi ce l'ha — la scrive li' e la card la mostra. */
  const friggitrice = {
    name: "Friggitrice ad aria",
    device_type: "friggitrice",
    temperature_entity: "sensor.sonda_friggitrice",
    entities: ["sensor.sonda_friggitrice"],
  };
  const stati = {
    "sensor.sonda_friggitrice": { state: "180", attributes: { unit_of_measurement: "°C" } },
  };
  assert.equal(temperatureInfo(friggitrice, stati).value, 180);
});
