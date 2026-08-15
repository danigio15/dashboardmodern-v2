import test from "node:test";
import assert from "node:assert/strict";

import { migrateEnergyLoads, migrateState } from "../src/core/migrations.js";
import {
  batterySocLabel,
  energyLoadViewModels,
  renderEnergyLoadNodes,
} from "../src/core/period-service.js";

test("energy_loads normalization is deterministic, ordered and capped at eight", () => {
  const input = Array.from({ length: 10 }, (_, index) => ({
    name: index < 2 ? "Pompa" : `Carico ${index}`,
    power_entity: `sensor.power_${index}`,
    energy_entity: `sensor.total_${index}`,
    order: 10 - index,
  }));
  const loads = migrateEnergyLoads(input);
  assert.equal(loads.length, 8);
  assert.equal(new Set(loads.map(({ id }) => id)).size, 8);
  assert.deepEqual(
    loads.map(({ order }) => order),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
});

test("fixed energy slots migrate once while their rollback values remain intact", () => {
  const source = { schema_version: 4, sections: { energy: {}, entityOverrides: {} } };
  const legacy = {
    entityOverrides: {
      "dm.boiler_potenza_resistenza_boiler": "sensor.boiler_power",
      "dm.energy_boiler_mese": "sensor.boiler_total",
    },
  };
  const { state, changes } = migrateState(source, legacy);
  assert.equal(state.sections.energyLoads.length, 1);
  assert.equal(state.sections.energyLoads[0].name, "Boiler");
  assert.equal(legacy.entityOverrides["dm.energy_boiler_mese"], "sensor.boiler_total");
  assert.ok(changes.includes("fixed energy slots → energy_loads"));
});

test("battery SOC renders a percentage or the existing dash fallback", () => {
  assert.equal(
    batterySocLabel(
      { battery: { soc: "sensor.battery_soc" } },
      { "sensor.battery_soc": { state: "78.2" } },
    ),
    "78%",
  );
  assert.equal(batterySocLabel({ battery: {} }, {}), "—");
});

test("load render model has zero nodes for zero loads and N named values for N loads", () => {
  const stage = { querySelectorAll: () => [], querySelector: () => null };
  assert.deepEqual(renderEnergyLoadNodes({}, stage, []), []);
  const models = energyLoadViewModels(
    [
      { id: "oven", name: "Forno", power_entity: "sensor.oven_power" },
      { id: "pump", name: "Pompa", power_entity: "sensor.pump_power" },
    ],
    { states: { "sensor.oven_power": { state: "900" }, "sensor.pump_power": { state: "42" } } },
  );
  assert.deepEqual(
    models.map(({ name, value }) => [name, value]),
    [
      ["Forno", "900 W"],
      ["Pompa", "42 W"],
    ],
  );
});
