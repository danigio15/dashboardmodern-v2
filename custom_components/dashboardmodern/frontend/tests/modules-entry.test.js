import assert from "node:assert/strict";
import test from "node:test";

// DM-FIX-20260815A

test("the exact module shipped by the HTML loads and exposes the canonical model", async () => {
  delete globalThis.DashboardModernModules;
  const module = await import(`../legacy/modules-entry.js?functional=${Date.now()}`);
  assert.equal(module.default, globalThis.DashboardModernModules);
  assert.equal(module.default.version, 14);
  assert.equal(typeof module.default.store.addItem, "function");
  assert.equal(typeof module.default.data.applianceGroups, "function");
  assert.equal(typeof module.default.data.applianceState, "function");
  assert.equal(typeof module.default.data.normalizeCameras, "function");
});

test("appliance names follow configured, friendly, entity and localized fallback priority", async () => {
  const { applianceName } = await import("../src/legacy/dashboard-data.js");
  const states = { "sensor.dish_washer": { attributes: { friendly_name: "Kitchen dishwasher" } } };
  assert.equal(
    applianceName({ name: "Configured", entities: ["sensor.dish_washer"] }, states),
    "Configured",
  );
  assert.equal(
    applianceName({ name: "OTHER", entities: ["sensor.dish_washer"] }, states),
    "Kitchen dishwasher",
  );
  assert.equal(applianceName({ entities: ["sensor.dish_washer"] }, {}), "Dish Washer");
  assert.equal(applianceName({}, {}, "Elettrodomestico"), "Elettrodomestico");
});

test("appliance media retains the backwards-compatible priority", async () => {
  const { applianceMedia } = await import("../src/legacy/dashboard-data.js");
  assert.deepEqual(applianceMedia({ image: "/local/washer.png", icon: "mdi:washing-machine" }), {
    kind: "image",
    value: "/local/washer.png",
  });
  assert.deepEqual(applianceMedia({ image_url: "https://example.test/oven.png" }), {
    kind: "image",
    value: "https://example.test/oven.png",
  });
  assert.deepEqual(applianceMedia({ icon: "mdi:stove" }), { kind: "icon", value: "mdi:stove" });
  assert.deepEqual(applianceMedia({ device_type: "forno" }), { kind: "icon", value: "mdi:stove" });
});

test("Temperature editor always renders a room label", async () => {
  const module = await import(`../legacy/modules-entry.js?temperature-label=${Date.now()}`);
  await module.default.store.replaceSection("rooms", [
    { id: "room_x", name: "", temp: "sensor.t" },
  ]);
  const fallback = { innerHTML: "" };
  module.renderTemperatureEditor(fallback);
  assert.match(fallback.innerHTML, /data-room-name="Room 1"/);
  assert.match(fallback.innerHTML, /class="ed-row-new">Room 1</);
  await module.default.store.replaceSection("rooms", [
    { id: "room_x", name: "Cameretta", temp: "sensor.t" },
  ]);
  const named = { innerHTML: "" };
  module.renderTemperatureEditor(named);
  assert.match(named.innerHTML, /class="ed-row-new">Cameretta</);
});

test("energy report is derived from appliances and normalizes power and energy", async () => {
  const { applianceEnergyReport } = await import("../src/legacy/dashboard-data.js");
  const report = applianceEnergyReport(
    [
      {
        name: "Washer",
        room_id: "laundry",
        total_energy_entity: "sensor.washer_energy",
        entities: ["sensor.washer_power", "sensor.washer_energy"],
      },
    ],
    {
      "sensor.washer_power": { state: "1.25", attributes: { unit_of_measurement: "kW" } },
      "sensor.washer_energy": {
        state: "750",
        attributes: {
          unit_of_measurement: "Wh",
          device_class: "energy",
          state_class: "total_increasing",
        },
      },
    },
    [{ id: "laundry", name: "Laundry", icon: "mdi:washing-machine" }],
  );
  assert.equal(report[0].power.value, 1250);
  assert.equal(report[0].energy.value, 0.75);
  assert.equal(report[0].room.name, "Laundry");
  assert.equal(report[0].historyEntity, "sensor.washer_energy");
});
