import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("beta4 polish is loaded last so it can repair legacy editor markup", async () => {
  const entry = await read("src/sections/beta-entry-section.js");
  assert.match(entry, /editor-polish-section\.js";\nimport "\.\/beta4-mobile-polish-section\.js";/);
});

test("section rename button is moved out of the label and config icons have dedicated nodes", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  assert.match(source, /if \(button\.parentElement !== row\) row\.append\(button\)/);
  assert.match(source, /labelNode\.dataset\.dmConfigName = "true"/);
  assert.match(source, /dm-beta4-tab-icon/);
  assert.match(source, />\.dm-inline-rename\.dm-beta4-section-rename/);
});

test("room first insert uses its icon as the picker trigger and removes palette semantics", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  assert.match(source, /openRoomPicker\(input\)/);
  assert.match(source, /legacyPalette\.removeAttribute\("onclick"\)/);
  assert.match(source, /legacyPalette\.className = "dm-beta4-room-icon-trigger"/);
  assert.match(source, /#ed-room-icon-preview\{display:none!important\}/);
});

test("alerts keep custom controls hidden for predefined groups and stack entity controls", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  assert.match(source, /const visible = clean\(group\.value\) === "custom"/);
  assert.match(source, /custom\.hidden = !visible/);
  assert.match(source, /dm-beta4-alert-entity-row/);
  assert.match(source, /grid-template-columns:minmax\(0,1fr\) 50px/);
});

test("daily Energy chart restores the Casa and Fotovoltaico legacy path with all arguments", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  const legacy = await read("legacy/dashboard-runtime-it.js");
  assert.match(source, /const render = async \(\.\.\.args\) => legacy\(\.\.\.args\)/);
  assert.match(source, /render\.__dmBeta4CasaSolar = true/);
  assert.match(source, /render\.__dmActualHistory = true/);
  assert.match(legacy, /dm\.energy_produzione_solare_oggi/);
  assert.match(legacy, /dm\.energy_consumo_casa_oggi/);
  assert.match(legacy, /if \(!fetchOk && prodMese > 0\)/);
});

test("climate cards are truly natural-height on mobile and brand marks are readable locally", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  assert.match(source, /\.cp-card\{aspect-ratio:auto!important;min-height:0!important;height:auto!important/);
  assert.match(source, /\.clima-premium-grid\{grid-template-columns:1fr!important/);
  assert.match(source, /BRAND_SIGNS/);
  assert.match(source, /dm-beta4-brand-symbol/);
});
