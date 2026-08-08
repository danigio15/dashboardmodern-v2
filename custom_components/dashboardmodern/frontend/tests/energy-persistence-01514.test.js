import assert from "node:assert/strict";
import test from "node:test";

import { migrateState } from "../src/core/migrations.js";

function stateWithEnergy(energy) {
  return {
    schema_version: 4,
    sections: {
      rooms: [],
      cameras: [],
      appliances: [],
      loads: [],
      lights: [],
      climate: [],
      ev: [],
      covers: [],
      pool: {},
      irrigation: {},
      entityOverrides: {},
      energy,
    },
    visibility: {},
  };
}

test("clearing annual house energy survives reload after semantics v3", () => {
  const input = stateWithEnergy({
    house: {
      annual_energy: "",
      total_energy: "sensor.solarman_total_load_consumption",
    },
    solar: {},
    grid: {},
    battery: {},
    metadata: { semantics_version: 3 },
  });

  const first = migrateState(input).state;
  assert.equal(first.sections.energy.house.annual_energy, "");
  assert.equal(
    first.sections.energy.house.total_energy,
    "sensor.solarman_total_load_consumption",
  );
  assert.equal(first.sections.energy.metadata.semantics_version, 4);

  const second = migrateState(first).state;
  assert.equal(second.sections.energy.house.annual_energy, "");
  assert.equal(second.sections.energy.metadata.semantics_version, 4);
});

test("clearing annual solar energy is not repopulated from the lifetime counter", () => {
  const result = migrateState(
    stateWithEnergy({
      house: {},
      solar: {
        annual_energy: "",
        total_energy: "sensor.solar_total",
      },
      grid: {},
      battery: {},
      metadata: { semantics_version: 3 },
    }),
  ).state.sections.energy;

  assert.equal(result.solar.annual_energy, "");
  assert.equal(result.solar.total_energy, "sensor.solar_total");
  assert.equal(result.metadata.semantics_version, 4);
});

test("pre-v3 data still receives the one-time annual/lifetime compatibility alias", () => {
  const result = migrateState(
    stateWithEnergy({
      house: { total_energy: "sensor.house_total" },
      solar: { annual_energy: "sensor.solar_year" },
      grid: {},
      battery: {},
      metadata: { semantics_version: 2 },
    }),
  ).state.sections.energy;

  assert.equal(result.house.annual_energy, "sensor.house_total");
  assert.equal(result.solar.total_energy, "sensor.solar_year");
  assert.equal(result.metadata.semantics_version, 4);
});
