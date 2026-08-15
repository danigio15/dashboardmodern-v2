import assert from "node:assert/strict";
import test from "node:test";
import { DashboardStore } from "../src/core/dashboard-store.js";

globalThis.addEventListener = () => {};
const { integrationUserDataKey, migrateLegacyUserData, normalizeRestoredValues } =
  await import("../src/sections/config-persistence-section.js");

// DM-FIX-20260815A

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
  const store = new DashboardStore({ storage, sync: async () => {} });
  store.migrate();
  return { store, storage };
}

test("primary persistence uses the integration runtime key", () => {
  assert.equal(integrationUserDataKey(), "dashboardmodern_integration_config");
});

test("secondary persistence uses the sanitized runtime instance suffix", () => {
  assert.equal(
    integrationUserDataKey({ primary: false, instance: "Casa / mare! 123456789" }),
    "dashboardmodern_integration_config__Casamare12345678",
  );
});

test("legacy remote payload migrates once to the unified key", async () => {
  globalThis.__DASHBOARDMODERN_PRIMARY__ = true;
  globalThis.__DASHBOARDMODERN_INSTANCE__ = "integration";
  const legacy = { version: 1, values: { cd_sections: '{"home":true}' } };
  const values = new Map([["dashboardmodern_v2_config:integration", legacy]]);
  const pushes = [];
  const fetchValue = async (key) => values.get(key) || null;
  const pushValue = async (key, value) => {
    pushes.push([key, value]);
    values.set(key, value);
  };
  assert.equal(await migrateLegacyUserData(fetchValue, pushValue), legacy);
  assert.equal(await migrateLegacyUserData(fetchValue, pushValue), legacy);
  assert.deepEqual(pushes, [["dashboardmodern_integration_config", legacy]]);
});

test("store preserves a fresh legacy visibility write instead of overwriting it", () => {
  const { store, storage } = setup({ cd_sections: { home: false } });
  const external = { home: true, energy: false };
  storage.setItem("cd_sections", JSON.stringify(external));
  store.persist();
  assert.deepEqual(JSON.parse(storage.getItem("cd_sections")), external);
  assert.deepEqual(store.getState().visibility, external);
});

test("store preserves fresh room edits including Temperature display names", () => {
  const { store, storage } = setup();
  const rooms = [
    {
      id: "room-kitchen",
      name: "Kitchen",
      temp: "sensor.kitchen",
      temp_name: "Sonda cucina",
      hum: "sensor.kitchen_humidity",
      hum_name: "Umidità cucina",
    },
  ];
  storage.setItem("cd_stanze", JSON.stringify(rooms));
  store.persist();
  const saved = JSON.parse(storage.getItem("cd_stanze"))[0];
  assert.equal(saved.temp_name, "Sonda cucina");
  assert.equal(saved.hum_name, "Umidità cucina");
  assert.equal(store.getSection("rooms")[0].temp_name, "Sonda cucina");
});

test("restore normalizes room names in canonical and legacy snapshots", () => {
  const restored = normalizeRestoredValues({
    cd_stanze: JSON.stringify([{ id: "room_x", name: "", temp: "sensor.t" }]),
    dm_dashboard_state: JSON.stringify({
      schema_version: 4,
      sections: { rooms: [{ id: "room_y", name: "", temp: "sensor.y" }] },
    }),
  });
  assert.equal(JSON.parse(restored.cd_stanze)[0].name, "Room 1");
  assert.equal(JSON.parse(restored.dm_dashboard_state).sections.rooms[0].name, "Room 1");
});
