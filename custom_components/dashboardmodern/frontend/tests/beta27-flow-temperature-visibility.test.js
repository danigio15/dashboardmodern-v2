import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureConfiguredSectionsVisible,
  normalizeFlowNodesForEditor,
  temperatureRoomTabsModel,
} from "../src/sections/beta26-real-device-stability-section.js";
import { mergePreservedSubloadItems } from "../src/sections/energy-legacy-guard-section.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("beta27 temperature tabs expose All plus every configured room once", () => {
  const tabs = temperatureRoomTabsModel([
    {
      id: "room-cameretta",
      name: "Cameretta",
      icon: "🛏️",
      temp: "sensor.cameretta_temperature",
      hum: "sensor.cameretta_humidity",
      metadata: {
        temperature_entries: [
          {
            id: "temperature-extra-1",
            name: "Seconda sonda",
            temp: "sensor.cameretta_seconda_temperature",
          },
        ],
      },
    },
    {
      id: "room-matrimoniale",
      name: "Matrimoniale",
      icon: "🛏️",
      temp: "sensor.matrimoniale_temperature",
    },
  ]);

  assert.deepEqual(
    tabs.map((tab) => [tab.id, tab.name, tab.count]),
    [
      ["all", "Tutte", 3],
      ["room-cameretta", "Cameretta", 2],
      ["room-matrimoniale", "Matrimoniale", 1],
    ],
  );
});

test("beta27 flow node model preserves maximum customization and safe defaults", () => {
  const nodes = normalizeFlowNodesForEditor({
    cuc: {
      enabled: false,
      name: "Zona cucina",
      icon: "🍕",
      color: "#123456",
      group: "cl_cucina_nuova",
      pwr: "sensor.cucina_power",
    },
  });

  assert.equal(nodes.cuc.enabled, false);
  assert.equal(nodes.cuc.name, "Zona cucina");
  assert.equal(nodes.cuc.icon, "🍕");
  assert.equal(nodes.cuc.color, "#123456");
  assert.equal(nodes.cuc.group, "cl_cucina_nuova");
  assert.equal(nodes.cuc.pwr, "sensor.cucina_power");
  assert.equal(nodes.lav.group, "lavanderia");
  assert.equal(nodes.boiler.nodeId, "n-boiler");
});

test("beta27 automatically turns configured legacy sections visible after save", () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = memoryStorage({
    cd_sections: JSON.stringify({ temp: false, security: false, energy: false }),
    cd_stanze: JSON.stringify([
      {
        id: "room-cameretta",
        name: "Cameretta",
        temp: "sensor.cameretta_temperature",
      },
    ]),
    cd_cameras: JSON.stringify([{ entity: "camera.ingresso" }]),
    cd_flow_nodes: JSON.stringify({ cuc: { pwr: "sensor.cucina_power" } }),
  });

  try {
    assert.equal(ensureConfiguredSectionsVisible({ sync: false }), true);
    const visibility = JSON.parse(globalThis.localStorage.getItem("cd_sections"));
    assert.equal(visibility.temp, true);
    assert.equal(visibility.security, true);
    assert.equal(visibility.energy, true);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

test("beta27 hierarchical loads preserve existing appliances and deduplicate projected children", () => {
  const oven = { name: "Forno", pwrLive: "sensor.forno_power" };
  const fridge = { name: "Frigorifero", pwrLive: "sensor.frigo_power" };
  const custom = { name: "Microonde", pwrLive: "sensor.microonde_power" };

  assert.deepEqual(
    mergePreservedSubloadItems([oven, fridge], [fridge, custom]),
    [oven, fridge, custom],
  );
});

/* Nascosta a mano vuol dire nascosta.
 *
 * Nella mappa delle visibilita' un `false` puo' voler dire due cose opposte:
 * "non l'ho ancora configurata", che ci scrive la procedura iniziale, oppure
 * "non la voglio vedere", che ci scrive chi preme il pulsante. La passata che
 * accende le sezioni configurate le trattava allo stesso modo.
 */
test("una sezione nascosta di persona non viene riaccesa", () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = memoryStorage({
    cd_sections: JSON.stringify({ temp: false, security: false }),
    cd_sections_manual: JSON.stringify({ temp: true }),
    cd_stanze: JSON.stringify([
      { id: "room-cameretta", name: "Cameretta", temp: "sensor.cameretta_temperature" },
    ]),
    cd_cameras: JSON.stringify([{ entity: "camera.ingresso" }]),
  });

  try {
    ensureConfiguredSectionsVisible({ sync: false });
    const visibility = JSON.parse(globalThis.localStorage.getItem("cd_sections"));
    // Temperature: nascosta premendo il pulsante, resta nascosta.
    assert.equal(visibility.temp, false);
    // Sicurezza: quel false lo aveva scritto la procedura iniziale, e ora che
    // c'e' una telecamera la cortesia vale ancora.
    assert.equal(visibility.security, true);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
