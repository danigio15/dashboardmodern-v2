import assert from "node:assert/strict";
import test from "node:test";

import {
  APPLIANCE_CATALOG,
  canonicalApplianceVisualKey,
  normalizeDevice,
} from "../src/core/device-model.js";

/* Le 20 voci originali piu' le due chieste dal campo: il boiler d'accumulo
 * (chiave «accumulo», etichetta Boiler) e la friggitrice ad aria. */
const PICKER_KEYS = [
  "lavatrice",
  "lavastoviglie",
  "asciugatrice",
  "forno",
  "microonde",
  "frigo",
  "congelatore",
  "piano_cottura",
  "cappa",
  "ferro",
  "aspirapolvere",
  "robot",
  "condizionatore",
  "ventilatore",
  "scaldabagno",
  "accumulo",
  "tv",
  "caffe",
  "tostapane",
  "bollitore",
  "friggitrice",
  "generico",
];

const PICKER_LABELS_IT = [
  "Lavatrice",
  "Lavastoviglie",
  "Asciugatrice",
  "Forno",
  "Microonde",
  "Frigorifero",
  "Congelatore",
  "Piano cottura",
  "Cappa",
  "Ferro da stiro",
  "Aspirapolvere",
  "Robot aspirapolvere",
  "Condizionatore",
  "Ventilatore",
  "Scaldabagno",
  "Boiler",
  "TV",
  "Caffettiera",
  "Tostapane",
  "Bollitore",
  "Friggitrice ad aria",
  "Altro",
];

test("the canonical catalog is exactly the original 20-item appliance picker", () => {
  assert.deepEqual(APPLIANCE_CATALOG.map((item) => item.key), PICKER_KEYS);
  assert.deepEqual(APPLIANCE_CATALOG.map((item) => item.it), PICKER_LABELS_IT);
});

test("all legacy aliases used by appliance/report code resolve to picker keys", () => {
  const aliases = {
    frigorifero: "frigo",
    fridge: "frigo",
    freezer: "congelatore",
    televisore: "tv",
    climatizzatore: "condizionatore",
    fan: "ventilatore",
    boiler: "scaldabagno",
    "robot vacuum": "robot",
    caffettiera: "caffe",
    toaster: "tostapane",
    kettle: "bollitore",
  };
  for (const [value, expected] of Object.entries(aliases)) {
    assert.equal(canonicalApplianceVisualKey(value), expected, value);
  }
});

test("an appliance accidentally saved as generic recovers the specific visual and keeps links", () => {
  const appliance = normalizeDevice(
    {
      id: "appl-fridge",
      name: "Frigorifero",
      device_type: "generico",
      icon: "generico",
      visual_type: "asset",
      visual_key: "generico",
      entities: ["switch.frigo", "sensor.frigo_power"],
    },
    "appliances",
  );

  assert.equal(appliance.visual_key, "frigo");
  assert.deepEqual(appliance.entities, ["switch.frigo", "sensor.frigo_power"]);
});
