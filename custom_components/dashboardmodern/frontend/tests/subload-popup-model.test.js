// DM-FIX-20260817C
import assert from "node:assert/strict";
import test from "node:test";

import {
  formatKwh,
  formatWatts,
  subloadPopupModel,
  subloadState,
} from "../src/core/subload-popup-model.js";

const KITCHEN = { id: "cucina", name: "Cucina", icon: "🍳", color: "#f97316" };

function child(id, name, overrides = {}) {
  return { id, name, icon: "🔌", power: `sensor.${id}_power`, ...overrides };
}

test("the popup total is the sum of the appliances, the same number the circle shows", () => {
  const model = subloadPopupModel({
    load: KITCHEN,
    children: [child("forno", "Forno"), child("frigo", "Frigorifero")],
    states: {
      "sensor.forno_power": { state: "1800" },
      "sensor.frigo_power": { state: "95" },
    },
  });
  assert.equal(model.total, 1895);
  assert.equal(model.totalText, "1,90 kW");
  assert.equal(model.count, 2);
  assert.equal(model.running, 2);
});

test("appliances are ranked by draw, with the share measured inside the group", () => {
  const model = subloadPopupModel({
    load: KITCHEN,
    children: [child("frigo", "Frigorifero"), child("forno", "Forno"), child("radio", "Radio")],
    states: {
      "sensor.frigo_power": { state: "95" },
      "sensor.forno_power": { state: "1800" },
      "sensor.radio_power": { state: "0" },
    },
  });
  assert.deepEqual(
    model.items.map(({ name }) => name),
    ["Forno", "Frigorifero", "Radio"],
  );
  assert.equal(model.items[0].share, 1);
  assert.ok(model.items[1].share > 0 && model.items[1].share < 0.1);
  assert.equal(model.items[2].share, 0);
});

test("idle is not an error state, and a missing reading is not an off one", () => {
  const states = {
    "sensor.forno_power": { state: "1800" },
    "sensor.frigo_power": { state: "1.5" },
    "sensor.radio_power": { state: "0" },
  };
  assert.equal(subloadState(child("forno", "Forno"), states).key, "running");
  assert.equal(subloadState(child("frigo", "Frigo"), states).key, "standby");
  assert.equal(subloadState(child("radio", "Radio"), states).key, "off");
  assert.equal(subloadState(child("assente", "Assente"), states).key, "unknown");
  // Off and standby are neutral surfaces; only a fault-free accent for running.
  assert.notEqual(subloadState(child("radio", "Radio"), states).color, "#e11d48");
});

test("a state entity wins over power, because a cycle can pause at zero watts", () => {
  const states = {
    "binary_sensor.washer": { state: "on" },
    "sensor.washer_power": { state: "0" },
  };
  const washer = child("washer", "Lavatrice", { state: "binary_sensor.washer" });
  assert.equal(subloadState(washer, states).key, "running");

  // Reported off but still drawing a trickle: standby, not off.
  const idle = child("washer", "Lavatrice", { state: "binary_sensor.washer" });
  assert.equal(
    subloadState(idle, {
      "binary_sensor.washer": { state: "off" },
      "sensor.washer_power": { state: "2" },
    }).key,
    "standby",
  );
});

test("an appliance with no reading shows as absent, never as zero", () => {
  const model = subloadPopupModel({ load: KITCHEN, children: [child("forno", "Forno")], states: {} });
  assert.equal(model.items[0].power, null);
  assert.equal(model.items[0].powerText, "—");
  assert.equal(model.total, null);
  assert.equal(model.totalText, "—");
});

test("readings are formatted the way the dashboard formats them", () => {
  assert.equal(formatWatts(950), "950 W");
  assert.equal(formatWatts(1895), "1,90 kW");
  assert.equal(formatWatts(1895, "en-GB"), "1.90 kW");
  assert.equal(formatWatts(null), "—");
  assert.equal(formatKwh(2.34), "2,3 kWh");
  assert.equal(formatKwh(null), "");
});

test("the legacy popup rows are read as they are, without a second config", () => {
  // `pwr`/`bin` are the shapes the hosted popup already stores.
  const model = subloadPopupModel({
    load: KITCHEN,
    children: [{ id: "forno", name: "Forno", pwr: "sensor.forno_power", bin: "binary_sensor.forno" }],
    states: {
      "sensor.forno_power": { state: "1800" },
      "binary_sensor.forno": { state: "on" },
    },
  });
  assert.equal(model.items[0].power, 1800);
  assert.equal(model.items[0].state, "running");
});

test("a circle with nothing inside says so instead of showing an empty grid", () => {
  const model = subloadPopupModel({ load: KITCHEN, children: [], states: {} });
  assert.equal(model.count, 0);
  assert.equal(model.total, null);
  assert.deepEqual(model.items, []);
});

test("the popup names the circle it was opened from, with its period", () => {
  const model = subloadPopupModel({ load: KITCHEN, children: [child("forno", "Forno")], states: {} });
  // The modal heading was a static "CARICHI": nothing said which circle it was.
  assert.equal(model.name, "Cucina");
  assert.equal(model.icon, "🍳");
  assert.equal(model.id, "cucina");
});
