import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("beta6 feedback layer loads after the beta5 root-cause owner", async () => {
  const entry = await read("src/sections/beta-entry-section.js");
  assert.match(entry, /beta4-mobile-polish-section\.js";\nimport "\.\/beta6-feedback-section\.js";/);
});

test("quick action editor replaces the flash field with a real icon trigger", async () => {
  const source = await read("src/sections/beta6-feedback-section.js");
  assert.match(source, /lights: "mdi:lightbulb-group"/);
  assert.match(source, /input\.insertAdjacentElement\("afterend", preview\)/);
  assert.match(source, /dm-beta6-qa-icon-trigger/);
  assert.match(source, /#ed-qa-icon\.dm-beta6-qa-icon-value\{display:none!important\}/);
  assert.match(source, /openActionPicker\(input, preview\)/);
  assert.match(source, /ACTION_ICON_CATALOG/);
});

test("car brand picker uses real pinned brand images and the official Leapmotor wordmark", async () => {
  const source = await read("src/sections/beta6-feedback-section.js");
  assert.match(source, /SIMPLE_ICONS_VERSION = "16\.27\.1"/);
  assert.match(source, /simple-icons@\$\{SIMPLE_ICONS_VERSION\}\/icons\/\$\{slug\}\.svg/);
  assert.match(source, /upload\.wikimedia\.org\/wikipedia\/commons\/d\/d8\/Leapmotor_logo_en\.svg/);
  assert.match(source, /img\[data-dm-beta6-brand-image\]/);
  assert.match(source, /mark\.innerHTML = fallback/);
});

test("daily chart polish changes presentation only and stays inside the mobile card", async () => {
  const source = await read("src/sections/beta6-feedback-section.js");
  assert.match(source, /const chart = root\.__DASHBOARDMODERN_BETA5_ROOT_CAUSES__\?\.dailyChart/);
  assert.match(source, /consumption[\s\S]*fill: false/);
  assert.match(source, /maxTicksLimit: mobile \? 6 : 10/);
  assert.match(source, /#ed-daily-chart \.ed-chart-wrap\{[\s\S]*overflow:hidden!important/);
  assert.match(source, /height:252px!important;min-height:252px!important;max-height:252px!important/);
  assert.doesNotMatch(source, /Math\.random|Math\.sin|Math\.cos/);
});

test("Lights popup exposes dimmer and RGB controls only from HA capabilities", async () => {
  const source = await read("src/sections/beta6-feedback-section.js");
  assert.match(source, /supported_color_modes/);
  assert.match(source, /BRIGHTNESS_MODES/);
  assert.match(source, /RGB_MODES/);
  assert.match(source, /brightness_pct: Number\(slider\.value\)/);
  assert.match(source, /rgb_color: hexToRgb\(event\.target\.value\)/);
  assert.match(source, /cdCallServiceJson\("light", "turn_on"/);
  assert.match(source, /wz-lights-list/);
  assert.match(source, /Dimmer e colori/);
});
