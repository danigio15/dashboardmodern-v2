import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const entryUrl = new URL("../src/sections/beta-entry-section.js", import.meta.url);
const guardUrl = new URL("../src/sections/beta7-brand-guard-section.js", import.meta.url);
const regressionsUrl = new URL("../src/sections/beta7-regression-section.js", import.meta.url);
const flowsUrl = new URL("../src/sections/energy-flow-section.js", import.meta.url);

test("beta7 entry keeps the two scoped owners in order", async () => {
  const source = await readFile(entryUrl, "utf8");
  const guard = source.indexOf('import "./beta7-brand-guard-section.js"');
  const polish = source.indexOf('import "./beta7-regression-section.js"');
  assert.ok(guard >= 0);
  assert.ok(polish > guard);
  assert.doesNotMatch(source, /beta7-review-fixes-section/);
});

test("broken remote car logos keep their image contract and get an inline fallback", async () => {
  const source = await readFile(guardUrl, "utf8");
  assert.match(source, /img\[data-dm-brand-image\]/);
  assert.match(source, /data-dm-brand-fallback/);
  assert.match(source, /dmBeta7Repaired/);
  assert.match(source, /insertAdjacentHTML\("afterend"/);
  assert.doesNotMatch(source, /MutationObserver|setInterval\s*\(/);
});

test("brand contract is claimed before load failure and after every vehicle render", async () => {
  const source = await readFile(guardUrl, "utf8");
  const claimed = source.indexOf('img.dataset.dmBeta7Repaired = "true"');
  const failedCheck = source.indexOf("img.complete && Number(img.naturalWidth) === 0");
  assert.ok(claimed >= 0);
  assert.ok(failedCheck > claimed);
  assert.match(source, /__dmBeta7BrandContractOwner/);
  assert.match(source, /function ownedVehicleSelector/);
  assert.match(source, /guardAll\(\);\n\s*return result;/);
});

test("beta7 final polish owns quick actions and climate, and no longer skins the shutters", async () => {
  const source = await readFile(regressionsUrl, "utf8");
  assert.match(source, /polishQuickActionCards/);
  assert.match(source, /dm-beta7-existing-action-icon/);
  assert.match(source, /dm-beta7-action-form-row/);
  assert.match(source, /aspect-ratio:auto/);
  // The shutter repaint guard stays; the Beta 7 window skin does not. It was
  // the only sheet declaring left/right/top on .tapp-shutter, so it detached
  // the closed panel from the opening the current skin draws.
  assert.match(source, /__dmBeta7StableShutters/);
  assert.doesNotMatch(source, /#page-tapparelle[^\n]*\.tapp-(?:win|shutter|glass)/);
  assert.doesNotMatch(source, /dmBeta7ShutterRoll/);
  assert.doesNotMatch(source, /MutationObserver|setInterval\s*\(/);
});

test("existing guard keeps action text in column two and invalidates shutter saves", async () => {
  const source = await readFile(guardUrl, "utf8");
  assert.match(source, /dm-beta7-action-row>\.ed-row-main/);
  assert.match(source, /grid-column:2!important/);
  assert.match(source, /width:auto!important/);
  assert.match(source, /justify-self:stretch!important/);
  assert.match(source, /__dmBeta7ShutterConfigOwner/);
  assert.match(source, /regression\.shutterSignature = ""/);
  assert.match(source, /root\.edTappAdd = configAwareShutterSave/);
});

test("period energy main connectors use direction-specific displayed values", async () => {
  const source = await readFile(flowsUrl, "utf8");
  assert.match(source, /function parseNumber/);
  assert.match(source, /function periodDirectionalValue/);
  assert.match(source, /id\.includes\("solar-grid"\) \? "export" : "import"/);
  assert.match(source, /id\.includes\("solar-battery"\) \? "charge" : "discharge"/);
  assert.match(source, /displayedActive === null \? legacyActive : displayedActive/);
  assert.doesNotMatch(source, /displayedActive \|\| legacyActive/);
  assert.match(source, /animation-name:dmEnergyFlowDash!important/);
  assert.match(source, /animation-duration:\.8s!important/);
  assert.match(source, /animation-timing-function:linear!important/);
  assert.match(source, /animation-iteration-count:infinite!important/);
  assert.match(source, /animation-play-state:running!important/);
});

test("configured rows keep a shrinkable label instead of a collapsed one", async () => {
  const crud = await readFile(
    new URL("../src/sections/editor-crud-section.js", import.meta.url),
    "utf8",
  );
  const rule = crud.match(/#editor-modal \.ed-row-main\{[^}]*\}/)?.[0];
  assert.ok(rule, "editor-crud owns the shared label box");
  assert.doesNotMatch(rule, /[{;]width:0!important/);
  assert.match(rule, /min-width:0!important/);
  assert.match(rule, /flex:1 1 0!important/);
});

test("the mdi cleanup never blanks the readable label of an action row", async () => {
  const source = await readFile(regressionsUrl, "utf8");
  assert.match(source, /node\.closest\?\.\("\.ed-row-main"\)/);
});
