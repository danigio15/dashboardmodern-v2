import assert from "node:assert/strict";
import test from "node:test";

import { DashboardStore } from "../src/core/dashboard-store.js";
import {
  aggregateFlowValue,
  flowChildren,
  flowRootLoads,
  installVisibilitySaveContract,
  resolveFlowLoad,
  roomFilterMatches,
  shouldAutoShowAfterSave,
} from "../src/sections/beta26-config-followup-section.js";

class MemoryStorage {
  values = new Map();
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

test("legacy loads remain root flow circles while hierarchical children stay inside their parent", () => {
  const loads = [
    { id: "legacy-boiler", name: "Boiler", order: 0 },
    { id: "kitchen", name: "Cucina", order: 1, metadata: { flow_kind: "root" } },
    {
      id: "oven",
      name: "Forno",
      order: 0,
      show_in_dashboard: false,
      metadata: { flow_kind: "child", flow_parent_id: "kitchen" },
    },
    {
      id: "fridge",
      name: "Frigo",
      order: 1,
      show_in_dashboard: false,
      metadata: { flow_kind: "child", flow_parent_id: "kitchen" },
    },
  ];

  assert.deepEqual(
    flowRootLoads(loads).map((item) => item.id),
    ["legacy-boiler", "kitchen"],
  );
  assert.deepEqual(
    flowChildren(loads, "kitchen").map((item) => item.id),
    ["oven", "fridge"],
  );
});

test("a flow can use a dedicated sensor or the automatic sum of child loads", () => {
  const parent = {
    id: "kitchen",
    power_entity: "sensor.kitchen_power",
    metadata: { flow_aggregate: "children" },
  };
  const loads = [
    parent,
    {
      id: "oven",
      power_entity: "sensor.oven_power",
      metadata: { flow_parent_id: "kitchen" },
    },
    {
      id: "fridge",
      metadata: { flow_parent_id: "kitchen", linked_appliance_id: "appliance-fridge" },
    },
  ];
  const appliances = [
    { id: "appliance-fridge", name: "Frigo", power_entity: "sensor.fridge_power" },
  ];
  const states = {
    "sensor.kitchen_power": { state: "999" },
    "sensor.oven_power": { state: "1200" },
    "sensor.fridge_power": { state: "180" },
  };

  assert.equal(aggregateFlowValue(parent, loads, "instant", states, appliances), 1380);
  assert.equal(
    aggregateFlowValue(
      { ...parent, metadata: { flow_aggregate: "sensor" } },
      loads,
      "instant",
      states,
      appliances,
    ),
    999,
  );
  assert.equal(resolveFlowLoad(loads[2], appliances).power_entity, "sensor.fridge_power");
});

test("Temperature room filter keeps every association of the selected room and hides other rooms", () => {
  assert.equal(roomFilterMatches("room-cameretta", "room-cameretta"), true);
  assert.equal(roomFilterMatches("room-matrimoniale", "room-cameretta"), false);
  assert.equal(roomFilterMatches("room-matrimoniale", "all"), true);
});

test("configured data is eligible for automatic visibility while empty Temperature rooms are not", () => {
  assert.equal(
    shouldAutoShowAfterSave("ev", [{ id: "car", name: "B10", entity: "sensor.b10_soc" }], {
      ev: false,
    }),
    true,
  );
  assert.equal(
    shouldAutoShowAfterSave("rooms", [{ id: "room", name: "Camera" }], { temp: false }),
    false,
  );
  assert.equal(
    shouldAutoShowAfterSave(
      "rooms",
      [{ id: "room", name: "Camera", temp: "sensor.camera_temperature" }],
      { temp: false },
    ),
    true,
  );
});

test("saving an unchanged configured section repairs hidden visibility without blocking a later manual hide", async () => {
  const storage = new MemoryStorage();
  const store = new DashboardStore({ storage, sync: async () => {} });
  store.migrate();
  const appliance = await store.addItem("appliances", {
    name: "Forno",
    power_entity: "sensor.oven_power",
  });

  store.state.visibility.appliances = false;
  store.persist();
  installVisibilitySaveContract(store);
  await store.updateItem("appliances", appliance.id, {});
  assert.equal(store.getState().visibility.appliances, true);
  assert.equal(JSON.parse(storage.getItem("cd_sections")).appliances, true);

  store.state.visibility.appliances = false;
  store.persist();
  assert.equal(store.getState().visibility.appliances, false);
});
