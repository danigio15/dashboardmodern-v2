import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const polishUrl = new URL("../src/sections/beta11-real-device-polish-section.js", import.meta.url);
const entityGuardUrl = new URL("../src/sections/entity-picker-guard-section.js", import.meta.url);
const generatorUrl = new URL("../../../../scripts/generate_build_info.py", import.meta.url);
const sentinelUrl = new URL("../legacy/build-info.js", import.meta.url);

test("beta11 is loaded after the existing beta entry in generated and source builds", async () => {
  const [generator, sentinel] = await Promise.all([
    readFile(generatorUrl, "utf8"),
    readFile(sentinelUrl, "utf8"),
  ]);
  for (const source of [generator, sentinel]) {
    const entry = source.indexOf("bootstrap-section.js");
    const beta11 = source.indexOf("beta11-real-device-polish-section.js");
    assert.ok(entry >= 0);
    assert.ok(beta11 > entry);
  }
});

test("EV preview constrains inline and remote logos and follows active vehicle identity", async () => {
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /cd_ev_car_active/);
  assert.match(source, /panel\.dataset\.dmBeta11VehicleSignature/);
  assert.match(source, /dispatchValue\(brandSelect, brand(?:, \{ force: true \})?\)/);
  assert.match(source, /dispatchValue\(modelSelect, model\)/);
  assert.match(source, /\.dm-leapmotor-mark/);
  assert.match(source, /width:108px!important/);
  assert.match(source, /height:48px!important/);
  assert.match(source, /grid-template-columns:112px minmax\(0,1fr\)!important/);
});

test("room rows preserve metadata and delegate icon rendering to the canonical engine", async () => {
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /function mergedRooms\(\)/);
  assert.match(source, /return \{ \.\.\.fallback, \.\.\.room \}/);
  assert.match(source, /icon\.dataset\.roomIcon = clean\(room\.icon \|\| icon\.dataset\.roomIcon \|\| "mdi:home"\)/);
  assert.match(source, /DashboardModernIconEngine\?\.syncEditor\?\.\(\)/);
  assert.doesNotMatch(source, /icon\.innerHTML\s*=/);
  assert.doesNotMatch(source, /target\.innerHTML\s*=\s*roomMarkup/);
  assert.doesNotMatch(source, /function roomMarkup\(/);
  assert.match(source, /label\.textContent = name/);
  assert.match(source, /label\.dataset\.dmRoomName = "true"/);
  assert.match(source, /visibility:visible!important;opacity:1!important/);
  assert.match(source, /\.ed-row-new/);
});

test("alerts get an expanded coherent visual picker without polling", async () => {
  const source = await readFile(polishUrl, "utf8");
  const catalogEntries = [...source.matchAll(/^\s*\["[^\"]+",\s*"[^\"]+",\s*"[^\"]+",/gm)];
  assert.ok(catalogEntries.length >= 35, `expected at least 35 alert icons, got ${catalogEntries.length}`);
  assert.match(source, /dm-beta11-alert-picker/);
  assert.match(source, /dm-beta11-alert-grid/);
  assert.match(source, /data-alert-icon/);
  assert.match(source, /input\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
  assert.doesNotMatch(source, /\bnew\s+(?:root\.)?MutationObserver\s*\(/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
});

test("alert name, value and icon never receive entity picker buttons", async () => {
  const source = await readFile(entityGuardUrl, "utf8");
  assert.match(source, /id\.startsWith\("ed-avv-"\)\) return id === "ed-avv-ent"/);
  assert.match(source, /ALERT_NON_ENTITY_IDS = new Set\(\["ed-avv-name", "ed-avv-val", "ed-avv-icon"\]\)/);
  assert.match(source, /cleanupFalseAlertPicker\(input\)/);
  assert.doesNotMatch(source, /\|avv-\)/);
});