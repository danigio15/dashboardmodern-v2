/* «Aggiungere anche evcc e la wallbox.»
 *
 * Due cose in una. La colonnina entra da un'integrazione come l'auto, invece
 * di otto caselle da scrivere a mano sapendo gli entity_id a memoria. E la
 * colonnina e' DELLA CASA: chi ha due vetture ne ha una sola, e la potenza che
 * sta erogando e' la stessa qualunque macchina sia attaccata.
 *
 * La seconda meta' era un difetto vero: mettere in uso una vettura riscriveva
 * TUTTE le `dm.ev_*` con quelle del suo profilo, e una colonnina mappata nella
 * scheda Entita' spariva al primo cambio d'auto.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  CASELLE_DELLA_WALLBOX,
  eDellaWallbox,
  legaLaWallboxAlDispositivo,
} from "../src/core/wallbox-device-binding.js";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));

const voce = (entity_id, extra = {}) => ({ entity_id, name: entity_id, ...extra });

test("da evcc arrivano modalità, potenza, sessione e quota di sole", () => {
  const { mappa, evcc } = legaLaWallboxAlDispositivo({
    entities: [
      voce("select.evcc_loadpoint_1_mode", { name: "Loadpoint 1 Charge mode" }),
      voce("sensor.evcc_loadpoint_1_power", { name: "Loadpoint 1 Power", device_class: "power" }),
      voce("sensor.evcc_loadpoint_1_session_energy", {
        name: "Loadpoint 1 Session energy",
        device_class: "energy",
      }),
      voce("sensor.evcc_loadpoint_1_session_solar_percentage", {
        name: "Loadpoint 1 Session solar percentage",
        unit: "%",
      }),
    ],
  });
  assert.equal(evcc, true);
  assert.equal(mappa["dm.ev_modalita_ricarica_evcc"], "select.evcc_loadpoint_1_mode");
  assert.equal(mappa["dm.ev_potenza_wallbox"], "sensor.evcc_loadpoint_1_power");
  assert.equal(mappa["dm.ev_energia_sessione"], "sensor.evcc_loadpoint_1_session_energy");
  assert.equal(
    mappa["dm.ev_percentuale_solare_sessione"],
    "sensor.evcc_loadpoint_1_session_solar_percentage",
  );
});

test("una colonnina nuda porta quello che ha, e non si spaccia per evcc", () => {
  const { mappa, evcc } = legaLaWallboxAlDispositivo({
    entities: [
      voce("sensor.easee_power", { name: "Easee Charging power", device_class: "power" }),
      voce("sensor.easee_energy_today", { name: "Easee Energy today", device_class: "energy" }),
      voce("sensor.easee_energy_month", { name: "Easee Energy month", device_class: "energy" }),
      voce("sensor.easee_voltage", { name: "Easee Voltage", device_class: "voltage" }),
      voce("sensor.easee_temperature", { name: "Easee Temperature", device_class: "temperature" }),
    ],
  });
  assert.equal(evcc, false);
  assert.equal(mappa["dm.ev_potenza_wallbox"], "sensor.easee_power");
  assert.equal(mappa["dm.ev_energia_wallbox_oggi"], "sensor.easee_energy_today");
  assert.equal(mappa["dm.ev_energia_wallbox_mese"], "sensor.easee_energy_month");
  assert.equal(mappa["dm.ev_tensione_wallbox"], "sensor.easee_voltage");
  assert.equal(mappa["dm.ev_temperatura_wallbox"], "sensor.easee_temperature");
  /* Senza tendina non c'e' modalita': una wallbox nuda non la pubblica, e
   * inventarla vorrebbe dire mettere quattro tasti che non comandano niente. */
  assert.equal("dm.ev_modalita_ricarica_evcc" in mappa, false);
});

test("un'entità presa non finisce in due caselle", () => {
  /* «Energia oggi» e «energia mese» si somigliano abbastanza da prendersi la
   * stessa entita' se nessuno le tiene separate. */
  const { mappa } = legaLaWallboxAlDispositivo({
    entities: [voce("sensor.wb_energia", { name: "Wallbox energia oggi", device_class: "energy" })],
  });
  assert.equal(mappa["dm.ev_energia_wallbox_oggi"], "sensor.wb_energia");
  assert.equal("dm.ev_energia_wallbox_mese" in mappa, false);
});

test("le impostazioni del dispositivo non sono la colonnina", () => {
  const { mappa } = legaLaWallboxAlDispositivo({
    entities: [
      voce("select.wb_led_brightness", { name: "LED mode", category: "config" }),
      voce("select.wb_mode", { name: "Charge mode" }),
    ],
  });
  assert.equal(mappa["dm.ev_modalita_ricarica_evcc"], "select.wb_mode");
});

test("le caselle della colonnina sono otto, e si riconoscono", () => {
  assert.equal(CASELLE_DELLA_WALLBOX.length, 8);
  assert.equal(eDellaWallbox("dm.ev_potenza_wallbox"), true);
  assert.equal(eDellaWallbox("dm.ev_modalita_ricarica_evcc"), true);
  /* La batteria e l'autonomia sono dell'auto: cambiare vettura le cambia. */
  assert.equal(eDellaWallbox("dm.ev_batteria_auto"), false);
  assert.equal(eDellaWallbox("dm.ev_autonomia"), false);
  assert.equal(eDellaWallbox(""), false);
});

test("mettere in uso un'auto non porta via la colonnina", () => {
  /* Il giro qui dentro riscriveva ogni `dm.ev_*` con quelle del profilo. Le
   * caselle della colonnina adesso restano, e quelle dell'auto no: e' la
   * differenza fra una cosa della casa e una di una macchina. */
  const sorgente = readFileSync(join(RADICE, "src/sections/ev-section.js"), "utf8");
  assert.match(
    sorgente,
    /if \(!String\(chiave\)\.startsWith\("dm\.ev_"\) \|\| eDellaWallbox\(chiave\)\)/,
  );
  assert.match(sorgente, /import \{ eDellaWallbox \} from "\.\.\/core\/wallbox-device-binding\.js"/);
});

test("il pulsante della colonnina sta nella scheda Auto, accanto a quello dell'auto", () => {
  const sorgente = readFileSync(join(RADICE, "src/sections/auto-integrazione-section.js"), "utf8");
  assert.match(sorgente, /data-wallbox-integ/);
  assert.match(sorgente, /export function anteprimaWallbox/);
  assert.match(sorgente, /export function collegaLaWallbox/);
  /* Si scrive nelle caselle della casa, non dentro un profilo di vettura. */
  assert.match(sorgente, /writeJsonIfChanged\("cd_entity_overrides", prossime\)/);
});
