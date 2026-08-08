import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalApplianceVisualKey,
  normalizeDevice,
} from "../src/core/device-model.js";

test("known appliance aliases normalize to the editor visual keys", () => {
  assert.equal(canonicalApplianceVisualKey("microwave"), "microonde");
  assert.equal(canonicalApplianceVisualKey("washer"), "lavatrice");
  assert.equal(canonicalApplianceVisualKey("dishwasher"), "lavastoviglie");
  assert.equal(canonicalApplianceVisualKey("dryer"), "asciugatrice");
  assert.equal(canonicalApplianceVisualKey("fridge"), "frigorifero");
  assert.equal(canonicalApplianceVisualKey("oven"), "forno");
});

test("a legacy Microwave asset cannot reopen on a different appliance option", () => {
  const device = normalizeDevice(
    {
      id: "appl-microwave",
      name: "Microonde",
      device_type: "microwave",
      visual_type: "asset",
      visual_key: "microwave",
      power_entity: "sensor.microwave_power",
    },
    "appliances",
  );

  assert.equal(device.visual_key, "microonde");
  assert.equal(device.device_type, "microwave");
});
