import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const stateGate = await read("../src/core/state-event-gate.js");
const editorContracts = await read("../src/sections/editor-contracts-section.js");
const evSection = await read("../src/sections/ev-section.js");
const temperatureSection = await read("../src/sections/temperature-section.js");
const appliancesSection = await read("../src/sections/appliances-section.js");
const shutterSection = await read("../src/sections/shutter-section.js");
const energySection = await read("../src/sections/energy-section.js");
const energyCalculations = await read("../src/sections/energy-calculations-section.js");
const dataContracts = await read("../src/sections/data-contracts-section.js");

test("live HA event gate filters against configured dashboard entities", () => {
  assert.match(stateGate, /configuredEntities/);
  assert.match(stateGate, /configured\.size && !configured\.has\(id\)/);
});

test("editor contracts do not observe or rescan the whole dashboard DOM", () => {
  assert.doesNotMatch(editorContracts, /new\s+(?:root\.)?MutationObserver/);
  assert.doesNotMatch(editorContracts, /\.observe\s*\(\s*doc\.body/);
  assert.doesNotMatch(editorContracts, /removeBatteryGlyphs/);
  assert.match(editorContracts, /if \(!doc\?\.querySelector\("#editor-modal,.dm-section-modal"\)\) return false/);
});

test("data contracts never restart a retry chain for live state changes", () => {
  assert.doesNotMatch(dataContracts, /dashboardmodern:state-changed/);
  assert.doesNotMatch(dataContracts, /state\.attempts/);
  assert.doesNotMatch(dataContracts, /attempts\s*<\s*(?:80|240)/);
  assert.match(dataContracts, /dashboardmodern:states-ready/);
});

test("EV runtime is event-driven and ignores unrelated state changes", () => {
  assert.match(evSection, /stateChangeAffectsEv/);
  assert.match(evSection, /configuredEvEntityIds/);
  assert.match(evSection, /if \(stateChangeAffectsEv\(event\)\) scheduleEvSync\(\)/);
  assert.doesNotMatch(evSection, /attempts\s*<\s*80/);
  assert.doesNotMatch(evSection, /schedule\(state\.attempts/);
});

test("Temperature cards ignore state changes outside configured room sensors", () => {
  assert.match(temperatureSection, /stateChangeAffectsTemperature/);
  assert.match(temperatureSection, /temperatureEntityIds/);
  assert.match(temperatureSection, /if \(stateChangeAffectsTemperature\(event\)\) normalizeTemperatureCards\(\)/);
});

test("appliance cards only react to their configured entities", () => {
  assert.match(appliancesSection, /stateChangeAffectsAppliances/);
  assert.match(appliancesSection, /applianceEntityIds/);
  assert.match(appliancesSection, /stateChangeAffectsAppliances\(event\)/);
  assert.match(appliancesSection, /appliancesVisible\(\)/);
});

test("shutter runtime is event-driven and has no permanent polling loop", () => {
  // La sezione ha smesso di essere viva: la card «Tapparelle aperte» e il suo
  // popup sono usciti dalla Home con il Quadro Avvisi, e quello che resta e'
  // la pelle della pagina Tapparelle — nessun ascolto, quindi niente da
  // filtrare. Chi disegna quelle tapparelle adesso e' il ponte dei widget.
  assert.doesNotMatch(shutterSection, /dashboardmodern:state-changed/);
  assert.doesNotMatch(shutterSection, /120\s*:\s*350/);
  assert.doesNotMatch(shutterSection, /schedule\(active/);
  assert.doesNotMatch(shutterSection, /setInterval\s*\(/);
});

test("Energy Recorder refreshes are scoped and reconciliation has one owner", () => {
  assert.match(energySection, /stateChangeAffectsEnergy/);
  assert.match(energySection, /energyRefreshEntityIds/);
  assert.match(energySection, /if \(stateChangeAffectsEnergy\(event\)\) scheduleEnergyRefresh\(false\)/);
  assert.match(energySection, /return reconcileEnergyBundle/);
  assert.doesNotMatch(energyCalculations, /addEventListener/);
  assert.doesNotMatch(energyCalculations, /dashboardmodern:period-bundle/);
});
