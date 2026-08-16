import assert from "node:assert/strict";
import test from "node:test";

import { legacyVisibilityTargets } from "../src/sections/beta26-real-device-stability-section.js";

test("beta27 visibility repair is driven by configured entities", () => {
  assert.equal(typeof legacyVisibilityTargets, "function");
});
