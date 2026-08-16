import assert from "node:assert/strict";
import test from "node:test";

import {
  preferredApplianceVisual,
  projectTemperatureEntries,
  removeTemperatureEntry,
  temperatureEntries,
  upsertTemperatureEntry,
} from "../src/sections/beta25-real-device-fixes-section.js";

test("the same room can keep more than one temperature association", () => {
  const room = {
    id: "room-cameretta",
    name: "Cameretta",
    temp: "sensor.cameretta_temperature",
    hum: "sensor.cameretta_humidity",
    metadata: {},
  };

  const updated = upsertTemperatureEntry(room, {
    id: "temperature-second",
    name: "Comodino",
    temp: "sensor.cameretta_temperature_2",
    hum: "sensor.cameretta_humidity_2",
  });
  const entries = temperatureEntries(updated);

  assert.equal(entries.length, 2);
  assert.equal(updated.temp, "sensor.cameretta_temperature");
  assert.equal(updated.hum, "sensor.cameretta_humidity");
  assert.equal(updated.metadata.temperature_entries.length, 1);
  assert.deepEqual(updated.metadata.temperature_entries[0], {
    id: "temperature-second",
    name: "Comodino",
    temp: "sensor.cameretta_temperature_2",
    hum: "sensor.cameretta_humidity_2",
  });
});

test("removing the primary room temperature promotes the next association without losing it", () => {
  const room = projectTemperatureEntries(
    { id: "room-cameretta", name: "Cameretta", metadata: {} },
    [
      {
        id: "primary",
        name: "Parete",
        temp: "sensor.temp_wall",
        hum: "sensor.hum_wall",
      },
      {
        id: "temperature-desk",
        name: "Scrivania",
        temp: "sensor.temp_desk",
        hum: "sensor.hum_desk",
      },
    ],
  );

  const updated = removeTemperatureEntry(room, "primary");
  assert.equal(updated.temp, "sensor.temp_desk");
  assert.equal(updated.hum, "sensor.hum_desk");
  assert.equal(updated.temp_name, "Scrivania");
  assert.deepEqual(updated.metadata.temperature_entries, undefined);
  assert.equal(temperatureEntries(updated).length, 1);
});

test("editing a second association does not overwrite the primary room sensors", () => {
  let room = upsertTemperatureEntry(
    {
      id: "room-matrimoniale",
      name: "Matrimoniale",
      temp: "sensor.bedroom_main_temp",
      hum: "sensor.bedroom_main_hum",
      metadata: {},
    },
    {
      id: "temperature-window",
      name: "Finestra",
      temp: "sensor.bedroom_window_temp",
      hum: "sensor.bedroom_window_hum",
    },
  );

  room = upsertTemperatureEntry(
    room,
    {
      id: "temperature-window",
      name: "Finestra nord",
      temp: "sensor.bedroom_window_temp_new",
      hum: "sensor.bedroom_window_hum_new",
    },
    "temperature-window",
  );

  assert.equal(room.temp, "sensor.bedroom_main_temp");
  assert.equal(room.hum, "sensor.bedroom_main_hum");
  assert.equal(room.metadata.temperature_entries[0].name, "Finestra nord");
  assert.equal(room.metadata.temperature_entries[0].temp, "sensor.bedroom_window_temp_new");
});

test("selected standard dishwasher artwork wins over a stale washer image", () => {
  assert.deepEqual(
    preferredApplianceVisual({
      name: "Lavastoviglie",
      visual_type: "asset",
      visual_key: "lavastoviglie",
      device_type: "lavastoviglie",
      image: "/local/old-washer.png",
      image_url: "/local/old-washer.png",
    }),
    { kind: "asset", value: "lavastoviglie", artwork: "dishwasher" },
  );
});

test("an explicitly custom appliance image remains a custom image", () => {
  assert.deepEqual(
    preferredApplianceVisual({
      visual_type: "image",
      visual_key: "lavastoviglie",
      image: "/local/my-dishwasher.png",
    }),
    { kind: "image", value: "/local/my-dishwasher.png", artwork: "" },
  );
});
