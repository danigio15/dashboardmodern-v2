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

test("le caselle della colonnina sono nove, e si riconoscono", () => {
  assert.equal(CASELLE_DELLA_WALLBOX.length, 9);
  assert.equal(eDellaWallbox("dm.ev_potenza_wallbox"), true);
  assert.equal(eDellaWallbox("dm.ev_modalita_ricarica_evcc"), true);
  /* Il cavo lo sa la colonnina: e' di casa. Il target no — lo porta anche
   * l'auto, per la vettura che ha il suo limite. */
  assert.equal(eDellaWallbox("dm.ev_cavo_collegato"), true);
  assert.equal(eDellaWallbox("dm.ev_target_soc"), false);
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

/* «Il menu a tendina della percentuale di ricarica evcc non funziona.» Nella
 * casella del target c'era il sensore dell'auto, di sola lettura: la tendina
 * mandava ordini nel vuoto. Da evcc si prende il limite che si comanda. */
test("da evcc arriva il limite di carica che si comanda, non le sue copie di sola lettura", () => {
  const { mappa } = legaLaWallboxAlDispositivo({
    entities: [
      voce("sensor.evcc_lp1_effective_limit_soc", { name: "Loadpoint 1 Effective limit SoC", unit: "%" }),
      voce("sensor.evcc_lp1_vehicle_limit_soc", { name: "Loadpoint 1 Vehicle limit SoC", unit: "%" }),
      voce("number.evcc_lp1_min_soc", { name: "Loadpoint 1 Min SoC", unit: "%" }),
      voce("number.evcc_lp1_limit_soc", { name: "Loadpoint 1 Limit SoC", unit: "%" }),
      voce("select.evcc_lp1_mode", { name: "Loadpoint 1 Mode" }),
    ],
  });
  assert.equal(mappa["dm.ev_target_soc"], "number.evcc_lp1_limit_soc");
  /* Anche come tendina, com'e' in altre versioni. */
  const tendina = legaLaWallboxAlDispositivo({
    entities: [voce("select.evcc_lp1_limitsoc", { name: "Loadpoint 1 limitSoc" })],
  });
  assert.equal(tendina.mappa["dm.ev_target_soc"], "select.evcc_lp1_limitsoc");
  /* Un sensore da solo non basta: meglio la casella vuota che una tendina muta. */
  const sensore = legaLaWallboxAlDispositivo({
    entities: [voce("sensor.wb_target_soc", { name: "Target SoC", unit: "%" })],
  });
  assert.equal("dm.ev_target_soc" in sensore.mappa, false);
});

/* «Lo stato dice off ma la vettura e' collegata.» Il cavo lo dice la
 * colonnina, con un sensore suo: quello va nella casella del cavo, e il
 * «charging» acceso/spento no, perche' non e' un cavo. */
test("da evcc e dalle colonnine arriva il sensore del cavo, e non quello della carica", () => {
  const { mappa } = legaLaWallboxAlDispositivo({
    entities: [
      voce("binary_sensor.evcc_lp1_charging", { name: "Loadpoint 1 Charging" }),
      voce("binary_sensor.evcc_lp1_connected", { name: "Loadpoint 1 Connected" }),
    ],
  });
  assert.equal(mappa["dm.ev_cavo_collegato"], "binary_sensor.evcc_lp1_connected");
  const goe = legaLaWallboxAlDispositivo({
    entities: [voce("binary_sensor.goe_car_plugged", { name: "go-e Car plugged" })],
  });
  assert.equal(goe.mappa["dm.ev_cavo_collegato"], "binary_sensor.goe_car_plugged");
  const senza = legaLaWallboxAlDispositivo({
    entities: [voce("binary_sensor.wb_charging", { name: "Charging" })],
  });
  assert.equal("dm.ev_cavo_collegato" in senza.mappa, false);
});

test("una tendina che non dice di essere la modalità non viene presa", () => {
  /* Una colonnina pubblica anche altre tendine — il blocco del cavo, la scelta
   * delle fasi. Prendendo la prima qualunque, la plancia accendeva i tasti
   * della modalità e ci mandava dentro «pv» o «now»: un comando vero, a un
   * selettore che parla di un'altra cosa. Meglio la console spenta. */
  const { mappa, evcc } = legaLaWallboxAlDispositivo({
    entities: [
      voce("select.wb_blocco_cavo", { name: "Cable lock" }),
      voce("sensor.wb_power", { name: "Charging power", device_class: "power" }),
    ],
  });
  assert.equal("dm.ev_modalita_ricarica_evcc" in mappa, false);
  assert.equal(evcc, false);
  /* Quella che lo dice sì, in tutte le lingue in cui lo dicono le integrazioni. */
  for (const [id, nome] of [
    ["select.evcc_lp1_mode", "Loadpoint 1 Charge mode"],
    ["select.wb_lademodus", "Lademodus"],
    ["select.wb_modalita", "Modalità di ricarica"],
  ])
    assert.equal(
      legaLaWallboxAlDispositivo({ entities: [voce(id, { name: nome })] }).mappa[
        "dm.ev_modalita_ricarica_evcc"
      ],
      id,
    );
});

test("la prima auto importata è anche quella in uso", () => {
  /* Le caselle di una vettura vivono nel suo profilo; quelle da cui il disegno
   * legge sono le mappature globali, e a travasarle è il gesto di mettere in
   * uso. Con una macchina sola quel gesto non lo faceva nessuno: la vettura
   * appena importata usciva senza un dato. */
  const sorgente = readFileSync(
    join(RADICE, "src/sections/auto-integrazione-section.js"),
    "utf8",
  );
  assert.match(sorgente, /if \(!auto\.length\) \{\s*try \{\s*root\.cdEvApplyCar\?\.\(0\);/);
});
