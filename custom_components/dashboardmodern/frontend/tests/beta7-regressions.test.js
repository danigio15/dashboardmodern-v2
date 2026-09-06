import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const entryUrl = new URL("../src/sections/beta-entry-section.js", import.meta.url);
const guardUrl = new URL("../src/sections/beta7-brand-guard-section.js", import.meta.url);
const engineUrl = new URL("../src/sections/icon-engine-section.js", import.meta.url);
const flowsUrl = new URL("../src/sections/energy-flow-section.js", import.meta.url);

test("beta7 entry keeps the one scoped owner that is left", async () => {
  const source = await readFile(entryUrl, "utf8");
  assert.ok(source.indexOf('import "./beta7-brand-guard-section.js"') >= 0);
  assert.doesNotMatch(source, /beta7-review-fixes-section/);
  /* La seconda passata beta7 se n'e' andata: il ripiego del marchio lo faceva
   * gia' la guardia qui accanto (che marca ogni immagine con
   * `dmBeta7Repaired`, cioe' proprio la bandierina su cui la passata si
   * fermava), le icone erano del motore, e la forma delle righe azione — la
   * sola cosa che era davvero sua — sta adesso nel motore. */
  assert.doesNotMatch(source, /beta7-regression-section/);
  await assert.rejects(
    access(new URL("../src/sections/beta7-regression-section.js", import.meta.url)),
  );
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

test("the icon engine owns the Actions tab rows and their form row", async () => {
  const source = await readFile(engineUrl, "utf8");
  assert.match(source, /dm-beta7-existing-action-icon/);
  assert.match(source, /row\.classList\.add\("dm-beta7-action-row"\)/);
  assert.match(source, /row\.classList\.add\("dm-beta7-action-form-row"\)/);
  /* Il Clima e la Tapparella non li skinna piu' nessun rattoppo: la pagina
   * Clima e' tutta di climate-thermal-section e la finestra e' di
   * shutter-section, che ne dichiara la geometria in un posto solo. */
  assert.doesNotMatch(source, /#page-clima[^\n]*\.cp-/);
  assert.doesNotMatch(source, /#page-tapparelle[^\n]*\.tapp-(?:win|shutter|glass)/);
  assert.doesNotMatch(source, /dmBeta7ShutterRoll|__dmBeta7StableShutters/);
  assert.doesNotMatch(source, /MutationObserver|setInterval\s*\(/);
});

test("shutter repaints are the scene owner's alone", async () => {
  /* La guardia che saltava il ridisegno quando la firma non cambiava avvolgeva
   * `renderTapparelle`, che pero' shutter-scene-section RIMPIAZZA: la sua
   * firma strutturale e' l'unica che decide se ridisegnare. */
  const scene = await readFile(
    new URL("../src/sections/shutter-scene-section.js", import.meta.url),
    "utf8",
  );
  assert.match(scene, /root\.renderTapparelle = owned;/);
  assert.match(scene, /function installRenderOwner/);
});

test("existing guard keeps action text in column two", async () => {
  const source = await readFile(guardUrl, "utf8");
  assert.match(source, /dm-beta7-action-row>\.ed-row-main/);
  assert.match(source, /grid-column:2!important/);
  assert.match(source, /width:auto!important/);
  assert.match(source, /justify-self:stretch!important/);
  /* L'aggancio su `edTappAdd` esisteva solo per azzerare la firma delle
   * tapparelle dentro il modulo delle regressioni: senza quel modulo era un
   * involucro che non faceva niente. */
  assert.doesNotMatch(source, /__dmBeta7ShutterConfigOwner|shutterSignature/);
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
  const source = await readFile(engineUrl, "utf8");
  assert.match(source, /node\.closest\?\.\("\.ed-row-main"\)/);
});
