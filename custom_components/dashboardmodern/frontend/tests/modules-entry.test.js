import assert from "node:assert/strict";
import test from "node:test";

test("the exact module shipped by the HTML loads and exposes the canonical model", async () => {
  delete globalThis.DashboardModernModules;
  const module = await import(`../legacy/modules-entry.js?functional=${Date.now()}`);
  assert.equal(module.default, globalThis.DashboardModernModules);
  assert.equal(module.default.version, 4);
  assert.equal(typeof module.default.store.addItem, "function");
  assert.equal(typeof module.default.data.applianceGroups, "function");
  assert.equal(typeof module.default.data.applianceState, "function");
  assert.equal(typeof module.default.data.normalizeCameras, "function");
});

test("appliance names follow configured, friendly, entity and localized fallback priority", async () => {
  const { applianceName } = await import("../src/legacy/dashboard-data.js");
  const states = { "sensor.dish_washer": { attributes: { friendly_name: "Kitchen dishwasher" } } };
  assert.equal(applianceName({ name: "Configured", entities: ["sensor.dish_washer"] }, states), "Configured");
  assert.equal(applianceName({ name: "OTHER", entities: ["sensor.dish_washer"] }, states), "Kitchen dishwasher");
  assert.equal(applianceName({ entities: ["sensor.dish_washer"] }, {}), "Dish Washer");
  assert.equal(applianceName({}, {}, "Elettrodomestico"), "Elettrodomestico");
});

test("appliance media retains the backwards-compatible priority", async () => {
  const { applianceMedia } = await import("../src/legacy/dashboard-data.js");
  assert.deepEqual(applianceMedia({ image: "/local/washer.png", icon: "mdi:washing-machine" }), { kind: "image", value: "/local/washer.png" });
  assert.deepEqual(applianceMedia({ image_url: "https://example.test/oven.png" }), { kind: "image", value: "https://example.test/oven.png" });
  assert.deepEqual(applianceMedia({ icon: "mdi:stove" }), { kind: "icon", value: "mdi:stove" });
  assert.deepEqual(applianceMedia({ device_type: "forno" }), { kind: "icon", value: "mdi:stove" });
});

test("energy report is derived from appliances and normalizes power and energy", async () => {
  const { applianceEnergyReport } = await import("../src/legacy/dashboard-data.js");
  const report = applianceEnergyReport(
    [{ name: "Washer", room_id: "laundry", entities: ["sensor.washer_power", "sensor.washer_energy"] }],
    {
      "sensor.washer_power": { state: "1.25", attributes: { unit_of_measurement: "kW" } },
      "sensor.washer_energy": { state: "750", attributes: { unit_of_measurement: "Wh" } },
    },
    [{ id: "laundry", name: "Laundry", icon: "mdi:washing-machine" }],
  );
  assert.equal(report[0].power.value, 1250);
  assert.equal(report[0].energy.value, 0.75);
  assert.equal(report[0].room.name, "Laundry");
  assert.equal(report[0].historyEntity, "sensor.washer_energy");
});
