import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const entryUrl = new URL("../src/sections/beta-entry-section.js", import.meta.url);
const guardUrl = new URL("../src/sections/beta7-brand-guard-section.js", import.meta.url);
const regressionsUrl = new URL("../src/sections/beta7-regression-section.js", import.meta.url);
const reviewFixesUrl = new URL("../src/sections/beta7-review-fixes-section.js", import.meta.url);
const flowsUrl = new URL("../src/sections/energy-flow-section.js", import.meta.url);

test("beta7 entry loads guards and review follow-ups in ownership order", async () => {
  const source = await readFile(entryUrl, "utf8");
  const guard = source.indexOf('import "./beta7-brand-guard-section.js"');
  const polish = source.indexOf('import "./beta7-regression-section.js"');
  const review = source.indexOf('import "./beta7-review-fixes-section.js"');
  assert.ok(guard >= 0);
  assert.ok(polish > guard);
  assert.ok(review > polish);
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

test("beta7 final polish owns quick actions, climate and stable shutters", async () => {
  const source = await readFile(regressionsUrl, "utf8");
  assert.match(source, /polishQuickActionCards/);
  assert.match(source, /dm-beta7-existing-action-icon/);
  assert.match(source, /dm-beta7-action-form-row/);
  assert.match(source, /aspect-ratio:auto/);
  assert.match(source, /dmBeta7ShutterRoll/);
  assert.match(source, /__dmBeta7StableShutters/);
  assert.doesNotMatch(source, /MutationObserver|setInterval\s*\(/);
});

test("review follow-ups keep action text in column two and rerender shutter config changes", async () => {
  const source = await readFile(reviewFixesUrl, "utf8");
  assert.match(source, /dm-beta7-action-main/);
  assert.match(source, /grid-column:2!important/);
  assert.match(source, /dm-beta7-legacy-action-icon/);
  assert.match(source, /currentShutterConfigSignature/);
  assert.match(source, /JSON\.stringify\(Array\.isArray\(list\) \? list : \[\]\)/);
  assert.match(source, /regression\.shutterSignature = ""/);
});

test("period energy main connectors use direction-specific displayed values", async () => {
  const source = await readFile(flowsUrl, "utf8");
  assert.match(source, /function parseNumber/);
  assert.match(source, /function periodDirectionalValue/);
  assert.match(source, /id\.includes\("solar-grid"\) \? "export" : "import"/);
  assert.match(source, /id\.includes\("solar-battery"\) \? "charge" : "discharge"/);
  assert.match(source, /displayedActive === null \? legacyActive : displayedActive/);
  assert.doesNotMatch(source, /displayedActive \|\| legacyActive/);
  assert.match(source, /animation:dmEnergyFlowDash \.8s linear infinite/);
});
