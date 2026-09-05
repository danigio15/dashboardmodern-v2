/* Quale entita' del dispositivo va in quale casella dell'auto.
 *
 * «Vogliamo cercare di fare la stessa cosa integrazione anche su auto, cosi'
 * viene piu' pulita.» L'assegnazione e' una funzione pura su un elenco di
 * entita': si prova a tavolino, con le entita' di auto vere, senza accendere
 * niente.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { legaLAutoAlDispositivo, motoreDalleCaselle } from "../src/core/auto-device-binding.js";

/* Un dispositivo come lo descrive Home Assistant: l'elenco delle entita' e la
 * tabella degli stati, che e' dove stanno `device_class` e unita'. */
function dispositivo(righe) {
  const entities = righe.map(([entity_id, name, extra = {}]) => ({
    entity_id,
    name,
    device_class: extra.device_class || "",
    unit: extra.unit || "",
    category: extra.category || "",
    disabled: false,
  }));
  const states = Object.fromEntries(
    righe.map(([entity_id, name, extra = {}]) => [
      entity_id,
      {
        state: extra.state ?? "1",
        attributes: {
          friendly_name: name,
          ...(extra.device_class ? { device_class: extra.device_class } : {}),
          ...(extra.unit ? { unit_of_measurement: extra.unit } : {}),
        },
      },
    ]),
  );
  return legaLAutoAlDispositivo({ entities, states });
}

test("un'auto a benzina: serbatoio, autonomia, contachilometri e il resto", () => {
  const { mappa, tipo } = dispositivo([
    ["sensor.tucson_fuel_level", "TUCSON Fuel level", { unit: "%" }],
    ["sensor.tucson_range", "TUCSON Range", { device_class: "distance", unit: "km" }],
    ["sensor.tucson_odometer", "TUCSON Odometer", { unit: "km" }],
    ["sensor.tucson_battery_12v", "TUCSON 12V battery level", { unit: "%" }],
    ["binary_sensor.tucson_doors", "TUCSON Doors", { device_class: "door" }],
    ["binary_sensor.tucson_trunk", "TUCSON Trunk", { device_class: "opening" }],
    ["binary_sensor.tucson_hood", "TUCSON Hood", { device_class: "opening" }],
    ["device_tracker.tucson", "TUCSON Location"],
  ]);
  assert.equal(mappa["dm.ev_carburante"], "sensor.tucson_fuel_level");
  assert.equal(mappa["dm.ev_autonomia"], "sensor.tucson_range");
  assert.equal(mappa["dm.ev_odometro"], "sensor.tucson_odometer");
  assert.equal(mappa["dm.ev_portiere"], "binary_sensor.tucson_doors");
  assert.equal(mappa["dm.ev_bagagliaio"], "binary_sensor.tucson_trunk");
  assert.equal(mappa["dm.ev_cofano"], "binary_sensor.tucson_hood");
  assert.equal(mappa["dm.ev_posizione"], "device_tracker.tucson");
  /* Un serbatoio senza batteria di trazione e' un'auto a benzina. */
  assert.equal(tipo, "termica");
});

test("la batteria da 12 V non si prende il posto di quella di trazione", () => {
  /* Sono tutte e due percentuali, e la prima che passa vincerebbe: la
   * distinzione la fanno le parole, e si chiede prima quella di servizio. */
  const { mappa, tipo } = dispositivo([
    ["sensor.auto_batteria_12v", "Auto Batteria di servizio", { unit: "%" }],
    ["sensor.auto_soc", "Auto Battery", { device_class: "battery", unit: "%" }],
  ]);
  assert.equal(mappa["dm.ev_batteria_servizio"], "sensor.auto_batteria_12v");
  assert.equal(mappa["dm.ev_batteria_auto"], "sensor.auto_soc");
  assert.equal(tipo, "");
});

test("un'ibrida ha tutti e due, e lo dice", () => {
  const { tipo } = dispositivo([
    ["sensor.ibrida_fuel", "Livello carburante", { unit: "%" }],
    ["sensor.ibrida_soc", "Batteria", { device_class: "battery", unit: "%" }],
  ]);
  assert.equal(tipo, "ibrida");
});

test("le impostazioni del dispositivo non entrano nell'auto", () => {
  /* Il volume dell'avvisatore sta nel pannello del dispositivo, non sulla card
   * di chi guarda quanta benzina ha. */
  const { mappa } = dispositivo([
    ["number.auto_volume", "Volume", { category: "config" }],
    ["sensor.auto_fuel", "Fuel level", { unit: "%", category: "config" }],
  ]);
  assert.deepEqual(mappa, {});
});

test("un'entita' presa non finisce anche in un'altra casella", () => {
  /* «Odometer» e «Last trip» sono tutti e due chilometri: se la prima
   * domanda non togliesse l'entita' dal mazzo, lo stesso sensore sarebbe
   * insieme il contachilometri e l'ultimo viaggio. */
  const { mappa } = dispositivo([
    ["sensor.auto_odometer", "Odometer", { unit: "km" }],
    ["sensor.auto_last_trip", "Last trip distance", { unit: "km" }],
  ]);
  assert.equal(mappa["dm.ev_odometro"], "sensor.auto_odometer");
  assert.equal(mappa["dm.ev_ultimo_viaggio"], "sensor.auto_last_trip");
  const presi = Object.values(mappa);
  assert.equal(new Set(presi).size, presi.length, "nessuna entita' in due caselle");
});

test("le quattro gomme vanno ognuna alla sua ruota", () => {
  const { mappa } = dispositivo([
    ["sensor.auto_tyre_fl", "Tyre pressure front left", { unit: "bar" }],
    ["sensor.auto_tyre_fr", "Tyre pressure front right", { unit: "bar" }],
    ["sensor.auto_tyre_rl", "Tyre pressure rear left", { unit: "bar" }],
    ["sensor.auto_tyre_rr", "Tyre pressure rear right", { unit: "bar" }],
  ]);
  assert.equal(mappa["dm.ev_pneumatico_ant_sx"], "sensor.auto_tyre_fl");
  assert.equal(mappa["dm.ev_pneumatico_ant_dx"], "sensor.auto_tyre_fr");
  assert.equal(mappa["dm.ev_pneumatico_post_sx"], "sensor.auto_tyre_rl");
  assert.equal(mappa["dm.ev_pneumatico_post_dx"], "sensor.auto_tyre_rr");
});

test("le parole si leggono nelle lingue che le integrazioni usano davvero", () => {
  /* Il costruttore tedesco scrive «Reichweite», quello francese «Autonomie»:
   * un vocabolario di solo inglese lascerebbe vuote meta' delle caselle. */
  const tedesca = dispositivo([
    ["sensor.auto_reichweite", "Reichweite", { unit: "km" }],
    ["sensor.auto_kilometerstand", "Kilometerstand", { unit: "km" }],
    ["binary_sensor.auto_kofferraum", "Kofferraum"],
    ["binary_sensor.auto_motorhaube", "Motorhaube"],
  ]).mappa;
  assert.equal(tedesca["dm.ev_autonomia"], "sensor.auto_reichweite");
  assert.equal(tedesca["dm.ev_odometro"], "sensor.auto_kilometerstand");
  assert.equal(tedesca["dm.ev_bagagliaio"], "binary_sensor.auto_kofferraum");
  assert.equal(tedesca["dm.ev_cofano"], "binary_sensor.auto_motorhaube");

  const italiana = dispositivo([
    ["sensor.auto_autonomia", "Autonomia", { unit: "km" }],
    ["sensor.auto_contachilometri", "Contachilometri", { unit: "km" }],
  ]).mappa;
  assert.equal(italiana["dm.ev_autonomia"], "sensor.auto_autonomia");
  assert.equal(italiana["dm.ev_odometro"], "sensor.auto_contachilometri");
});

test("da un dispositivo che non e' un'auto non esce nessuna casella", () => {
  /* Chi sceglie il dispositivo sbagliato deve sentirselo dire, non ritrovarsi
   * un'auto vuota. */
  const { mappa } = dispositivo([
    ["switch.presa_cucina", "Presa cucina"],
    ["sensor.presa_cucina_potenza", "Presa cucina Power", { device_class: "power", unit: "W" }],
  ]);
  assert.deepEqual(mappa, {});
});

test("il motore lo dicono le caselle, e nel dubbio si tace", () => {
  assert.equal(motoreDalleCaselle({ "dm.ev_carburante": "sensor.a" }), "termica");
  assert.equal(
    motoreDalleCaselle({ "dm.ev_carburante": "sensor.a", "dm.ev_batteria_auto": "sensor.b" }),
    "ibrida",
  );
  /* «» e' «elettrica», che e' il valore di sempre: dichiarare un motore
   * sbagliato nasconderebbe meta' della pagina. */
  assert.equal(motoreDalleCaselle({ "dm.ev_batteria_auto": "sensor.b" }), "");
  assert.equal(motoreDalleCaselle({}), "");
});
