import assert from "node:assert/strict";
import test from "node:test";
import { DashboardStore } from "../src/core/dashboard-store.js";
import { cloneValue, getDeviceDisplayName, getDeviceVisual } from "../src/core/device-model.js";
import { migrateEnergy, migrateRooms, migrateState } from "../src/core/migrations.js";
import { createEnergyReportRows, createRenderCoordinator } from "../src/core/renderers.js";

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

function setup(seed = {}) {
  const storage = new MemoryStorage();
  for (const [key, value] of Object.entries(seed)) storage.setItem(key, JSON.stringify(value));
  const synced = [];
  const store = new DashboardStore({
    storage,
    sync: async (state, change) => synced.push({ state, change }),
  });
  store.migrate();
  return { store, storage, synced };
}

test("canonical display names never concatenate category/type", () => {
  assert.equal(getDeviceDisplayName({ name: "Forno", type: "forno" }), "Forno");
  assert.equal(getDeviceDisplayName({ name: "fOrNo", device_type: "forno" }), "fOrNo");
  assert.equal(
    getDeviceDisplayName(
      { name: "OTHER", entities: ["sensor.oven"] },
      { "sensor.oven": { attributes: { friendly_name: "Forno cucina" } } },
    ),
    "Forno cucina",
  );
  assert.equal(
    getDeviceDisplayName({ name: "generico", entities: ["sensor.microonde_power"] }),
    "Microonde Power",
  );
  assert.equal(getDeviceDisplayName({ name: "Cucina", device_type: "forno" }), "Cucina");
});

test("canonical visual priority is image, legacy image, mdi icon, type, fallback", () => {
  assert.deepEqual(
    getDeviceVisual({ image: "/new.png", image_url: "/old.png", icon: "mdi:stove" }),
    { kind: "image", value: "/new.png" },
  );
  assert.deepEqual(getDeviceVisual({ image_url: "/old.png", icon: "mdi:stove" }), {
    kind: "image",
    value: "/old.png",
  });
  assert.deepEqual(getDeviceVisual({ icon: "mdi:stove", device_type: "microonde" }), {
    kind: "icon",
    value: "mdi:stove",
  });
  assert.deepEqual(getDeviceVisual({ icon: "generico", device_type: "microonde" }), {
    kind: "icon",
    value: "mdi:microwave",
  });
  assert.deepEqual(getDeviceVisual({}), { kind: "icon", value: "mdi:devices" });
});

test("legacy migration is idempotent, retains data, creates room_id and explicit appliance fields", () => {
  const legacy = {
    sections: {
      rooms: [{ name: "Cucina" }],
      appliances: [
        { name: "generico", icon: "forno", room: "Cucina", entities: ["sensor.oven_power"] },
      ],
    },
  };
  const first = migrateState(legacy).state;
  const second = migrateState(first).state;
  assert.deepEqual(second, first);
  const appliance = first.sections.appliances[0];
  assert.ok(appliance.id);
  assert.equal(appliance.room_id, first.sections.rooms[0].id);
  assert.equal(appliance.device_type, "forno");
  assert.equal(appliance.name, "");
  assert.ok(Object.hasOwn(appliance, "monthly_energy_entity"));
});

test("reactive CRUD persists, syncs, preserves ids and emits targeted updates", async () => {
  const { store, storage, synced } = setup({
    cd_sections: { appliances: false },
    cd_stanze: [{ id: "kitchen", name: "Cucina" }],
  });
  const calls = [];
  createRenderCoordinator(store, {
    renderSection: (section) => calls.push(`section:${section}`),
    renderAppliances: () => calls.push("appliances"),
    renderEnergyReport: () => calls.push("report"),
    renderNavbar: () => calls.push("navbar"),
  });
  const added = await store.addItem("appliances", {
    name: "Forno",
    icon: "mdi:stove",
    room_id: "kitchen",
  });
  assert.equal(store.getState().visibility.appliances, true);
  assert.deepEqual(calls, ["section:appliances", "appliances", "report", "navbar"]);
  await store.updateItem("appliances", added.id, { name: "Forno cucina" });
  assert.equal(store.getSection("appliances")[0].id, added.id);
  await store.removeItem("appliances", added.id);
  assert.equal(store.getSection("appliances").length, 0);
  assert.equal(
    store.getState().visibility.appliances,
    true,
    "empty sections stay explicitly visible",
  );
  assert.equal(JSON.parse(storage.getItem("cd_appliances")).length, 0);
  assert.equal(synced.length, 3);
});

test("optimistic listeners render before a delayed backend sync resolves", async () => {
  let releaseSync;
  const syncGate = new Promise((resolve) => {
    releaseSync = resolve;
  });
  const storage = new MemoryStorage();
  const store = new DashboardStore({ storage, sync: () => syncGate });
  store.migrate();
  const changes = [];
  store.subscribe((change) => changes.push(change.status));
  const pending = store.addItem("cameras", { name: "Ingresso", entity: "camera.ingresso" });
  assert.deepEqual(changes, ["optimistic"]);
  assert.equal(store.getSection("cameras").length, 1);
  releaseSync();
  await pending;
  assert.deepEqual(changes, ["optimistic", "success"]);
});

test("failed backend sync rolls model and persistence back without emitting stale DOM event", async () => {
  const storage = new MemoryStorage();
  const changes = [];
  const store = new DashboardStore({
    storage,
    sync: async () => {
      throw new Error("offline");
    },
  });
  store.migrate();
  store.subscribe((change) => changes.push(change));
  await assert.rejects(
    store.addItem("cameras", { name: "Ingresso", entity: "camera.ingresso" }),
    /offline/,
  );
  assert.equal(store.getSection("cameras").length, 0);
  assert.deepEqual(
    changes.map((change) => change.status),
    ["optimistic", "rollback"],
  );
  assert.equal(JSON.parse(storage.getItem("cd_cameras")).length, 0);
});

test("room ids are deterministic and collisions have deterministic suffixes", () => {
  const legacy = [
    { name: "Camera", floor: "Piano 1" },
    { name: "Camera", floor: "Piano 1" },
  ];
  assert.deepEqual(
    migrateRooms(legacy).map((room) => room.id),
    ["room-piano-1-camera", "room-piano-1-camera-2"],
  );
  assert.deepEqual(migrateRooms(legacy), migrateRooms(legacy));
});

test("energy migration retains an object schema instead of coercing it to devices", () => {
  const energy = migrateEnergy({
    house: { power: "sensor.house" },
    grid: { import: "sensor.grid" },
  });
  assert.equal(Array.isArray(energy), false);
  assert.equal(energy.house.power, "sensor.house");
  assert.deepEqual(energy.solar, {});
  assert.deepEqual(energy.battery, {});
});

test("cloneValue works when structuredClone is unavailable", () => {
  const original = globalThis.structuredClone;
  globalThis.structuredClone = undefined;
  try {
    const source = { nested: [1, 2] };
    const copy = cloneValue(source);
    copy.nested.push(3);
    assert.deepEqual(source, { nested: [1, 2] });
  } finally {
    globalThis.structuredClone = original;
  }
});

test("energy report keeps name, category, room and metrics separate", () => {
  const rows = createEnergyReportRows(
    [
      {
        id: "oven",
        name: "Forno",
        device_type: "forno",
        room_id: "kitchen",
        icon: "mdi:stove",
        power_entity: "sensor.oven_power",
        monthly_energy_entity: "sensor.oven_month",
      },
    ],
    {
      "sensor.oven_power": { state: "1200", attributes: { unit_of_measurement: "W" } },
      "sensor.oven_month": { state: "8.8", attributes: { unit_of_measurement: "kWh" } },
    },
    [{ id: "kitchen", name: "Cucina" }],
    0.3,
  );
  assert.equal(rows[0].name, "Forno");
  assert.equal(rows[0].category, "forno");
  assert.equal(rows[0].room.name, "Cucina");
  assert.equal(rows[0].power.value, 1200);
  assert.equal(rows[0].monthly.value, 8.8);
  assert.equal(rows[0].cost, 2.64);
});

test("one successful operation produces exactly one coordinated render", async () => {
  const { store } = setup();
  let sections = 0;
  let cameras = 0;
  createRenderCoordinator(store, {
    renderSection: () => sections++,
    renderCameras: () => cameras++,
  });
  await store.addItem("cameras", { name: "Garage", entity: "camera.garage" });
  assert.equal(sections, 1);
  assert.equal(cameras, 1);
});

test("legacy writes are reconciled back into the canonical runtime state", async () => {
  const { store, storage } = setup();
  store.installLegacyWriteBridge();
  storage.setItem(
    "cd_cameras",
    JSON.stringify([{ id: "legacy", name: "Legacy", entity: "camera.legacy" }]),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.getSection("cameras")[0].id, "legacy");
  assert.equal(
    JSON.parse(storage.getItem("dm_dashboard_state")).sections.cameras[0].name,
    "Legacy",
  );
});
