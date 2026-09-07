/* «Sulla qualità aria mi devi creare da qualche parte la possibilità di
 * inserire entità e i parametri, non solo nei widget. Inseriscilo in allerte.»
 *
 * La tessera dell'aria nasce da sola: i sensori li dichiara Home Assistant col
 * `device_class`, e chi ne ha uno se la ritrova in Home senza configurare
 * niente. Va benissimo con una centralina; con due — una dentro e una fuori —
 * il verdetto lo detta la peggiore, e quella e' quasi sempre la strada davanti
 * a casa. Dal campo, la #340: «Outdoor Environment CO … lo classifica come
 * ARIA CATTIVA e come la peggiore delle 15 misure». Li' si corresse l'unita';
 * restava che quel sensore non si potesse togliere di mezzo.
 *
 * Queste prove fissano le tre cose che adesso si possono dire: togliere un
 * sensore, aggiungerne uno che il rilevamento non trova, e spostare i confini
 * di una misura. E la quarta, che conta quanto le altre tre: chi non tocca
 * niente resta esattamente dov'era.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  eUnaMisuraDellAria,
  letturaDellAria,
  misureDellAria,
  normalizzaAria,
  soglieDellaMisura,
} from "../src/core/aria-model.js";

const PM25 = {
  entity_id: "sensor.pm25_salotto",
  state: "12",
  attributes: { device_class: "pm25", unit_of_measurement: "µg/m³" },
};
const CO_FUORI = {
  entity_id: "sensor.outdoor_co",
  state: "156",
  attributes: { device_class: "carbon_monoxide", unit_of_measurement: "µg/m³" },
};

test("senza configurazione l'aria si comporta come prima", () => {
  assert.equal(eUnaMisuraDellAria("sensor.pm25_salotto", PM25), true);
  assert.equal(eUnaMisuraDellAria("sensor.pm25_salotto", PM25, undefined), true);
  assert.equal(eUnaMisuraDellAria("sensor.pm25_salotto", PM25, {}), true);
  const lettura = letturaDellAria("sensor.pm25_salotto", PM25, "it");
  assert.equal(lettura.grado, "buona");
  assert.equal(lettura.valore, 12);
});

test("un sensore escluso smette di essere dell'aria", () => {
  /* E' la centralina esterna che detta il verdetto di tutta la casa: da qui la
   * si toglie di mezzo senza spegnere la tessera. */
  const config = { escluse: ["sensor.outdoor_co"] };
  assert.equal(eUnaMisuraDellAria("sensor.outdoor_co", CO_FUORI, config), false);
  assert.equal(eUnaMisuraDellAria("sensor.pm25_salotto", PM25, config), true);
});

test("un sensore che il rilevamento non trova si aggiunge dicendo che misura e'", () => {
  /* Un template senza `device_class`: Home Assistant non sa cosa sia, chi l'ha
   * scritto si'. */
  const mio = { entity_id: "sensor.mio_pm25", state: "60", attributes: {} };
  const config = { aggiunte: { "sensor.mio_pm25": "pm25" } };
  assert.equal(eUnaMisuraDellAria("sensor.mio_pm25", mio), false, "senza dirlo non lo e'");
  assert.equal(eUnaMisuraDellAria("sensor.mio_pm25", mio, config), true);
  const lettura = letturaDellAria("sensor.mio_pm25", mio, "it", config);
  assert.equal(lettura.classe, "pm25");
  /* 60 µg/m³ di PM2.5 stanno oltre il terzo confine (50): aria cattiva. */
  assert.equal(lettura.grado, "cattiva");
});

test("i confini di una misura si possono spostare", () => {
  const config = { soglie: { pm25: [5, 10, 20] } };
  assert.deepEqual(soglieDellaMisura("pm25", config), [5, 10, 20]);
  /* Gli stessi 12 µg/m³ che erano «buona» con le fasce europee: con confini
   * più severi diventano «scarsa». */
  assert.equal(letturaDellAria("sensor.pm25_salotto", PM25, "it", config).grado, "scarsa");
  /* Chi non li tocca resta sulla norma. */
  assert.deepEqual(soglieDellaMisura("pm25", {}), [15, 25, 50]);
});

test("dei confini scritti male non si tiene conto", () => {
  /* Due gradini scambiati direbbero «cattiva» di un'aria buona, e nessuno se ne
   * accorgerebbe: si lasciano quelli della norma. */
  for (const rotte of [
    { pm25: [50, 25, 15] },
    { pm25: [10, 10, 20] },
    { pm25: [1, 2] },
    { pm25: ["a", "b", "c"] },
    { pm25: [-1, 2, 3] },
    { inventata: [1, 2, 3] },
  ])
    assert.deepEqual(normalizzaAria({ soglie: rotte }).soglie, {}, JSON.stringify(rotte));
});

test("un'aggiunta senza una misura che sappiamo leggere si butta", () => {
  const config = { aggiunte: { "sensor.x": "colore", "non-una-entita": "pm25", "sensor.y": "pm10" } };
  assert.deepEqual(normalizzaAria(config).aggiunte, { "sensor.y": "pm10" });
});

test("le misure si sanno raccontare, per farle scegliere", () => {
  const misure = misureDellAria("it");
  const pm25 = misure.find((misura) => misura.classe === "pm25");
  assert.equal(pm25.unita, "µg/m³");
  assert.deepEqual(pm25.soglie, [15, 25, 50]);
  assert.equal(pm25.nome, "PM2.5");
  /* L'editor le disegna tutte: se una nasce nel magazzino e qui non arriva,
   * resta una misura che nessuno puo' regolare. */
  assert.ok(misure.length >= 8);
  for (const misura of misure) assert.equal(misura.soglie.length, 3);
});
