import assert from "node:assert/strict";
import test from "node:test";
import { createApplianceViewModel } from "../src/core/appliance-view-model.js";

const device = { id: "washer", name: "Lavatrice", power_entity: "sensor.washer_power", control_entity: "switch.washer", total_energy_entity: "sensor.washer_energy", threshold_standby: 1, threshold_run: 5 };
const states = (power, control = "on") => ({
  "sensor.washer_power": { state: String(power), attributes: { unit_of_measurement: "W" } },
  "switch.washer": { state: control, attributes: {} },
  "sensor.washer_energy": { state: "184.2", attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" } },
});

test("one appliance view model owns status, summary, badge, action and history", () => {
  const model = createApplianceViewModel(device, states(12), [], "it");
  assert.equal(model.mode, "running");
  assert.equal(model.label, "IN FUNZIONE");
  assert.equal(model.badge, model.summary.mode);
  assert.equal(model.summary.label, model.label);
  assert.equal(model.action.service, "turn_off");
  assert.equal(model.historyEntity, "sensor.washer_energy");
});

test("appliance thresholds produce STANDBY and SPENTO deterministically", () => {
  assert.equal(createApplianceViewModel(device, states(2), [], "it").label, "STANDBY");
  assert.equal(createApplianceViewModel(device, states(0, "off"), [], "it").label, "SPENTO");
});
