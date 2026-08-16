import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const generator = fs.readFileSync(
  new URL("../../../../scripts/generate_build_info.py", import.meta.url),
  "utf8",
);
const runtime = fs.readFileSync(
  new URL("../src/sections/section-runtime.js", import.meta.url),
  "utf8",
);
const energyGuard = fs.readFileSync(
  new URL("../src/sections/energy-legacy-guard-section.js", import.meta.url),
  "utf8",
);

test("beta27 preservation is folded into the existing runtime before stability fixes", () => {
  const entry = generator.indexOf("beta-entry-section.js");
  const stability = generator.indexOf("beta26-real-device-stability-section.js");
  assert.ok(entry >= 0, "canonical runtime entry is generated");
  assert.ok(stability >= 0, "stability runtime import is generated");
  assert.ok(entry < stability, "canonical runtime loads before stability fixes");
  assert.match(runtime, /energy-legacy-guard-section\.js/);
  assert.match(energyGuard, /installBeta27SubloadPreservation/);
  assert.doesNotMatch(generator, /beta27-subload-preserve-section\.js/);
});
