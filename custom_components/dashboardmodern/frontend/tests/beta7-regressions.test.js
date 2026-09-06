import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const entryUrl = new URL("../src/sections/beta-entry-section.js", import.meta.url);
const catalogUrl = new URL("../src/core/personalization-catalog.js", import.meta.url);
const engineUrl = new URL("../src/sections/icon-engine-section.js", import.meta.url);
const flowsUrl = new URL("../src/sections/energy-flow-section.js", import.meta.url);

test("the two beta7 passes are gone from the entry point", async () => {
  const source = await readFile(entryUrl, "utf8");
  assert.doesNotMatch(source, /beta7-review-fixes-section/);
  /* La passata delle regressioni delegava o duplicava, e la forma delle righe
   * azione — la sola cosa che era davvero sua — sta nel motore delle icone.
   * La guardia del marchio proteggeva un `<img>` che il catalogo non stampa
   * piu': il logo e' una maschera CSS su uno `<span>`. */
  assert.doesNotMatch(source, /beta7-regression-section|beta7-brand-guard-section/);
  for (const nome of ["beta7-regression-section.js", "beta7-brand-guard-section.js"]) {
    await assert.rejects(access(new URL(`../src/sections/${nome}`, import.meta.url)));
  }
});

test("the car brand is a masked span from the local catalog, so no image can break", async () => {
  const catalog = await readFile(catalogUrl, "utf8");
  /* La guardia esisteva per un `<img>` remoto che poteva non arrivare. Adesso
   * la forma la porta un file locale usato come maschera e il colore lo mette
   * la plancia: non c'e' nessun `<img>` da sorvegliare, e infatti nessun
   * modulo ne stampa uno — le prove a video pretendono che siano zero
   * (beta2-persistence-ev-flow.spec.js:166, beta5-root-causes.spec.js:239). */
  assert.match(catalog, /data-dm-brand-image="\$\{item\.id\}"/);
  assert.match(catalog, /mask-image:url\('\$\{source\}'\)/);
  assert.match(catalog, /dashboardmodern_static\/brands\//);
  assert.doesNotMatch(catalog, /https?:\/\//);
  const engine = await readFile(engineUrl, "utf8");
  assert.doesNotMatch(engine, /dm-beta7-brand-guard-fallback|dm-beta7-brand-fallback/);
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

test("the action row keeps its readable name in column two", async () => {
  const source = await readFile(engineUrl, "utf8");
  assert.match(source, /dm-beta7-action-row>\.ed-row-main/);
  assert.match(source, /grid-column:2!important/);
  assert.match(source, /width:auto!important/);
  assert.match(source, /justify-self:stretch!important/);
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
