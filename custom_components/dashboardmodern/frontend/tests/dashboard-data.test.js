import assert from "node:assert/strict";
import test from "node:test";

import {
  applianceGroups,
  applianceState,
  controllableEntity,
  normalizeCameras,
  normalizeRooms,
  removeCamera,
  saveCamera,
} from "../src/legacy/dashboard-data.js";

for (const locale of ["it", "en"]) {
  test(`${locale}: appliance tabs use stable configured room ids`, () => {
    const rooms = normalizeRooms([
      { id: "living", name: "Salotto" },
      { id: "utility", name: "Lavanderia" },
      { id: "empty", name: "Vuota" },
    ]);
    const appliances = [
      { name: "TV", room_id: "living", switch_entity: "switch.tv" },
      { name: "Washer", room_id: "utility", entities: ["sensor.washer_power"] },
      { name: "Legacy" },
    ];
    const model = applianceGroups(appliances, rooms);
    assert.deepEqual(
      model.groups.map((group) => group.room.id),
      ["living", "utility"],
    );
    assert.deepEqual(
      model.groups.map((group) => group.appliances[0].name),
      ["TV", "Washer"],
    );
    assert.equal(
      model.groups.some((group) => group.room.id === "empty"),
      false,
    );
    assert.deepEqual(
      model.unassigned.map((item) => item.name),
      ["Legacy"],
    );
    // A rename changes presentation only; the relation remains the stable id.
    assert.equal(
      applianceGroups(appliances, [{ id: "living", name: "Lounge" }]).groups[0].appliances[0].name,
      "TV",
    );
  });

  test(`${locale}: appliance toggle is emitted only for controllable entities`, () => {
    assert.equal(controllableEntity({ control_entity: "switch.fridge" }), "switch.fridge");
    assert.equal(controllableEntity({ switch_entity: "switch.washer" }), "switch.washer");
    assert.equal(controllableEntity({ light: "light.oven" }), "light.oven");
    assert.equal(controllableEntity({ entities: ["sensor.washer_power"] }), "");
  });

  test(`${locale}: appliance state uses real power units and binary state`, () => {
    const appliance = {
      entities: ["sensor.power", "sensor.energy", "switch.appliance"],
      threshold_run: 5,
      threshold_standby: 1,
    };
    assert.deepEqual(
      applianceState(appliance, {
        "sensor.power": { state: "0", attributes: { unit_of_measurement: "W" } },
        "sensor.energy": { state: "150", attributes: { unit_of_measurement: "kWh" } },
        "switch.appliance": { state: "off", attributes: {} },
      }),
      { state: "off", watts: 0 },
    );
    assert.deepEqual(
      applianceState(appliance, {
        "sensor.power": { state: "2", attributes: { unit_of_measurement: "W" } },
        "switch.appliance": { state: "on", attributes: {} },
      }),
      { state: "standby", watts: 2 },
    );
    assert.deepEqual(
      applianceState(appliance, {
        "sensor.power": { state: "0.025", attributes: { unit_of_measurement: "kW" } },
      }),
      { state: "running", watts: 25 },
    );
  });

  test(`${locale}: canonical control_entity drives the live appliance state`, () => {
    const appliance = {
      id: "fridge",
      control_entity: "switch.fridge",
      power_entity: "sensor.fridge_power",
      threshold_run: 5,
      threshold_standby: 1,
    };
    assert.deepEqual(
      applianceState(appliance, {
        "switch.fridge": { state: "on", attributes: {} },
        "sensor.fridge_power": { state: "0", attributes: { unit_of_measurement: "W" } },
      }),
      { state: "standby", watts: 0 },
    );
    assert.deepEqual(
      applianceState(appliance, {
        "switch.fridge": { state: "off", attributes: {} },
        "sensor.fridge_power": { state: "82", attributes: { unit_of_measurement: "W" } },
      }),
      { state: "running", watts: 82 },
    );
  });

  test(`${locale}: camera CRUD preserves distinct cards and survives serialization`, () => {
    let cameras = saveCamera([], {
      name: "Front",
      camera_entity: "camera.front",
      stream_url: "front-stream",
      room_id: "outside",
    });
    cameras = saveCamera(cameras, {
      name: "Garage",
      entity: "camera.garage",
      url: "garage-stream",
      room_id: "garage",
    });
    assert.deepEqual(
      cameras.map(({ name, entity, stream }) => [name, entity, stream]),
      [
        ["Front", "camera.front", "front-stream"],
        ["Garage", "camera.garage", "garage-stream"],
      ],
    );
    cameras = saveCamera(
      cameras,
      { ...cameras[1], name: "Workshop", stream: "workshop-stream" },
      1,
    );
    assert.deepEqual(
      normalizeCameras(JSON.parse(JSON.stringify(cameras))).map(({ name, stream }) => [
        name,
        stream,
      ]),
      [
        ["Front", "front-stream"],
        ["Workshop", "workshop-stream"],
      ],
    );
    assert.deepEqual(
      removeCamera(cameras, 0).map((camera) => camera.name),
      ["Workshop"],
    );
  });
}
