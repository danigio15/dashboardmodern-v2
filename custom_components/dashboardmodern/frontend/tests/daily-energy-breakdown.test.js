import assert from "node:assert/strict";
import test from "node:test";
import {
  applianceDailySource,
  buildApplianceDailyBreakdown,
} from "../src/sections/appliances-section.js";
import { archiDelPeriodo } from "../src/core/period-service.js";

test("appliance daily total never adds a lifetime meter state directly", async () => {
  const states = {
    "sensor.fridge_today": {
      state: "0.81",
      attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
    },
    "sensor.fridge_total": {
      state: "120.4",
      attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
    },
    "sensor.microwave_total": {
      state: "20.0",
      attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
    },
    "sensor.bad_energy": {
      state: "99",
      attributes: { unit_of_measurement: "kWh", state_class: "measurement" },
    },
  };
  const appliances = [
    {
      id: "fridge",
      name: "Frigorifero",
      daily_energy_entity: "sensor.fridge_today",
      total_energy_entity: "sensor.fridge_total",
      entities: ["sensor.fridge_total"],
    },
    {
      id: "microwave",
      name: "Microonde",
      total_energy_entity: "sensor.microwave_total",
      entities: ["sensor.microwave_total"],
    },
    {
      id: "bad",
      name: "Valore non periodale",
      entities: ["sensor.bad_energy"],
    },
  ];
  let receivedPlans = [];
  const broker = {
    async valuesForPlans(plans) {
      receivedPlans = plans;
      return new Map([[plans[0].key, 0.05]]);
    },
  };

  const result = await buildApplianceDailyBreakdown(appliances, states, broker, new Date());

  assert.equal(receivedPlans.length, 1);
  assert.equal(receivedPlans[0].entity, "sensor.microwave_total");
  assert.equal(receivedPlans[0].direct, false);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].name, "Frigorifero");
  assert.equal(result.rows[0].value, 0.81);
  assert.equal(result.rows[1].name, "Microonde");
  assert.equal(result.rows[1].value, 0.05);
  assert.equal(result.total, 0.86);
  assert.notEqual(result.total, 20.81);
  assert.ok(!result.rows.some((row) => row.entity === "sensor.bad_energy"));
});

test("explicit daily appliance sensor wins over a configured lifetime total", () => {
  const states = {
    "sensor.device_today": {
      state: "1250",
      attributes: { unit_of_measurement: "Wh", state_class: "total_increasing" },
    },
    "sensor.device_total": {
      state: "600",
      attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
    },
  };
  const source = applianceDailySource(
    {
      daily_energy_entity: "sensor.device_today",
      total_energy_entity: "sensor.device_total",
    },
    states,
  );
  assert.equal(source.entity, "sensor.device_today");
  assert.equal(source.direct, true);
  assert.equal(source.reason, "explicit-daily");
});

test("del giorno in corso si chiede a cinque minuti solo l'ora aperta", () => {
  /* Il conto di oggi lo fa la differenza fra la prima e l'ultima lettura, e
   * l'ultima dentro l'ora aperta esiste solo nelle statistiche a cinque
   * minuti: quelle dell'ora si compilano a ora finita. Prima si chiedeva a
   * cinque minuti TUTTA la giornata — 288 righe per ogni elettrodomestico a
   * ogni giro invece di 26 — con una pellicola che riscriveva di nascosto le
   * domande di chiunque. Adesso lo dice chi costruisce gli archi, e vale per
   * tutti quelli che chiedono. */
  const adesso = new Date(2026, 7, 9, 11, 49);
  const archi = archiDelPeriodo("day", adesso, adesso);
  assert.deepEqual(
    archi.map((arco) => arco.period),
    ["hour", "5minute"],
  );
  assert.deepEqual(archi[1].start, new Date(2026, 7, 9, 11, 0, 0, 0));
});
