import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const dataContracts = await read("../src/sections/data-contracts-section.js");
const energy = await read("../src/sections/energy-section.js");
const calculations = await read("../src/sections/energy-calculations-section.js");
const appliances = await read("../src/sections/appliances-section.js");
const shutters = await read("../src/sections/shutter-section.js");
const ev = await read("../src/sections/ev-section.js");

test("live state changes cannot restart migration or retry loops", () => {
  assert.doesNotMatch(dataContracts, /dashboardmodern:state-changed/);
  assert.doesNotMatch(dataContracts, /state\.attempts|attempts\s*<\s*(?:80|240)/);
  assert.doesNotMatch(shutters, /120\s*:\s*350|schedule\(active/);
  assert.doesNotMatch(ev, /attempts\s*<\s*80|schedule\(state\.attempts/);
});

test("each expensive live section filters the changed entity first", () => {
  assert.match(energy, /stateChangeAffectsEnergy\(event\)/);
  assert.match(appliances, /stateChangeAffectsAppliances\(event\)/);
  assert.match(shutters, /stateChangeAffectsShutters\(event\)/);
  assert.match(ev, /stateChangeAffectsEv\(event\)/);
});

test("Home Assistant energy balance has a single canonical owner", () => {
  assert.match(energy, /return reconcileEnergyBundle/);
  assert.doesNotMatch(calculations, /dashboardmodern:period-bundle/);
  assert.doesNotMatch(calculations, /addEventListener/);
});

test("monthly helpers can never be promoted to lifetime history by data contracts", () => {
  assert.match(dataContracts, /isLifetimeEnergyEntity/);
  assert.match(dataContracts, /const history = isLifetimeEnergyEntity\(explicitHistory\) \? explicitHistory : total/);
  assert.match(dataContracts, /const report = isLifetimeEnergyEntity\(explicitReport\) \? explicitReport : total/);
  assert.doesNotMatch(dataContracts, /total \|\| monthly \|\| energy/);
});

test("obsolete shutter skin module is physically absent", async () => {
  await assert.rejects(
    access(new URL("../src/sections/shutter-alert-layout-section.js", import.meta.url)),
  );
});
