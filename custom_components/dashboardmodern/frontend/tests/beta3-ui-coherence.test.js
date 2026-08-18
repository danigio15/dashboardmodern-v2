// DM-FIX-20260813D
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("EV appearance is strictly scoped to the EV editor and is not prepended globally", async () => {
  const source = await read("src/sections/personalization-section.js");
  assert.match(source, /if \(activeTab !== "sez2"\)/);
  assert.match(source, /querySelectorAll\("\[data-ev-appearance\]"\).*remove/);
  // One placement, so reopening the tab cannot give two different pages: the
  // panel is built only once the vehicle accordion exists, and goes inside it.
  assert.match(source, /evAccordionBody\(\)\.prepend\(panel\)/);
  assert.doesNotMatch(source, /body\.prepend\(panel\)/);
  assert.doesNotMatch(source, /visibleEvBlock/);
});

test("room and action icon previews are the picker buttons and palette buttons are hidden", async () => {
  const source = await read("src/sections/personalization-section.js");
  assert.match(source, /preview\.addEventListener\("click", open\)/);
  assert.match(source, /openVisualPicker\(input, "room"\)/);
  assert.match(source, /openVisualPicker\(input, "action"\)/);
  assert.match(source, /\.dm-visual-pick-btn\{display:none!important\}/);
  assert.match(source, /dm-icon-preview-button/);
});

test("action and room picking delegates to the canonical icon engine", async () => {
  const catalog = await read("src/core/personalization-catalog.js");
  const source = await read("src/sections/personalization-section.js");
  const engine = await read("src/sections/icon-engine-section.js");
  assert.match(catalog, /export function actionVisual/);
  assert.match(catalog, /"mdi:lightbulb",\s*"💡"/);
  assert.match(source, /DashboardModernIconEngine\?\.openPicker/);
  assert.doesNotMatch(source, /modal\.id\s*=\s*"dm-visual-picker"/);
  assert.match(engine, /ACTION_ICON_CATALOG/);
  assert.match(engine, /iconGlyphMarkup\("action", item\.mdi, \{ size: 36 \}\)/);
  assert.match(catalog, /const fontSize = initials\.length/);
});

test("section rename is inline with navbar order and updates editor tab labels", async () => {
  const source = await read("src/sections/personalization-section.js");
  assert.match(source, /ordine navbar\|navbar order/i);
  assert.match(source, /button\.className = "dm-inline-rename"/);
  assert.match(source, /EDITOR_TABS_FOR_SECTION/);
  assert.match(source, /\.ed-tab\[data-tab=/);
});

test("climate cards are capped on mobile and server rows expose their configured values", async () => {
  const personal = await read("src/sections/personalization-section.js");
  const polish = await read("src/sections/editor-polish-section.js");
  assert.match(personal, /aspect-ratio:auto!important/);
  assert.match(polish, /dm-server-copy/);
  assert.match(polish, /dm-server-entity-row/);
});

test("energy history retries compatible Recorder payload and can fall back to legacy chart", async () => {
  const service = await read("src/core/period-service.js");
  const report = await read("src/sections/energy-report-polish-section.js");
  assert.match(service, /delete compatiblePayload\.units/);
  assert.match(report, /state\.legacyDailyChart/);
  assert.match(report, /dmHistoryFallback = "legacy-compatible"/);
});