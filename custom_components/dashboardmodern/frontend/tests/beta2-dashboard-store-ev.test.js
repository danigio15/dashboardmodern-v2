import assert from "node:assert/strict";
import test from "node:test";

import { DashboardStore } from "../src/core/dashboard-store.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    dump() { return Object.fromEntries(data); },
  };
}

test("DashboardStore EV update preserves brand, icon, image and mappings", async () => {
  const storage = memoryStorage({
    dm_dashboard_state: JSON.stringify({
      schema_version: 4,
      sections: {
        rooms: [], cameras: [], appliances: [], loads: [], lights: [], climate: [],
        ev: [{
          id: "ev-pluto",
          name: "Pluto",
          brand: "Leapmotor",
          icon: "mdi:car-electric",
          img: "/local/pluto.png",
          ov: { "dm.ev_batteria_auto": "sensor.pluto_soc" },
        }],
        covers: [], pool: {}, irrigation: { zones: [] }, energy: {}, entityOverrides: {},
      },
      visibility: { ev: true },
    }),
  });
  const store = new DashboardStore({ storage, sync: async () => {} });
  store.migrate();
  const before = store.getSection("ev")[0];
  assert.equal(before.brand, "Leapmotor");

  const result = await store.updateItem("ev", "ev-pluto", {
    brand: "BMW",
    icon: "mdi:car-sports",
  });
  assert.equal(result.brand, "BMW");
  const after = store.getSection("ev")[0];
  assert.equal(after.brand, "BMW");
  assert.equal(after.icon, "mdi:car-sports");
  assert.equal(after.img, "/local/pluto.png");
  assert.deepEqual(after.ov, { "dm.ev_batteria_auto": "sensor.pluto_soc" });
  const projected = JSON.parse(storage.getItem("cd_ev_cars"));
  assert.equal(projected[0].brand, "BMW");
});
