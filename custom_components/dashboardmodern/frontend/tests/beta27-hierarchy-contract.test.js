import assert from "node:assert/strict";
import test from "node:test";

import { normalizeFlowNodesForEditor } from "../src/sections/beta26-real-device-stability-section.js";

test("beta27 kitchen and laundry flow nodes remain linked to editable load groups", () => {
  const nodes = normalizeFlowNodesForEditor({});
  assert.equal(nodes.cuc.group, "cucina");
  assert.equal(nodes.lav.group, "lavanderia");
});
