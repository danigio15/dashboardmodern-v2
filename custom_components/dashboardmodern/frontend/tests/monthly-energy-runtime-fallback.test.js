import assert from "node:assert/strict";
import test from "node:test";

import { HomeAssistantBroker, sourcePlans } from "../src/core/period-service.js";
import { sanitizeEnergyModel } from "../src/sections/shared.js";

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

test("stale monthly ids cannot block Recorder fallback from a working daily helper", async () => {
  const configured = {
    house: {
      daily_energy: "sensor.casa_energia_giornaliera",
      monthly_energy: "sensor.monthly_energy",
      total_energy: "",
    },
  };
  const states = {
    "sensor.casa_energia_giornaliera": energyState("3.4"),
  };

  const runtime = sanitizeEnergyModel(configured, states, (value) => value, {});
  assert.equal(runtime.house.monthly_energy, "");
  assert.equal(runtime.house.total_energy, "sensor.casa_energia_giornaliera");
  assert.equal(configured.house.monthly_energy, "sensor.monthly_energy");
  assert.equal(configured.house.total_energy, "");

  const plans = sourcePlans(runtime, "month", states).filter((plan) => plan.key === "house");
  assert.equal(plans.length, 1);
  assert.equal(plans[0].direct, false);
  assert.equal(plans[0].entity, "sensor.casa_energia_giornaliera");

  const selected = new Date(2025, 5, 1);
  const boundary = new Date(2025, 5, 1);
  const broker = new HomeAssistantBroker();
  broker.statistics = async () => ({
    "sensor.casa_energia_giornaliera": [
      { start: new Date(boundary.getTime() - 60 * 60 * 1000).toISOString(), sum: 100 },
      { start: new Date(boundary.getTime() + 12 * 60 * 60 * 1000).toISOString(), sum: 104 },
      { start: new Date(2025, 5, 29, 12).toISOString(), sum: 142 },
    ],
  });

  const values = await broker.valuesForPlans(plans, selected, states);
  assert.equal(values.get("house"), 42);
});

test("an existing annual cumulative helper is preferred as the virtual lifetime source", () => {
  const configured = {
    solar: {
      daily_energy: "sensor.fv_giorno",
      monthly_energy: "sensor.fv_mese_vecchio",
      annual_energy: "sensor.fv_anno",
    },
  };
  const states = {
    "sensor.fv_giorno": energyState("8.2"),
    "sensor.fv_anno": energyState("1460.7"),
  };

  const runtime = sanitizeEnergyModel(configured, states, (value) => value, {});
  assert.equal(runtime.solar.monthly_energy, "");
  assert.equal(runtime.solar.total_energy, "sensor.fv_anno");
});

test("a valid explicit monthly helper is preserved and remains authoritative", () => {
  const configured = {
    house: {
      daily_energy: "sensor.casa_giorno",
      monthly_energy: "sensor.casa_mese",
    },
  };
  const states = {
    "sensor.casa_giorno": energyState("2"),
    "sensor.casa_mese": energyState("18"),
  };

  const runtime = sanitizeEnergyModel(configured, states, (value) => value, {});
  assert.equal(runtime.house.monthly_energy, "sensor.casa_mese");
  const plans = sourcePlans(runtime, "month", states).filter((plan) => plan.key === "house");
  assert.equal(plans[0].direct, true);
  assert.equal(plans[0].entity, "sensor.casa_mese");
});
