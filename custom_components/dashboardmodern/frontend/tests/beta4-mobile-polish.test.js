import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("final mobile owner loads before the canonical icon engine handles room activation", async () => {
  const entry = await read("src/sections/bootstrap-section.js");
  const engine = await read("src/sections/icon-engine-section.js");
  assert.match(entry, /editor-refinement-section\.js";\nimport "\.\/beta4-mobile-polish-section\.js";/);
  assert.match(entry, /import "\.\/icon-engine-section\.js"/);
  assert.match(engine, /\.dm-beta5-room-icon-trigger/);
  assert.match(engine, /openIconPicker\(activation\.input, activation\.kind/);
  assert.match(engine, /event\.stopImmediatePropagation\(\)/);
  assert.doesNotMatch(entry, /globalThis\.dmIconPicker\("#ed-room-icon", "rooms"\)/);
  assert.doesNotMatch(entry, /dm-beta4-room-icon-trigger/);
});

test("section rename keeps exactly one button inside its canonical row owner", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  assert.match(source, /buttons\.forEach\(\(button\) => \{\s*if \(button !== primary\) button\.remove\(\)/s);
  assert.match(source, /primary\.dataset\.dmBeta5Primary = "true"/);
  assert.doesNotMatch(source, /button\.parentElement !== row\) row\.append\(button\)/);
  assert.match(source, /dm-inline-rename\[data-rename\]:not\(\[data-dm-beta5-primary/);
});

test("config tab names preserve their dedicated icon nodes", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  assert.match(source, /labelNode\.dataset\.dmConfigName = "true"/);
  assert.match(source, /dm-beta4-tab-icon/);
  assert.match(source, /iconNode\.textContent = icon/);
});

test("room first insert uses its icon as the only visible picker trigger", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  const engine = await read("src/sections/icon-engine-section.js");
  assert.match(source, /trigger\.removeAttribute\("onclick"\)/);
  assert.match(source, /trigger\.className = "dm-beta5-room-icon-trigger"/);
  assert.match(source, /#ed-room-icon-preview\{display:none!important\}/);
  assert.match(engine, /\.dm-beta5-room-icon-trigger/);
  assert.match(engine, /kind: "room"/);
  assert.doesNotMatch(source, /dmIconPicker\("#ed-room-icon", "rooms"\)/);
});

test("alerts hide custom-only controls and physically remove the orphan flash", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  assert.match(source, /const visible = clean\(group\.value\) === "custom"/);
  assert.match(source, /custom\.hidden = !visible/);
  assert.match(source, /removeAlertFlash\(form, visible\)/);
  assert.match(source, /text === "⚡" \|\| powerGlyph/);
  assert.match(source, /dm-beta5-alert-entity-row/);
  assert.match(source, /grid-template-columns:minmax\(0,1fr\) 52px/);
});

test("lights have one explicit compact mobile grid with visible name and entity", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  assert.match(source, /grid-template-areas:"main edit delete" "room room room"/);
  assert.match(source, /data-dm-light-main/);
  assert.match(source, />\.ed-row-new\{display:block!important/s);
  assert.match(source, />\.ed-row-old\{display:block!important/s);
  assert.match(source, /\.dm-light-order\{display:none!important\}/);
});

test("brand picker renders local vector brand graphics instead of initial badges", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  assert.match(source, /const BRAND_LOGOS/);
  assert.match(source, /leapmotor:/);
  assert.match(source, /audi:/);
  assert.match(source, /volkswagen:/);
  assert.match(source, /data-brand-logo/);
  assert.match(source, /dm-beta5-brand-logo/);
  assert.doesNotMatch(source, /BRAND_SIGNS|dm-beta4-brand-symbol/);
});

test("daily Energy chart is real-only, stops at today and never calls the synthetic legacy renderer", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  const legacy = await read("legacy/dashboard-runtime-it.js");
  assert.match(source, /async function renderRealDailyChart/);
  assert.match(source, /statisticsWithGrowth\(ids, start\.toISOString\(\), end\.toISOString\(\), "day"\)/);
  assert.match(source, /visibleDays = currentMonth \? Math\.min\(now\.getDate\(\), monthDays\) : monthDays/);
  assert.match(source, /currentBundleDay\(\)/);
  assert.match(source, /balancedHouse\(values, index, refs\)/);
  assert.match(source, /reportState\.legacyDailyChart = null/);
  assert.match(source, /renderRealDailyChart\.__dmBeta5RealOnly = true/);
  assert.doesNotMatch(source, /legacy\(\.\.\.args\)|Math\.sin|Math\.cos/);
  assert.match(legacy, /if \(!fetchOk && prodMese > 0\)/);
});

test("day and month Energy maps keep every secondary load node and connector visible", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  const entry = await read("src/sections/bootstrap-section.js");
  assert.match(source, /wb: \{ day: "dm\.ev_energia_wallbox_oggi", month: "dm\.ev_energia_wallbox_mese" \}/);
  assert.match(source, /for \(const period of \["day", "month"\]\)/);
  assert.match(source, /node\.style\.display = ""/);
  assert.match(source, /node\.dataset\.dmBeta5FlowComplete = "true"/);
  assert.match(entry, /line-home-\$\{load\}-\$\{period\}/);
  assert.match(entry, /display:block!important/);
});

test("climate cards have two-column natural compact geometry on mobile", async () => {
  const source = await read("src/sections/beta4-mobile-polish-section.js");
  assert.match(source, /data-dm-beta5-climate/);
  assert.match(
    source,
    /\.clima-premium-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important;gap:8px!important\}/,
  );
  assert.match(source, /\.cp-card\{min-height:0!important;height:auto!important;max-height:none!important/);
  assert.match(source, /\.cp-body\{display:grid!important;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(source, /\.cp-controls\{min-height:52px!important;height:52px!important/);
});