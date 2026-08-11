import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const entryUrl = new URL("../src/sections/beta-entry-section.js", import.meta.url);
const polishUrl = new URL("../src/sections/beta9-real-device-polish-section.js", import.meta.url);

test("beta9 real-device polish loads after the older beta7 compatibility layers", async () => {
  const entry = await readFile(entryUrl, "utf8");
  const regression = entry.indexOf('import "./beta7-regression-section.js"');
  const finalPolish = entry.indexOf('import "./beta9-real-device-polish-section.js"');
  assert.ok(regression >= 0);
  assert.ok(finalPolish > regression);
});

test("quick actions restore the v0.15.25 colorful glyph contract", async () => {
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /luci: \{ glyph: "💡", color: "#f59e0b" \}/);
  assert.match(source, /clima: \{ glyph: "❄️", color: "#0ea5e9" \}/);
  assert.match(source, /antifurto: \{ glyph: "🛡️", color: "#7c3aed" \}/);
  assert.match(source, /lavatrice: \{ glyph: "🧺", color: "#0ea5e9" \}/);
  assert.match(source, /dm-v01525-action-glyph/);
  assert.match(source, /drop-shadow\(0 6px 12px/);
  assert.match(source, /azioni\\s\+rapide\\s\+premium/);
});

test("EV brand dropdown owns logo preview and model options and stays at the top", async () => {
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /body\.prepend\(panel\)/);
  assert.match(source, /brandSelect\.addEventListener\("input", syncBrand\)/);
  assert.match(source, /brandSelect\.addEventListener\("change", syncBrand\)/);
  assert.match(source, /modelSelect\.innerHTML = modelOptions\(brand, keep\)/);
  assert.match(source, /"Leapmotor": \["T03", "B10", "C10", "C10 REEV"\]/);
  assert.match(source, /"MINI": \["Cooper Electric", "Aceman", "Countryman Electric"\]/);
  assert.match(source, /filter:grayscale\(1\) brightness\(0\)!important/);
  assert.match(source, /dm-v10-brand-wordmark/);
});

test("room and temperature editors are repaired without a global observer", async () => {
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /dm-room-config-row/);
  assert.match(source, /visual\.innerHTML = roomMarkup\(room, 34\)/);
  assert.match(source, /select\.disabled = false/);
  assert.match(source, /select\.removeAttribute\("disabled"\)/);
  assert.match(source, /pointer-events", "auto", "important"/);
  assert.doesNotMatch(source, /MutationObserver/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
});

test("shutters are compact and alert animations follow the alert kind", async () => {
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /max-width", "360px", "important"/);
  assert.match(source, /height", "132px", "important"/);
  assert.match(source, /slat\.style\.setProperty\("animation", "none", "important"\)/);
  assert.match(source, /shutterMoving\(\) \? "shutter-moving" : "static"/);
  assert.match(source, /dmAlertOpening/);
  assert.match(source, /dmAlertBattery/);
  assert.match(source, /dmAlertSecurity/);
});

test("add-light layout cannot collapse its entity field", async () => {
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /dm-light-add-entity-row/);
  assert.match(source, /grid-template-columns:minmax\(0,1fr\) 58px!important/);
  assert.match(source, /#luce-add-ent/);
  assert.match(source, /position","static","important"/);
});
