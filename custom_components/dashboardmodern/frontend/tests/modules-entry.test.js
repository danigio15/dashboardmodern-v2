import assert from "node:assert/strict";
import test from "node:test";

test("the exact module shipped by the HTML loads and exposes the canonical model", async () => {
  delete globalThis.DashboardModernModules;
  const module = await import(`../legacy/modules-entry.js?functional=${Date.now()}`);
  assert.equal(module.default, globalThis.DashboardModernModules);
  assert.equal(module.default.version, 2);
  assert.equal(typeof module.default.data.applianceGroups, "function");
  assert.equal(typeof module.default.data.applianceState, "function");
  assert.equal(typeof module.default.data.normalizeCameras, "function");
});
