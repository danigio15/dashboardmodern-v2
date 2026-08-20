import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { sourcePlans } from "../src/core/period-service.js";
import { energyPeriodConflicts, sanitizeEnergyModel } from "../src/sections/shared.js";

function energyState(state = "0") {
  return {
    state,
    attributes: {
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  };
}

const STATES = {
  "sensor.casa_totale": energyState("9120"),
  "sensor.casa_giorno": energyState("4.2"),
  "sensor.casa_mese": energyState("118"),
  "sensor.casa_anno": energyState("1420"),
};

test("a configured total meter removes the period helpers from the runtime model", () => {
  const configured = {
    house: {
      total_energy: "sensor.casa_totale",
      daily_energy: "sensor.casa_giorno",
      monthly_energy: "sensor.casa_mese",
      annual_energy: "sensor.casa_anno",
    },
  };

  const runtime = sanitizeEnergyModel(configured, STATES, (value) => value, {});
  assert.equal(runtime.house.total_energy, "sensor.casa_totale");
  assert.equal(runtime.house.daily_energy, "");
  assert.equal(runtime.house.monthly_energy, "");
  assert.equal(runtime.house.annual_energy, "");

  // The configuration itself is untouched: the fields stay written, they are
  // only kept out of the model the pages read.
  assert.equal(configured.house.daily_energy, "sensor.casa_giorno");

  for (const kind of ["day", "month", "year"]) {
    const plans = sourcePlans(runtime, kind, STATES).filter((plan) => plan.key === "house");
    assert.equal(plans.length, 1, `one plan for ${kind}`);
    assert.equal(plans[0].entity, "sensor.casa_totale");
    assert.equal(plans[0].direct, false);
    assert.equal(plans[0].reason, "canonical-total");
  }
});

test("the period helpers still drive the pages when no total meter is configured", () => {
  const configured = { house: { daily_energy: "sensor.casa_giorno", monthly_energy: "sensor.casa_mese" } };
  const runtime = sanitizeEnergyModel(configured, STATES, (value) => value, {});
  assert.equal(runtime.house.monthly_energy, "sensor.casa_mese");
  const plans = sourcePlans(runtime, "month", STATES).filter((plan) => plan.key === "house");
  assert.equal(plans[0].direct, true);
  assert.equal(plans[0].entity, "sensor.casa_mese");
});

test("the overridden period fields are reported with their entity so the editor can name them", () => {
  const conflicts = energyPeriodConflicts(
    {
      house: {
        total_energy: "sensor.casa_totale",
        daily_energy: "sensor.casa_giorno",
        annual_energy: "sensor.casa_anno",
      },
      solar: { daily_energy: "sensor.casa_giorno" },
    },
    STATES,
    (value) => value,
  );

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].group, "house");
  assert.equal(conflicts[0].total, "sensor.casa_totale");
  assert.deepEqual(
    conflicts[0].ignored.map((field) => field.key).sort(),
    ["annual_energy", "daily_energy"],
  );
  assert.deepEqual(
    conflicts[0].ignored.map((field) => field.entity).sort(),
    ["sensor.casa_anno", "sensor.casa_giorno"],
  );
});

test("a period field mirroring the total meter is a migration, not a clash", () => {
  const conflicts = energyPeriodConflicts(
    { house: { total_energy: "sensor.casa_totale", annual_energy: "sensor.casa_totale" } },
    STATES,
    (value) => value,
  );
  assert.deepEqual(conflicts, []);
});

test("a period field pointing at a missing entity is not announced as ignored", () => {
  const conflicts = energyPeriodConflicts(
    { house: { total_energy: "sensor.casa_totale", daily_energy: "sensor.sparito" } },
    STATES,
    (value) => value,
  );
  assert.deepEqual(conflicts, []);
});

test("the energy editor warns about the overridden fields and offers to clear them", () => {
  const source = readFileSync(new URL("../src/sections/energy-guidance-section.js", import.meta.url), "utf8");
  assert.match(source, /energyPeriodConflicts/);
  assert.match(source, /dm-energy-source-clash/);
  assert.match(source, /dm-energy-clash-clear/);
  assert.match(source, /clearClashingPeriods/);
  assert.match(source, /\$\{clashNotice\(energyClashes\(\)\)\}/);
});
