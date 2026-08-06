import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/sections/runtime-hotfix-0159-section.js", import.meta.url);
const runtimeUrl = new URL("../src/sections/section-runtime.js", import.meta.url);

test("0.15.9 promotes cumulative annual sensors to canonical total sensors", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /group\.total_energy = annual/);
  assert.match(source, /total_import_energy/);
  assert.match(source, /total_export_energy/);
  assert.match(source, /total_charged_energy/);
  assert.match(source, /total_discharged_energy/);
  assert.match(source, /state_class/);
  assert.match(source, /total_increasing/);
});

test("0.15.9 removes global appliance render and retry storms", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /removeEventListener\?\.\("dashboardmodern:state-changed", scheduleApplianceNormalization\)/);
  assert.match(source, /root\.render = root\.render\.__dmPrevious/);
  assert.match(source, /configuredApplianceEntities\(\)\.has\(id\)/);
  assert.match(source, /stability\.attempts = Math\.max\(24/);
});

test("0.15.9 distinguishes running, standby and off appliances", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /power > threshold/);
  assert.match(source, /IN FUNZIONE/);
  assert.match(source, /STANDBY/);
  assert.match(source, /SPENTO/);
});

test("section runtime loads the 0.15.9 hotfix last", async () => {
  const source = await readFile(runtimeUrl, "utf8");
  assert.match(source, /installRuntimeHotfix0159Section/);
  assert.match(source, /"runtime-hotfix-0159"/);
});
