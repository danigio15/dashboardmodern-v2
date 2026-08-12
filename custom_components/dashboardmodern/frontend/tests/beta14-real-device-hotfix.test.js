// DM-FIX-20260812B
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { roomGlyph } from "../src/core/personalization-catalog.js";
import {
  recoverRoomSnapshot,
  resolvedRooms,
} from "../src/sections/beta14-real-device-hotfix-section.js";

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

test("room recovery matches a captured room without id by name", () => {
  assert.deepEqual(
    recoverRoomSnapshot(
      [{ id: "room-x", name: "Bagno", icon: "" }],
      [{ name: "bagno", icon: "mdi:shower", temp: "sensor.bagno" }],
    ),
    [
      {
        id: "room-x",
        name: "Bagno",
        icon: "mdi:shower",
        temp: "sensor.bagno",
      },
    ],
  );
});

test("post-boot reconciliation never wipes canonical rooms for empty legacy state", () => {
  const canonical = [{ id: "kept", name: "Kept" }];
  resolvedRooms(canonical, canonical, canonical);
  assert.deepEqual(resolvedRooms(canonical, []), canonical);
});

test("shared room catalog preserves historical Temperature glyph aliases", () => {
  assert.equal(roomGlyph("mdi:bathtub-outline"), "🛁");
  assert.equal(roomGlyph("mdi:chef-hat"), "🍳");
  assert.equal(roomGlyph("mdi:desk"), "💻");
});

test("beta14 hotfix loads after the beta12 glyph owner in both sentinels", async () => {
  const buildInfo = await readFile(
    new URL("../legacy/build-info.js", import.meta.url),
    "utf8",
  );
  const generator = await readFile(
    new URL("../../../../scripts/generate_build_info.py", import.meta.url),
    "utf8",
  );
  for (const source of [buildInfo, generator]) {
    const beta12 = source.indexOf("beta12-room-color-lock-section.js");
    const beta14 = source.indexOf("beta14-real-device-hotfix-section.js");
    assert.ok(beta12 >= 0, "beta12 owner import is present");
    assert.ok(beta14 > beta12, "beta14 hotfix loads after beta12 owner");
  }
});
