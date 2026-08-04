import assert from "node:assert/strict";
import test from "node:test";

const storage = new Map();
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};

const runtime = await import("../legacy/runtime-consolidated.js");
const vehicle = await import("../src/core/vehicle-image-runtime.js");

function put(key, value) {
  storage.set(key, JSON.stringify(value));
}

test("lights editor groups only rooms containing configured entities", () => {
  storage.clear();
  put("cd_luci", {
    "light.cucina": "Cucina",
    "light.pensili": "Pensili",
    "light.salone": "Salone",
  });
  put("cd_luci_rooms", {
    "light.cucina": "Cucina",
    "light.pensili": "Cucina",
    "light.salone": "Salone",
  });
  put("cd_luci_room_order", ["ROOM-VUOTA", "Salone", "Cucina"]);
  put("cd_luci_order", {
    Cucina: ["light.pensili", "light.cucina"],
    "ROOM-VUOTA": [],
  });

  assert.deepEqual(
    runtime.configuredLightGroups().map(({ room, entities }) => ({ room, entities })),
    [
      { room: "Salone", entities: ["light.salone"] },
      { room: "Cucina", entities: ["light.pensili", "light.cucina"] },
    ],
  );
});

test("vehicle image paths accept Home Assistant www, integration and relative assets", () => {
  const base = "https://ha.local/api/dashboardmodern/hash/legacy/dashboard.html";
  assert.equal(vehicle.resolveVehicleAsset("/config/www/auto/b10.png", base), "/local/auto/b10.png");
  assert.equal(vehicle.resolveVehicleAsset("www/auto/b10.png", base), "/local/auto/b10.png");
  assert.equal(vehicle.resolveVehicleAsset("/local/auto/b10.png", base), "/local/auto/b10.png");
  assert.equal(
    vehicle.resolveVehicleAsset("images/b10.png", base),
    "https://ha.local/api/dashboardmodern/hash/legacy/images/b10.png",
  );
  assert.equal(
    vehicle.resolveVehicleAsset(
      "/config/custom_components/dashboardmodern/frontend/images/b10.png",
      base,
    ),
    "https://ha.local/api/dashboardmodern/hash/images/b10.png",
  );
  assert.equal(
    vehicle.resolveVehicleAsset(
      "custom_components/dashboardmodern/frontend/legacy/images/b10.png",
      base,
    ),
    "https://ha.local/api/dashboardmodern/hash/legacy/images/b10.png",
  );
  assert.equal(vehicle.resolveVehicleAsset("C:\\Users\\me\\b10.png", base), "");
});
