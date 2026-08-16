import assert from "node:assert/strict";
import test from "node:test";

import { normalizeFlowNodesForEditor } from "../src/sections/beta26-real-device-stability-section.js";

test("beta27 flow node customization keeps icon color group and power", () => {
  const nodes = normalizeFlowNodesForEditor({
    cuc: {
      icon: "🍳",
      color: "#ff8800",
      group: "cucina",
      pwr: "sensor.cucina_power",
    },
  });
  assert.equal(nodes.cuc.icon, "🍳");
  assert.equal(nodes.cuc.color, "#ff8800");
  assert.equal(nodes.cuc.group, "cucina");
  assert.equal(nodes.cuc.pwr, "sensor.cucina_power");
});
