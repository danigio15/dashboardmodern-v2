import assert from "node:assert/strict";
import test from "node:test";

import { mergePreservedSubloadItems } from "../src/sections/beta27-subload-preserve-section.js";

test("beta27 preserves legacy subloads and appends new hierarchy children", () => {
  const legacy = [
    { name: "Forno", pwrLive: "sensor.forno_power" },
    { name: "Frigorifero", pwrLive: "sensor.frigo_power" },
  ];
  const configured = [
    { name: "Frigorifero", pwrLive: "sensor.frigo_power" },
    { name: "Lavastoviglie", pwrLive: "sensor.lavastoviglie_power" },
  ];

  const merged = mergePreservedSubloadItems(legacy, configured);
  assert.deepEqual(
    merged.map((item) => item.name),
    ["Forno", "Frigorifero", "Lavastoviglie"],
  );
});
