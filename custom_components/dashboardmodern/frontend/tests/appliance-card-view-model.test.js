// DM-FIX-20260816A
import assert from "node:assert/strict";
import test from "node:test";
import {
  applianceCardModel,
  dailyEnergyKwh,
  formatClockDuration,
  formatCostLabel,
  formatKwhLabel,
  formatMinutesLabel,
  formatPowerLabel,
  formatStartLabel,
  parseDurationSeconds,
  parseTimestampMs,
  powerInfo,
  remainingInfo,
  temperatureInfo,
} from "../src/core/appliance-card-view-model.js";

const NOW = Date.parse("2026-08-16T10:30:00");

test("duration parsing accepts minutes, h:mm, h:mm:ss and unit hints", () => {
  assert.equal(parseDurationSeconds("0:30"), 1800);
  assert.equal(parseDurationSeconds("1:05"), 3900);
  assert.equal(parseDurationSeconds("0:45:30"), 2730);
  assert.equal(parseDurationSeconds("30"), 1800);
  assert.equal(parseDurationSeconds("90", "s"), 90);
  assert.equal(parseDurationSeconds("1.5", "h"), 5400);
  assert.equal(parseDurationSeconds("unknown"), null);
  assert.equal(parseDurationSeconds(""), null);
});

test("timestamp parsing accepts ISO strings and epoch values", () => {
  assert.equal(parseTimestampMs("2026-08-16T10:00:00Z"), Date.parse("2026-08-16T10:00:00Z"));
  assert.equal(parseTimestampMs("1755338400"), 1755338400000);
  assert.equal(parseTimestampMs("unavailable"), null);
});

test("labels use the reference formatting (dot decimals, compact units)", () => {
  assert.equal(formatClockDuration(1800), "0:30");
  assert.equal(formatClockDuration(4500), "1:15");
  assert.equal(formatMinutesLabel(9), "9min");
  assert.equal(formatMinutesLabel(80), "1h 20min");
  assert.equal(formatMinutesLabel(120), "2h");
  assert.equal(formatMinutesLabel(null), "—");
  assert.equal(formatPowerLabel(1900), "1.9 kW");
  assert.equal(formatPowerLabel(2450), "2.45 kW");
  assert.equal(formatPowerLabel(0), "0 W");
  assert.equal(formatKwhLabel(0.19), "0.19 kWh");
  assert.equal(formatKwhLabel(12.34), "12.3 kWh");
  assert.equal(formatCostLabel(0.021), "0.02 €");
  assert.equal(formatCostLabel(null), "—");
});

test("start labels resolve oggi / ieri / date against the reference clock", () => {
  assert.equal(formatStartLabel(Date.parse("2026-08-16T09:55:00"), NOW, "it"), "oggi 09:55");
  assert.equal(formatStartLabel(Date.parse("2026-08-15T17:40:00"), NOW, "it"), "ieri 17:40");
  assert.equal(formatStartLabel(Date.parse("2026-08-12T08:05:00"), NOW, "it"), "12/08 08:05");
  assert.equal(formatStartLabel(Date.parse("2026-08-16T09:55:00"), NOW, "en"), "today 09:55");
  assert.equal(formatStartLabel(null, NOW, "it"), "—");
});

test("remaining info reads minute sensors, timestamps and ring fractions", () => {
  const device = { remaining_entity: "sensor.wash_left", cycle_minutes: 60 };
  const states = {
    "sensor.wash_left": { state: "30", attributes: { unit_of_measurement: "min" } },
  };
  const info = remainingInfo(device, states, NOW);
  assert.equal(info.seconds, 1800);
  assert.equal(info.label, "0:30");
  assert.equal(info.fraction, 0.5);

  const tsInfo = remainingInfo(
    { remaining_entity: "sensor.oven_end" },
    {
      "sensor.oven_end": {
        state: new Date(NOW + 45 * 60000).toISOString(),
        attributes: { device_class: "timestamp" },
      },
    },
    NOW,
  );
  assert.equal(tsInfo.seconds, 2700);
  assert.equal(tsInfo.label, "0:45");
  assert.equal(tsInfo.fraction, null);

  const tracked = remainingInfo(device, states, NOW, {
    active: { maxRemainingSeconds: 3600 },
  });
  assert.equal(tracked.fraction, 0.5);
});

test("temperature info uses config bounds and fridge defaults", () => {
  const info = temperatureInfo(
    { temperature_entity: "sensor.fridge_temp", visual_key: "frigo" },
    { "sensor.fridge_temp": { state: "4", attributes: { unit_of_measurement: "°C" } } },
  );
  assert.equal(info.label, "4 °C");
  assert.equal(info.min, 0);
  assert.equal(info.max, 10);
  assert.equal(info.fraction, 0.4);

  const freezer = temperatureInfo(
    { temperature_entity: "sensor.freezer_temp", name: "Congelatore garage" },
    { "sensor.freezer_temp": { state: "-18", attributes: { unit_of_measurement: "°C" } } },
  );
  assert.equal(freezer.min, -25);
  assert.equal(freezer.max, -10);
  assert.ok(Math.abs(freezer.fraction - 7 / 15) < 1e-9);

  const inferred = temperatureInfo(
    { entities: ["sensor.fridge_probe"], visual_key: "frigo" },
    { "sensor.fridge_probe": { state: "5.5", attributes: { unit_of_measurement: "°C" } } },
  );
  assert.equal(inferred.label, "5.5 °C");
});

test("power info scales against max_power or the per-type default", () => {
  const explicit = powerInfo({ max_power: 2000 }, 1000, "washer");
  assert.equal(explicit.fraction, 0.5);
  const fallback = powerInfo({}, 1100, "washer");
  assert.equal(fallback.max, 2200);
  assert.equal(fallback.fraction, 0.5);
  assert.equal(powerInfo({}, null, "generic").label, "0 W");
});

test("daily energy converts Wh and MWh into kWh", () => {
  assert.equal(
    dailyEnergyKwh(
      { daily_energy_entity: "sensor.day" },
      { "sensor.day": { state: "280", attributes: { unit_of_measurement: "Wh" } } },
    ),
    0.28,
  );
  assert.equal(
    dailyEnergyKwh(
      { daily_energy_entity: "sensor.day" },
      { "sensor.day": { state: "0.28", attributes: { unit_of_measurement: "kWh" } } },
    ),
    0.28,
  );
});

test("card model composes running state, countdown, cycle labels and costs", () => {
  const device = {
    id: "appl-washer",
    name: "Lavatrice",
    visual_key: "lavatrice",
    device_type: "lavatrice",
    power_entity: "sensor.washer_power",
    remaining_entity: "sensor.washer_left",
    cycle_minutes: 60,
    daily_energy_entity: "sensor.washer_day",
    price_kwh: 0.25,
    threshold_run: 5,
    room_id: "room-laundry",
  };
  const states = {
    "sensor.washer_power": { state: "1900", attributes: { unit_of_measurement: "W" } },
    "sensor.washer_left": { state: "30", attributes: { unit_of_measurement: "min" } },
    "sensor.washer_day": { state: "0.9", attributes: { unit_of_measurement: "kWh" } },
  };
  const record = {
    active: {
      startMs: Date.parse("2026-08-16T09:55:00"),
      lastMs: NOW,
      kwhIntegral: 0.19,
      startDailyKwh: 0.71,
      lastDailyKwh: 0.9,
      maxRemainingSeconds: 3600,
    },
  };
  const model = applianceCardModel(device, states, {
    rooms: [{ id: "room-laundry", name: "Lavanderia" }],
    locale: "it",
    now: NOW,
    priceKwh: 0.4,
    record,
    index: 0,
  });
  assert.equal(model.mode, "running");
  assert.equal(model.label, "IN FUNZIONE");
  assert.equal(model.room.name, "Lavanderia");
  assert.equal(model.accent, "water");
  assert.equal(model.remaining.label, "0:30");
  assert.equal(model.remaining.fraction, 0.5);
  assert.equal(model.power.label, "1.9 kW");
  assert.ok(model.cycle.live);
  assert.equal(model.cycle.startLabel, "oggi 09:55");
  assert.equal(model.cycle.durationLabel, "35min");
  assert.equal(model.cycle.energyLabel, "0.19 kWh");
  // device price (0.25) wins over the global tariff (0.4): 0.19 × 0.25.
  assert.equal(model.cycle.costLabel, "0.05 €");
});

test("continuous appliances fall back to the daily energy for the cycle footer", () => {
  const device = {
    id: "appl-fridge",
    name: "Frigorifero",
    visual_key: "frigo",
    device_type: "frigo",
    power_entity: "sensor.fridge_power",
    temperature_entity: "sensor.fridge_temp",
    daily_energy_entity: "sensor.fridge_day",
    threshold_run: 60,
  };
  const states = {
    "sensor.fridge_power": { state: "2", attributes: { unit_of_measurement: "W" } },
    "sensor.fridge_temp": { state: "4", attributes: { unit_of_measurement: "°C" } },
    "sensor.fridge_day": { state: "0.28", attributes: { unit_of_measurement: "kWh" } },
  };
  const model = applianceCardModel(device, states, {
    locale: "it",
    now: NOW,
    priceKwh: 0.1,
    index: 2,
  });
  assert.equal(model.mode, "standby");
  assert.equal(model.continuous, true);
  assert.equal(model.temperature.label, "4 °C");
  assert.equal(model.cycle.durationLabel, "—");
  assert.equal(model.cycle.energyLabel, "0.28 kWh");
  assert.equal(model.cycle.costLabel, "0.03 €");
});

test("alarm flag follows the alert entity and the unavailable mode", () => {
  const base = { id: "a", name: "Forno", alert_entity: "binary_sensor.oven_problem" };
  const on = applianceCardModel(base, {
    "binary_sensor.oven_problem": { state: "on", attributes: {} },
  });
  assert.equal(on.alarm, true);
  const off = applianceCardModel(base, {
    "binary_sensor.oven_problem": { state: "off", attributes: {} },
  });
  assert.equal(off.alarm, false);
});

/* Cosa sta facendo, in parole.
 *
 * Dal campo: «le card si devono riadattare in base alle informazioni presenti
 * nell'integrazione importata: la lavatrice deve fornire lo stato in corso,
 * esempio lavaggio, con temperatura lavaggio eccetera». La macchina e' la sua,
 * i valori sono quelli letti dalla scheda Stati con un ciclo avviato.
 */
const HAIER = {
  "sensor.lavatrice_fase": { state: "washing", attributes: { friendly_name: "Lavatrice Fase" } },
  "sensor.lavatrice_machine_status": {
    state: "running",
    attributes: { friendly_name: "Lavatrice Machine Status" },
  },
  "sensor.lavatrice_temperatura": {
    state: "30",
    attributes: { friendly_name: "Lavatrice Temperatura", unit_of_measurement: "°C" },
  },
  "sensor.lavatrice_centrifuga": {
    state: "800",
    attributes: { friendly_name: "Lavatrice Centrifuga", unit_of_measurement: "rpm" },
  },
  /* hOn pubblica tutti e due, e il sensore non sa cosa gira. */
  "sensor.lavatrice_programma": {
    state: "No Program",
    attributes: { friendly_name: "Lavatrice Programma" },
  },
  "select.lavatrice_programma": {
    state: "iot_wash_rapid_59",
    attributes: { friendly_name: "Lavatrice Programma" },
  },
  "sensor.lavatrice_capacita_di_carico": {
    state: "9",
    attributes: { friendly_name: "Lavatrice Capacità di carico", unit_of_measurement: "kg" },
  },
};

const LAVATRICE = {
  id: "haier",
  name: "Lavatrice",
  visual_key: "lavatrice",
  state_entity: "sensor.lavatrice_machine_status",
  device_entities: Object.keys(HAIER),
};

test("la card dice la fase in corso, i gradi, i giri e il programma", () => {
  const model = applianceCardModel(LAVATRICE, HAIER, { locale: "it", now: NOW });
  assert.equal(model.mode, "running");
  assert.equal(model.program.phase.label, "Lavaggio");
  assert.equal(model.program.phase.entity, "sensor.lavatrice_fase");
  assert.deepEqual(
    model.program.chips.map((chip) => [chip.key, chip.label]),
    [
      ["temperatura", "30 °C"],
      ["centrifuga", "800 rpm"],
      /* Il menu risponde dove il sensore tace, e il nome si legge. */
      ["programma", "Rapid 59"],
    ],
  );
  /* «Capacità di carico» in kg non e' ne' gradi ne' giri. */
  assert.ok(!model.program.chips.some((chip) => chip.entity.includes("capacita")));
});

test("la stessa card in inglese dice Washing", () => {
  const model = applianceCardModel(LAVATRICE, HAIER, { locale: "en", now: NOW });
  assert.equal(model.program.phase.label, "Washing");
});

test("a macchina ferma la fase non si disegna, i numeri restano", () => {
  const ferma = {
    ...HAIER,
    "sensor.lavatrice_fase": { state: "ready", attributes: { friendly_name: "Lavatrice Fase" } },
    "sensor.lavatrice_machine_status": {
      state: "ready",
      attributes: { friendly_name: "Lavatrice Machine Status" },
    },
  };
  const model = applianceCardModel(LAVATRICE, ferma, { locale: "it", now: NOW });
  assert.equal(model.mode, "off");
  assert.equal(model.program.phase, null);
  /* Dicono cosa partira': non sono una bugia, sono la manopola. */
  assert.equal(model.program.chips.length, 3);
});

test("una presa smart non ha niente da raccontare, e la card resta quella di prima", () => {
  const model = applianceCardModel(
    { id: "presa", name: "Forno", power_entity: "sensor.presa_power" },
    { "sensor.presa_power": { state: "1200", attributes: { unit_of_measurement: "W" } } },
    { locale: "it", now: NOW },
  );
  assert.equal(model.program.phase, null);
  assert.deepEqual(model.program.chips, []);
});

test("zero gradi su una lavatrice è il lavaggio a freddo, non un termometro rotto", () => {
  const freddo = {
    ...HAIER,
    "sensor.lavatrice_temperatura": {
      state: "0",
      attributes: { friendly_name: "Lavatrice Temperatura", unit_of_measurement: "°C" },
    },
  };
  const model = applianceCardModel(LAVATRICE, freddo, { locale: "it", now: NOW });
  assert.equal(model.program.chips[0].label, "Freddo");
});

test("una parola che il vocabolario non conosce si dice lo stesso, ripulita", () => {
  const strana = {
    ...HAIER,
    "sensor.lavatrice_fase": {
      state: "steam_ready",
      attributes: { friendly_name: "Lavatrice Fase" },
    },
  };
  const model = applianceCardModel(LAVATRICE, strana, { locale: "it", now: NOW });
  assert.equal(model.program.phase.label, "Steam ready");
});
