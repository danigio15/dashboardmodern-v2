import test from "node:test";
import assert from "node:assert/strict";

import {
  migrateLegacyEnergyLoads,
  normalizeEnergyLoads,
} from "../src/core/migrations.js";

test("energy loads are deterministic, ordered and capped at eight", () => {
  const loads = normalizeEnergyLoads(
    Array.from({ length: 10 }, (_, index) => ({
      name: index < 2 ? "Pompa" : `Carico ${index}`,
      power_entity: `sensor.power_${index}`,
      order: 9 - index,
    })),
  );
  assert.equal(loads.length, 8);
  assert.equal(new Set(loads.map(({ id }) => id)).size, 8);
  assert.deepEqual(loads.map(({ order }) => order), [2, 3, 4, 5, 6, 7, 8, 9]);
});

test("fixed flow slots migrate once without deleting legacy values", () => {
  const overrides = {
    "dm.ev_potenza_wallbox": "sensor.wallbox_power",
    "dm.ev_energia_wallbox_oggi": "sensor.wallbox_total",
  };
  const migrated = migrateLegacyEnergyLoads([], overrides, { metadata: {} });
  assert.deepEqual(migrated, [
    {
      id: "energy-load-wb",
      name: "Wallbox",
      icon: "mdi:car-electric",
      power_entity: "sensor.wallbox_power",
      energy_entity: "sensor.wallbox_total",
      color: "#06b6d4",
      order: 0,
    },
  ]);
  assert.equal(overrides["dm.ev_potenza_wallbox"], "sensor.wallbox_power");
  assert.deepEqual(migrateLegacyEnergyLoads([], overrides, { metadata: { energy_loads_migrated: true } }), []);
});

test("battery SOC renders a percentage and keeps the legacy fallback", async () => {
  const { renderBatterySoc } = await import("../src/sections/energy-flow-section.js");
  const node = { textContent: "", dataset: {} };
  const document = { getElementById: (id) => (id === "v-battery-soc" ? node : null) };
  assert.equal(
    renderBatterySoc(
      document,
      { battery: { battery_soc_entity: "sensor.battery_soc" } },
      { "sensor.battery_soc": { state: "78" } },
    ),
    "78%",
  );
  assert.equal(node.textContent, "78%");
  assert.equal(renderBatterySoc(document, { battery: {} }, {}), "—");
  assert.equal(node.textContent, "—");
});
