import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stateGate = await readFile(new URL("../src/core/state-event-gate.js", import.meta.url), "utf8");
const editorContracts = await readFile(new URL("../src/sections/editor-contracts-section.js", import.meta.url), "utf8");
const evSection = await readFile(new URL("../src/sections/ev-section.js", import.meta.url), "utf8");
const temperatureSection = await readFile(new URL("../src/sections/temperature-section.js", import.meta.url), "utf8");

test("live HA event gate filters against configured dashboard entities", () => {
  assert.match(stateGate, /configuredEntities/);
  assert.match(stateGate, /configured\.size && !configured\.has\(id\)/);
});

test("editor contract work is scheduled only for editor mutations", () => {
  assert.match(editorContracts, /if \(mutationTouchesEditor\(records\)\) schedule\(\)/);
});

test("EV runtime ignores state changes that are not referenced by EV profiles", () => {
  assert.match(evSection, /stateChangeAffectsEv/);
  assert.match(evSection, /configuredEvEntityIds/);
  assert.match(evSection, /if \(!stateChangeAffectsEv\(event\)\) return/);
});

test("Temperature cards ignore state changes outside configured room sensors", () => {
  assert.match(temperatureSection, /stateChangeAffectsTemperature/);
  assert.match(temperatureSection, /temperatureEntityIds/);
  assert.match(temperatureSection, /if \(stateChangeAffectsTemperature\(event\)\) normalizeTemperatureCards\(\)/);
});
