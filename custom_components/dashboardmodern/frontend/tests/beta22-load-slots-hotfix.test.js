import test from "node:test";
import assert from "node:assert/strict";

import {
  configuredFlowLoads,
  loadPeriodEntity,
  socEntity,
} from "../src/sections/beta22-load-slots-hotfix-section.js";

test("canonical Loads own the five flow slots", () => {
  const loads = configuredFlowLoads([
    { id: "hidden", name: "Hidden", show_in_dashboard: false, order: 0 },
    { id: "manual", name: "Manual", category: "manual-report", order: 1 },
    { id: "three", name: "Three", power_entity: "sensor.three", order: 3 },
    { id: "one", name: "One", power_entity: "sensor.one", order: 1 },
    { id: "two", name: "Two", power_entity: "sensor.two", order: 2 },
    { id: "four", name: "Four", power_entity: "sensor.four", order: 4 },
    { id: "five", name: "Five", power_entity: "sensor.five", order: 5 },
    { id: "six", name: "Six", power_entity: "sensor.six", order: 6 },
  ]);

  assert.deepEqual(
    loads.map(({ id }) => id),
    ["one", "two", "three", "four", "five"],
  );
});

test("flow periods use the canonical load entities", () => {
  const load = {
    power_entity: "sensor.power",
    daily_energy_entity: "sensor.day",
    monthly_energy_entity: "sensor.month",
    history_entity: "sensor.total",
  };
  assert.equal(loadPeriodEntity(load, "instant"), "sensor.power");
  assert.equal(loadPeriodEntity(load, "day"), "sensor.day");
  assert.equal(loadPeriodEntity(load, "month"), "sensor.month");
  assert.equal(loadPeriodEntity({ history_entity: "sensor.total" }, "month"), "sensor.total");
});

test("battery SOC reads the existing Energy battery.soc field", () => {
  assert.equal(socEntity({ battery: { soc: "sensor.battery_soc" } }), "sensor.battery_soc");
  assert.equal(
    socEntity({ battery: { battery_soc_entity: "sensor.legacy_soc" } }),
    "sensor.legacy_soc",
  );
});
