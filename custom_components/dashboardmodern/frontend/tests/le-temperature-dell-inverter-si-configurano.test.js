/* «Manca la parte nel config per configurare le entita' di questa parte, sia
 * le temperature inverter che le ventole.»
 *
 * La scheda Temperature di Energia legge cinque alias — le tre temperature,
 * la potenza e l'interruttore della ventola — che nessuna maschera sapeva
 * riempire: restavano «IN ATTESA...» per sempre, a meno di conoscere il tab
 * Sostituzioni. Adesso il gruppo `cooling` del modello Energia li proietta
 * come tutti gli altri, la normalizzazione se lo porta dietro, e chi li aveva
 * gia' mappati a mano se li ritrova nel modello alla prima migrazione.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { COOLING_SLOT_MAP, projectEnergySlots } from "../src/core/energy-projection.js";
import { migrateEnergy, migrateState } from "../src/core/migrations.js";

test("il gruppo cooling si proietta sui cinque alias della scheda Temperature", () => {
  const overrides = projectEnergySlots({
    cooling: {
      inverter_ac_temperature: "sensor.inv_ac",
      inverter_dc_temperature: "sensor.inv_dc",
      battery_temperature: "sensor.bat_temp",
      fan_power: "sensor.fan_w",
      fan_switch: "switch.fan",
    },
  });
  assert.equal(overrides["dm.energy_temperatura_ac_inverter"], "sensor.inv_ac");
  assert.equal(overrides["dm.energy_temperatura_dc_inverter"], "sensor.inv_dc");
  assert.equal(overrides["dm.energy_temperatura_batteria"], "sensor.bat_temp");
  assert.equal(overrides["dm.energy_potenza_ventola_inverter"], "sensor.fan_w");
  assert.equal(overrides["dm.energy_interruttore_ventola_inverter"], "switch.fan");
});

test("svuotare un campo cooling spegne il suo alias", () => {
  const overrides = projectEnergySlots(
    { cooling: { fan_switch: "" } },
    { "dm.energy_interruttore_ventola_inverter": "switch.vecchia" },
  );
  assert.equal(overrides["dm.energy_interruttore_ventola_inverter"], undefined);
});

test("la normalizzazione del modello Energia si porta dietro cooling", () => {
  const uscita = migrateEnergy({
    house: {},
    cooling: { battery_temperature: "sensor.bat_temp" },
  });
  assert.deepEqual(uscita.cooling, { battery_temperature: "sensor.bat_temp" });
  /* E senza gruppo non ne inventa uno vuoto. */
  assert.equal("cooling" in migrateEnergy({ house: {} }), false);
});

test("gli alias mappati a mano dal tab Sostituzioni entrano nel modello, una volta sola", () => {
  const { state } = migrateState({
    schema_version: 4,
    sections: {
      energy: {},
      entityOverrides: {
        "dm.energy_temperatura_ac_inverter": "sensor.gia_mappata",
        "dm.energy_potenza_ventola_inverter": "sensor.fan_gia",
      },
    },
    visibility: {},
  });
  assert.equal(state.sections.energy.cooling.inverter_ac_temperature, "sensor.gia_mappata");
  assert.equal(state.sections.energy.cooling.fan_power, "sensor.fan_gia");
  assert.equal(state.sections.energy.metadata.cooling_migrated, true);

  /* Chi poi svuota il campo apposta non se lo vede riseminare. */
  state.sections.energy.cooling = {};
  const { state: dopo } = migrateState(state);
  assert.deepEqual(dopo.sections.energy.cooling, {});
});

test("ogni alias della scheda Temperature ha il suo campo nel gruppo", () => {
  assert.deepEqual(Object.keys(COOLING_SLOT_MAP).sort(), [
    "cooling.battery_temperature",
    "cooling.fan_power",
    "cooling.fan_switch",
    "cooling.inverter_ac_temperature",
    "cooling.inverter_dc_temperature",
  ]);
});
