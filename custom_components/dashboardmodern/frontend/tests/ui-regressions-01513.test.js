import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("appliance fix changes layout but not the artwork owner", async () => {
  const layout = await read("src/sections/appliance-layout-section.js");
  const appliances = await read("src/sections/appliances-section.js");
  assert.match(layout, /grid-template-columns:102px minmax\(0,1fr\)/);
  assert.match(layout, /dm-appliance-image/);
  assert.doesNotMatch(layout, /resolveApplianceArtwork|applianceArtworkCandidates/);
  assert.match(appliances, /applianceArtworkCandidates/);
});

test("energy editor restores section visibility, readable guidance and entity search", async () => {
  const source = await read("src/sections/editor-contracts-section.js");
  assert.match(source, /normalizeEnergyVisibility/);
  assert.match(source, /data\.dmEnergyVisibility/);
  assert.match(source, /edSecTog/);
  assert.match(source, /normalizeEnergyHelp/);
  assert.match(source, /Current period|Periodo corrente/);
  assert.match(source, /hasEntityPicker/);
  assert.match(source, /dm-contract-entity-picker/);
  assert.match(source, /Cerca entità|Search entity/);
  assert.doesNotMatch(source, /MutationObserver/);
});

test("EV selector is content-sized instead of an 82vw mobile card", async () => {
  const source = await read("src/sections/ev-section.js");
  assert.match(source, /width:max-content/);
  assert.match(source, /flex:0 0 auto/);
  assert.match(source, /max-width:76vw/);
  assert.doesNotMatch(source, /flex:0 0 min\(82vw,300px\)/);
});

test("shutter alert uses a centered modal on mobile", async () => {
  const source = await read("src/sections/shutter-section.js");
  assert.match(source, /\.dm-shutter-popup\{display:flex!important;align-items:center!important;justify-content:center/);
  assert.match(source, /@media\(max-width:640px\)/);
  assert.doesNotMatch(source, /align-items:end!important/);
  assert.doesNotMatch(source, /border-radius:22px 22px 0 0/);
});

test("navigation has exactly one canonical source owner with dark-mode contrast", async () => {
  const runtime = await read("src/sections/section-runtime.js");
  const navigation = await read("src/sections/navigation-section.js");
  const imports = runtime.match(/navigation-section\.js/g) || [];
  const installs = runtime.match(/installNavigationSection\(\)/g) || [];
  const registrations = runtime.match(/"navigation"/g) || [];
  assert.equal(imports.length, 1);
  assert.equal(installs.length, 1);
  assert.equal(registrations.length, 1);
  assert.match(navigation, /bottom-nav-bar/);
  assert.match(navigation, /#cbd5e1/);
  assert.match(navigation, /tab\.active/);
  assert.doesNotMatch(navigation, /setInterval|MutationObserver/);
});

test("temperature visuals stay in the existing temperature layout owner", async () => {
  const runtime = await read("src/sections/section-runtime.js");
  const source = await read("src/sections/temperature-layout-section.js");
  assert.equal((runtime.match(/temperature-layout-section\.js/g) || []).length, 1);
  assert.match(source, /linear-gradient\(145deg/);
  assert.match(source, /font-size:17px!important/);
  assert.match(source, /font-size:39px!important/);
});
