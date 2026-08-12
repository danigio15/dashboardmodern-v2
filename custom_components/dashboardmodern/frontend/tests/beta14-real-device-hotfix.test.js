// DM-FIX-20260812B
import assert from "node:assert/strict";
import test from "node:test";
import { recoverRoomSnapshot } from "../src/sections/beta14-real-device-hotfix-section.js";

test("room recovery fills missing fields without appending by default", () => {
  const canonical = [{ id: "living", name: "Living" }];
  const captured = [
    { id: "living", name: "Living", icon: "mdi:sofa", temp: "sensor.living" },
    { id: "deleted", name: "Deleted", icon: "mdi:home" },
  ];
  assert.deepEqual(recoverRoomSnapshot(canonical, captured), [
    { id: "living", name: "Living", icon: "mdi:sofa", temp: "sensor.living" },
  ]);
});

test("default recovery never resurrects a room absent from canonical", () => {
  assert.deepEqual(
    recoverRoomSnapshot([{ id: "kept" }], [{ id: "kept" }, { id: "x" }]),
    [{ id: "kept" }],
  );
});

test("empty canonical boot snapshot can recover every captured room", () => {
  const captured = [{ id: "one" }, { id: "two" }];
  assert.deepEqual(recoverRoomSnapshot([], captured, { appendMissing: true }), captured);
});
