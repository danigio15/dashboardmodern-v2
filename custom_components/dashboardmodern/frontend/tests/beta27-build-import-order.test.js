import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const generator = fs.readFileSync(new URL("../../../../../scripts/generate_build_info.py", import.meta.url), "utf8");

test("beta27 preservation bridge loads before the hierarchical stability runtime", () => {
  const preserve = generator.indexOf("beta27-subload-preserve-section.js");
  const stability = generator.indexOf("beta26-real-device-stability-section.js");
  assert.ok(preserve >= 0, "beta27 preservation bridge import is generated");
  assert.ok(stability >= 0, "stability runtime import is generated");
  assert.ok(preserve < stability, "preservation bridge loads before stability runtime");
});
