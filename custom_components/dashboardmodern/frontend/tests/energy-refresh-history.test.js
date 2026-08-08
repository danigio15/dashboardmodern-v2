import assert from "node:assert/strict";
import test from "node:test";

import { initializeEnergyPeriodControls } from "../src/sections/energy-refresh-section.js";
import {
  applianceHistorySource,
  normalizeHistoryRows,
} from "../src/sections/history-section.js";

test("first Energy refresh initializes the legacy January select to the current month", () => {
  const month = { value: "1", dataset: {} };
  const year = { value: "2025", dataset: {} };
  const fakeDocument = {
    getElementById(id) {
      return id === "ed-sel-month" ? month : id === "ed-sel-year" ? year : null;
    },
  };

  assert.equal(initializeEnergyPeriodControls(new Date(2026, 7, 8, 16, 0), fakeDocument), true);
  assert.equal(month.value, "8");
  assert.equal(year.value, "2026");
  assert.equal(month.dataset.init, "1");
  assert.equal(year.dataset.dmPeriodInit, "current");
});

test("an already initialized user period is never overwritten", () => {
  const month = { value: "6", dataset: { init: "1" } };
  const year = { value: "2025", dataset: { dmPeriodInit: "user" } };
  const fakeDocument = {
    getElementById(id) {
      return id === "ed-sel-month" ? month : id === "ed-sel-year" ? year : null;
    },
  };

  initializeEnergyPeriodControls(new Date(2026, 7, 8), fakeDocument);
  assert.equal(month.value, "6");
  assert.equal(year.value, "2025");
});

test("short appliance history prefers power over lifetime energy", () => {
  const device = {
    power_entity: "sensor.microwave_power",
    history_entity: "sensor.microwave_total",
    total_energy_entity: "sensor.microwave_total",
    entities: ["sensor.microwave_power", "sensor.microwave_total"],
  };
  const states = {
    "sensor.microwave_power": {
      state: "0",
      attributes: { unit_of_measurement: "W", device_class: "power" },
    },
    "sensor.microwave_total": {
      state: "82",
      attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
    },
  };
  assert.equal(applianceHistorySource(device, states), "sensor.microwave_power");
});

test("short appliance history falls back to lifetime energy only without power or state", () => {
  const device = {
    history_entity: "sensor.oven_total",
    total_energy_entity: "sensor.oven_total",
    entities: ["sensor.oven_total"],
  };
  assert.equal(applianceHistorySource(device, {}), "sensor.oven_total");
});

test("Home Assistant compressed WebSocket history is normalized for the popup", () => {
  const result = {
    "sensor.microwave_power": [
      { s: "0", lu: 1_754_650_000 },
      { s: "842.5", lu: 1_754_650_600 },
      { s: "12", lc: 1_754_651_200 },
    ],
  };
  const rows = normalizeHistoryRows(result, "sensor.microwave_power");
  assert.deepEqual(rows.map((row) => row.state), ["0", "842.5", "12"]);
  assert.deepEqual(rows.map((row) => row.time), [
    1_754_650_000_000,
    1_754_650_600_000,
    1_754_651_200_000,
  ]);
});

test("full REST-style history rows remain supported for standalone compatibility", () => {
  const rows = normalizeHistoryRows(
    [
      {
        entity_id: "sensor.microwave_power",
        state: "15",
        last_changed: "2026-08-08T13:00:00Z",
      },
      {
        entity_id: "sensor.microwave_power",
        state: "0",
        last_updated: "2026-08-08T14:00:00Z",
      },
    ],
    "sensor.microwave_power",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].state, "15");
  assert.ok(rows[1].time > rows[0].time);
});
