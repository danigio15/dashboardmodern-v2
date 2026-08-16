import assert from "node:assert/strict";
import test from "node:test";

import { loadGroupsModel } from "../src/sections/beta26-real-device-stability-section.js";

test("beta27 load groups always expose kitchen and laundry", () => {
  const groups = loadGroupsModel();
  assert.ok(groups.some((group) => group.id === "cucina"));
  assert.ok(groups.some((group) => group.id === "lavanderia"));
});
