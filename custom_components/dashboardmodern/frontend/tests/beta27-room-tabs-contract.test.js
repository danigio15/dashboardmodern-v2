import assert from "node:assert/strict";
import test from "node:test";

import { temperatureRoomTabsModel } from "../src/sections/beta26-real-device-stability-section.js";

test("beta27 room tabs use stable room ids rather than display names", () => {
  const tabs = temperatureRoomTabsModel([
    { id: "room-1", name: "Camera", temp: "sensor.one" },
    { id: "room-2", name: "Camera", temp: "sensor.two" },
  ]);
  assert.deepEqual(
    tabs.slice(1).map((tab) => tab.id),
    ["room-1", "room-2"],
  );
});
