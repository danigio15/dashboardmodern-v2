import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalogUrl = new URL("../src/core/personalization-catalog.js", import.meta.url);
const personalizationUrl = new URL("../src/sections/personalization-section.js", import.meta.url);
const flowUrl = new URL("../src/sections/energy-flow-section.js", import.meta.url);
const reportUrl = new URL("../src/sections/energy-report-polish-section.js", import.meta.url);
const editorUrl = new URL("../src/sections/editor-polish-section.js", import.meta.url);
const temperatureUrl = new URL("../src/sections/temperature-section.js", import.meta.url);
const shutterUrl = new URL("../src/sections/shutter-section.js", import.meta.url);
const guardUrl = new URL("../src/sections/beta7-brand-guard-section.js", import.meta.url);

test("quick actions use local SVG artwork and the stable beta9 picker", async () => {
  const [catalog, guard, personalization] = await Promise.all([
    readFile(catalogUrl, "utf8"),
    readFile(guardUrl, "utf8"),
    readFile(personalizationUrl, "utf8"),
  ]);
  assert.match(catalog, /const ACTION_ARTWORK = Object\.freeze/);
  assert.match(catalog, /return svg\(ACTION_ARTWORK\[item\.id\]/);
  assert.match(guard, /dm-beta9-action-picker/);
  assert.match(guard, /input\.value = item\.mdi/);
  assert.match(guard, /html body #page-home #qa-grid/);
  assert.match(personalization, /AZIONI\\s\+RAPIDE\\s\+PREMIUM/);
  assert.match(personalization, /"AZIONI RAPIDE"/);
});

test("valued energy connectors are revived and animated even after legacy display none", async () => {
  const source = await readFile(flowUrl, "utf8");
  assert.match(source, /function exposeConnector/);
  assert.match(source, /style\.setProperty\("display", "inline", "important"\)/);
  assert.match(source, /const active = displayedActive === null \? legacyActive : displayedActive/);
  assert.doesNotMatch(source, /active && nodeVisible\(line\)/);
  assert.match(source, /animation:dmEnergyFlowDash \.8s linear infinite!important/);
});

test("financial overview reads configured rates and does not subtract sold energy from real cost", async () => {
  const source = await readFile(reportUrl, "utf8");
  assert.match(source, /root\.cdCfg\?\.\(key\)/);
  assert.match(source, /rateValue\("cd_costo_kwh"\)/);
  assert.match(source, /rateValue\("cd_prezzo_immissione"\)/);
  assert.match(source, /const realCost = importCost/);
  assert.doesNotMatch(source, /realCost\s*=\s*Math\.max\(0,\s*importCost\s*-\s*exportIncome/);
  assert.match(source, /__dmCanonicalEnergyRates/);
});

test("lights and load configuration have explicit readable layouts", async () => {
  const source = await readFile(editorUrl, "utf8");
  assert.match(source, /grid-template-areas:"order main room edit delete"/);
  assert.match(source, /dm-light-entity-id/);
  assert.match(source, /function polishLoadsEditor/);
  assert.match(source, /data-load-group="energy-primary"/);
  assert.match(source, /MISURE ENERGETICHE/);
  assert.match(source, /STATO E CONTROLLO/);
});

test("room icons, persisted navbar names and electrified vehicle model association are canonical", async () => {
  const source = await readFile(personalizationUrl, "utf8");
  assert.match(source, /function decorateRoomEditorRows/);
  assert.match(source, /dm-room-list-icon/);
  assert.match(source, /const persisted = clean\(savedNames\[key\]/);
  assert.match(source, /const CAR_MODELS = Object\.freeze/);
  assert.match(source, /"Leapmotor": \["T03", "B10", "C10", "C10 REEV"\]/);
  assert.match(source, /function brandForModel/);
  assert.match(source, /saveEvAppearance\(brand, model\)/);
  assert.doesNotMatch(source, /data-car-icon/);
});

test("Leapmotor uses a local emblem rather than a remote wordmark", async () => {
  const source = await readFile(catalogUrl, "utf8");
  assert.match(source, /function leapmotorVisual/);
  assert.match(source, /dm-leapmotor-mark/);
  assert.match(source, /if \(item\.id === "leapmotor"\) return leapmotorVisual/);
  assert.doesNotMatch(source, /cdn\.simpleicons\.org\/leapmotor/);
});

test("temperature edit can atomically move sensors to another room without overwriting room icons", async () => {
  const source = await readFile(temperatureUrl, "utf8");
  assert.match(source, /function bindTemperatureRoomReassignment/);
  assert.match(source, /select\.disabled = false/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
  assert.match(source, /if \(id === originalId && originalId !== targetId\) return \{ \.\.\.room, temp: "", hum: "" \}/);
  assert.match(source, /if \(id === targetId\) return \{ \.\.\.room, temp, hum \}/);
  assert.match(source, /const next = currentRooms\.map/);
});

test("shutters use the beta9 dashboard-consistent page design", async () => {
  const source = await readFile(shutterUrl, "utf8");
  assert.match(source, /function polishShutterPage/);
  assert.match(source, /dmShutterDesign = "beta9"/);
  assert.match(source, /dm-beta9-shutter-master/);
  assert.match(source, /dm-beta9-shutter-window/);
  assert.match(source, /linear-gradient\(135deg,#10b981,#15803d\)/);
  assert.match(source, /repeat\(auto-fit,minmax\(260px,330px\)\)/);
});