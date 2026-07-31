import assert from "node:assert/strict";
import test from "node:test";

import {
  mdiGlyph,
  TOTAL_ENERGY_FIELDS,
  validateTotalEnergyEntity,
} from "../legacy/release-0150-fixes.js";

test("0.14.10 exposes cumulative meters for all Energy groups", () => {
  assert.deepEqual(
    TOTAL_ENERGY_FIELDS.map(({ group, key }) => `${group}.${key}`),
    [
      "house.total_energy",
      "grid.total_import_energy",
      "grid.total_export_energy",
      "solar.total_energy",
      "battery.total_charged_energy",
      "battery.total_discharged_energy",
    ],
  );
});

test("total meter validation rejects power sensors and accepts total_increasing energy", () => {
  const states = {
    "sensor.grid_power": {
      attributes: {
        unit_of_measurement: "W",
        device_class: "power",
        state_class: "measurement",
      },
    },
    "sensor.grid_total": {
      attributes: {
        unit_of_measurement: "kWh",
        device_class: "energy",
        state_class: "total_increasing",
      },
    },
  };

  assert.equal(validateTotalEnergyEntity("sensor.grid_power", states).valid, false);
  assert.equal(validateTotalEnergyEntity("sensor.grid_power", states).reason, "not-energy");
  assert.deepEqual(validateTotalEnergyEntity("sensor.grid_total", states), {
    valid: true,
    reason: "",
    unit: "kwh",
    stateClass: "total_increasing",
  });
});

test("raw MDI tokens always become visible report glyphs", () => {
  assert.equal(mdiGlyph("mdi:stove"), "♨️");
  assert.equal(mdiGlyph("mdi:fridge-outline"), "❄️");
  assert.equal(mdiGlyph("mdi:unknown-device"), "⚡");
  assert.equal(mdiGlyph("🍽️"), "🍽️");
});
