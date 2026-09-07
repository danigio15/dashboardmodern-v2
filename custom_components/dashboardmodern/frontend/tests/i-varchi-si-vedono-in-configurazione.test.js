/* «In verde dovrebbe segnare i sensori contact chiusi e in rosso quelli
 * aperti … almeno a colpo d'occhio so quante finestre sono aperte in questo
 * momento.» (#367)
 *
 * In configurazione un contatto porta-finestra era una riga con dentro un
 * entity_id e basta: diceva come si chiama, non come sta.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  comeStaIlVarco,
  contaIVarchi,
  eUnVarco,
} from "../src/core/varchi-in-configurazione.js";
import { insiemeInvertiti } from "../src/core/verso-aperture.js";

const varco = (dc, stato) => ({ state: stato, attributes: { device_class: dc } });

const CASA = {
  "binary_sensor.finestra_cucina": varco("window", "on"),
  "binary_sensor.finestra_bagno": varco("window", "off"),
  "binary_sensor.porta_ingresso": varco("door", "off"),
  "binary_sensor.garage": varco("garage_door", "on"),
  /* Girato: sta a ON quando e' CHIUSA (#244). */
  "binary_sensor.finestra_camera": varco("window", "on"),
  /* Non e' un varco, e non deve colorarsi. */
  "binary_sensor.movimento_salotto": varco("motion", "on"),
  "sensor.temperatura_cucina": { state: "21", attributes: { device_class: "temperature" } },
  /* Muto: non e' una finestra chiusa. */
  "binary_sensor.finestra_soffitta": varco("window", "unavailable"),
};

test("si colora un varco, non un sensore qualunque", () => {
  assert.equal(eUnVarco("binary_sensor.finestra_cucina", CASA["binary_sensor.finestra_cucina"]), true);
  assert.equal(eUnVarco("binary_sensor.garage", CASA["binary_sensor.garage"]), true);
  assert.equal(
    eUnVarco("binary_sensor.movimento_salotto", CASA["binary_sensor.movimento_salotto"]),
    false,
  );
  assert.equal(
    eUnVarco("sensor.temperatura_cucina", CASA["sensor.temperatura_cucina"]),
    false,
    "un sensore non e' un varco per quanto stia in una finestra",
  );
});

test("aperto e chiuso, col verso di Home Assistant", () => {
  assert.equal(comeStaIlVarco("binary_sensor.finestra_cucina", CASA["binary_sensor.finestra_cucina"]), "aperto");
  assert.equal(comeStaIlVarco("binary_sensor.finestra_bagno", CASA["binary_sensor.finestra_bagno"]), "chiuso");
});

test("un contatto girato lo dice al contrario, e lo si sa gia'", () => {
  /* Il verso non si decide qui: lo dice la lista che la plancia tiene gia'
   * (#244). Averne una seconda regola vorrebbe dire che la configurazione
   * dice il contrario della plancia. */
  const girati = insiemeInvertiti(["binary_sensor.finestra_camera"]);
  assert.equal(
    comeStaIlVarco("binary_sensor.finestra_camera", CASA["binary_sensor.finestra_camera"], girati),
    "chiuso",
  );
});

test("un sensore muto non e' una finestra chiusa", () => {
  assert.equal(
    comeStaIlVarco("binary_sensor.finestra_soffitta", CASA["binary_sensor.finestra_soffitta"]),
    "",
  );
});

test("il conto risponde alla domanda vera: quante ne sono aperte", () => {
  const girati = insiemeInvertiti(["binary_sensor.finestra_camera"]);
  const conto = contaIVarchi(Object.keys(CASA), CASA, girati);
  /* Aperte: cucina e garage. Chiuse: bagno, ingresso, e la camera girata.
   * Muta: la soffitta. Il movimento e la temperatura non contano. */
  assert.deepEqual(conto, { aperti: 2, chiusi: 3, muti: 1, totale: 6 });
});

test("chi non risponde non viene contato chiuso", () => {
  /* Contarlo chiuso sarebbe una bugia tranquillizzante: si direbbe «tutte
   * chiuse» con una finestra che non si sa. */
  const conto = contaIVarchi(["binary_sensor.finestra_soffitta"], CASA);
  assert.equal(conto.chiusi, 0);
  assert.equal(conto.muti, 1);
});
