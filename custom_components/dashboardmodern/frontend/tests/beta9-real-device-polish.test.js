import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const entryUrl = new URL("../src/sections/beta-entry-section.js", import.meta.url);
const polishUrl = new URL("../src/sections/beta9-real-device-polish-section.js", import.meta.url);
const engineUrl = new URL("../src/sections/icon-engine-section.js", import.meta.url);

test("beta9 real-device polish loads after the older beta7 compatibility layers", async () => {
  const entry = await readFile(entryUrl, "utf8");
  const regression = entry.indexOf('import "./beta7-regression-section.js"');
  const finalPolish = entry.indexOf('import "./beta9-real-device-polish-section.js"');
  assert.ok(regression >= 0);
  assert.ok(finalPolish > regression);
});

test("quick-action icons are delegated to the single-owner engine without beta9 repaint", async () => {
  const [source, engine] = await Promise.all([
    readFile(polishUrl, "utf8"),
    readFile(engineUrl, "utf8"),
  ]);
  assert.match(source, /DashboardModernIconEngine\?\.syncQuickActions\?\.\(\)/);
  assert.match(source, /#dm-visual-picker\[data-kind="action"\]\[data-dm-icon-engine="single-owner"\]/);
  assert.doesNotMatch(source, /icon\.innerHTML\s*=.*dm-v01525-action-glyph/);
  assert.doesNotMatch(source, /visual\.innerHTML\s*=.*dm-v01525-picker-glyph/);
  assert.match(engine, /renderIconGlyph\(target, "action", token, \{ size: 42 \}\)/);
  assert.match(engine, /target\.dataset\.dmActionStyle = "icon-engine"/);
  assert.match(engine, /event\.stopImmediatePropagation\(\)/);
});

test("EV brand dropdown owns logo preview and model options, and not its place", async () => {
  const source = await readFile(polishUrl, "utf8");
  // Where the panel goes belongs to the module that builds it — inside the
  // vehicle's own section. This one used to prepend it to the tab on every
  // pass, and the tab flickered between the two placements.
  assert.doesNotMatch(source, /body\.prepend\(panel\)/);
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
  assert.match(source, /DashboardModernIconEngine\?\.render\?\.\(visual, "room", token, \{ size: 31 \}\)/);
  assert.doesNotMatch(source, /visual\.innerHTML = roomMarkup\(room, 34\);\s*visual\.dataset\.roomIcon/);
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
  // Every animation acts out its own alert, and it animates the glyph rather
  // than the disc the glyph sits in.
  assert.match(source, /\.dm-alert-door \.dm-alert-glyph/);
  assert.match(source, /transform-origin:left center!important;animation:dmAlertDoor/);
  assert.match(source, /@keyframes dmAlertDoor\{[\s\S]*rotateY\(-64deg\)/);
  assert.match(source, /@keyframes dmAlertBattery\{[\s\S]*clip-path:inset\(56% 0 0 0\)/);
  assert.doesNotMatch(source, /dmAlertOpening/);
  for (const kind of ["window", "leak", "flame", "motion", "temperature", "power", "light", "security"]) {
    assert.match(source, new RegExp(`\\.dm-alert-${kind} \\.dm-alert-glyph`));
  }
});

test("add-light layout cannot collapse its entity field", async () => {
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /dm-light-add-entity-row/);
  assert.match(source, /grid-template-columns:minmax\(0,1fr\) 58px!important/);
  assert.match(source, /#luce-add-ent/);
  assert.match(source, /setProperty\("position", "static", "important"\)/);
});