import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalogUrl = new URL("../src/core/personalization-catalog.js", import.meta.url);
const personalizationUrl = new URL("../src/sections/personalization-section.js", import.meta.url);
const iconEngineUrl = new URL("../src/sections/icon-engine-section.js", import.meta.url);
const flowUrl = new URL("../src/sections/energy-flow-section.js", import.meta.url);
const energyUrl = new URL("../src/sections/energy-section.js", import.meta.url);
const reportUrl = new URL("../src/sections/energy-report-polish-section.js", import.meta.url);
const editorUrl = new URL("../src/sections/editor-polish-section.js", import.meta.url);
const temperatureUrl = new URL("../src/sections/temperature-section.js", import.meta.url);
const shutterUrl = new URL("../src/sections/shutter-section.js", import.meta.url);
const guardUrl = new URL("../src/sections/beta7-brand-guard-section.js", import.meta.url);

test("quick actions use canonical colour glyphs and only the single-owner icon picker", async () => {
  const [catalog, guard, personalization, engine] = await Promise.all([
    readFile(catalogUrl, "utf8"),
    readFile(guardUrl, "utf8"),
    readFile(personalizationUrl, "utf8"),
    readFile(iconEngineUrl, "utf8"),
  ]);
  assert.match(catalog, /export const ACTION_ICON_CATALOG/);
  assert.match(catalog, /"mdi:lightbulb",\s*"💡"/);
  assert.match(catalog, /class=\"dm-action-glyph\"/);
  assert.match(engine, /modal\.id = "dm-visual-picker"/);
  assert.match(engine, /event\.stopImmediatePropagation\(\)/);
  assert.match(engine, /openIconPicker\(activation\.input, activation\.kind/);
  assert.match(engine, /dm-beta9-action-picker/);
  assert.doesNotMatch(guard, /openStableActionPicker|modal\.id = "dm-beta9-action-picker"/);
  assert.doesNotMatch(guard, /ACTION_ICON_CATALOG|actionVisual/);
  /* La geometria del tasto delle azioni rapide ha cambiato padrone: adesso la
   * scrive chi le mette dentro il ripiano, e la guardia del marchio non deve
   * piu' dire la sua — erano due a scrivere la stessa misura col peso massimo,
   * e vinceva l'ordine di caricamento. */
  assert.doesNotMatch(guard, /#qa-grid \.qa-btn\{/);
  const vassoio = await readFile(
    new URL("../src/sections/azioni-rapide-vassoio-section.js", import.meta.url),
    "utf8",
  );
  assert.match(vassoio, /html body #page-home \.dm-vassoio #qa-grid \.qa-btn\{/);
  /* Il titolo delle Azioni rapide ha un proprietario solo: il guscio.
   *
   * Qui si pretendeva il contrario — che fosse questo modulo a riscriverlo a
   * meta' avvio — e cosi' la stessa parola l'avevano in due: il guscio diceva
   * «Azioni Rapide Premium», mezzo secondo dopo il modulo la cambiava, e chi
   * guardava lo schermo li vedeva tutti e due. */
  assert.doesNotMatch(personalization, /normalizeQuickActionsTitle/);
  for (const variante of ["dashboard.html", "dashboard-en.html"]) {
    const guscio = await readFile(new URL(`../legacy/${variante}`, import.meta.url), "utf8");
    assert.doesNotMatch(guscio, /Premium\s+Quick\s+Actions/i, variante);
    assert.doesNotMatch(guscio, /Azioni\s+Rapide\s+Premium/i, variante);
  }
});

test("valued energy connectors are revived, animated and restore legacy visibility when idle", async () => {
  const source = await readFile(flowUrl, "utf8");
  assert.match(source, /function rememberConnectorVisibility/);
  assert.match(source, /dmFlowWasHidden/);
  assert.match(source, /function restoreConnectorVisibility/);
  assert.match(source, /node\.hidden = node\.dataset\.dmFlowWasHidden === "true"/);
  // Same write, now through the helper that skips a property already holding
  // that value — the stage rewrote a dozen of them per line on every pass.
  assert.match(source, /setStyleProperty\(node, "display", "inline", "important"\)/);
  assert.match(source, /const active = displayedActive === null \? legacyActive : displayedActive/);
  assert.doesNotMatch(source, /active && nodeVisible\(line\)/);
  assert.doesNotMatch(source, /removeAttribute\?\.\("hidden"\)/);
  assert.match(source, /animation-name:dmEnergyFlowDash!important/);
  assert.match(source, /animation-duration:\.8s!important/);
  assert.match(source, /animation-timing-function:linear!important/);
  assert.match(source, /animation-iteration-count:infinite!important/);
  assert.match(source, /animation-play-state:running!important/);
});

test("financial overview and canonical Energy owner keep sold income separate from real cost", async () => {
  const [report, energy] = await Promise.all([readFile(reportUrl, "utf8"), readFile(energyUrl, "utf8")]);
  assert.match(report, /root\.cdCfg\?\.\(key\)/);
  assert.match(report, /rateValue\("cd_costo_kwh"\)/);
  assert.match(report, /rateValue\("cd_prezzo_immissione"\)/);
  assert.match(report, /const realCost = importCost/);
  assert.doesNotMatch(report, /realCost\s*=\s*Math\.max\(0,\s*importCost\s*-\s*exportIncome/);
  assert.match(report, /__dmCanonicalEnergyRates/);
  assert.match(energy, /const realCost = importCost/);
  assert.match(energy, /saved: Math\.max\(0, withoutSolar - importCost\)/);
  assert.doesNotMatch(energy, /importCost - exportIncome/);
});

test("lights and load configuration have explicit readable layouts", async () => {
  const source = await readFile(editorUrl, "utf8");
  assert.match(source, /grid-template-areas:"order main room edit delete"/);
  assert.match(source, /dm-light-entity-id/);
  assert.match(source, /function polishLoadsEditor/);
  assert.match(source, /data-load-group="energy-primary"/);
  assert.match(source, /MISURE ENERGETICHE/);
  assert.match(source, /STATO E CONTROLLO/);
});

test("room icons, live navbar names and brand-specific electrified models are canonical", async () => {
  const source = await readFile(personalizationUrl, "utf8");
  assert.match(source, /function decorateRoomEditorRows/);
  assert.match(source, /dm-room-list-icon/);
  assert.match(source, /if \(label\) label\.textContent = clean\(room\.name\)/);
  assert.match(source, /const currentNames = sectionNames\(\)/);
  assert.match(source, /const persisted = clean\(currentNames\[key\]/);
  assert.match(source, /const CAR_MODELS = Object\.freeze/);
  assert.match(source, /"Leapmotor": \["T03", "B10", "C10", "C10 REEV"\]/);
  assert.match(source, /function modelBelongsToBrand/);
  assert.match(source, /const explicit = clean\(vehicle\.brand\)/);
  assert.match(source, /return explicit \|\| brandForModel/);
  assert.match(source, /const liveBrand = clean/);
  assert.match(source, /modelBelongsToBrand\(liveBrand, liveModel\)/);
  assert.doesNotMatch(source, /liveBrand = brandForModel\(liveModel\)/);
  assert.doesNotMatch(source, /data-car-icon/);
});

test("Leapmotor uses a local emblem rather than a remote wordmark", async () => {
  const source = await readFile(catalogUrl, "utf8");
  assert.match(source, /function leapmotorVisual/);
  assert.match(source, /dm-leapmotor-mark/);
  assert.match(source, /if \(item\.id === "leapmotor"\) return leapmotorVisual/);
  assert.doesNotMatch(source, /cdn\.simpleicons\.org\/leapmotor/);
});

test("temperature edit can move sensors and cancel clears reassignment state", async () => {
  const source = await readFile(temperatureUrl, "utf8");
  assert.match(source, /function bindTemperatureRoomReassignment/);
  assert.match(source, /function resetTemperatureReassignment/);
  assert.match(source, /select\.disabled = false/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
  assert.match(source, /if \(id === originalId && originalId !== targetId\) return \{ \.\.\.room, temp: "", hum: "" \}/);
  assert.match(source, /if \(id === targetId\) return \{ \.\.\.room, temp, hum \}/);
  assert.match(source, /\[data-temperature-cancel\]/);
  assert.match(source, /resetTemperatureReassignment\(cancel\.closest/);
});

test("shutters use one stable first-paint geometry without wrapping the legacy renderer", async () => {
  const source = await readFile(shutterUrl, "utf8");
  assert.match(source, /First paint is already the final Beta9 geometry/);
  assert.match(source, /#tapp-grid\{display:grid!important;grid-template-columns:repeat\(auto-fit,minmax\(280px,360px\)\)!important/);
  assert.match(source, /\.tapp-card\{box-sizing:border-box!important;width:100%!important;max-width:360px!important/);
  assert.match(source, /\.tapp-win\{box-sizing:border-box!important;height:132px!important;min-height:132px!important;max-height:132px!important/);
  assert.match(source, /\.tapp-shutter\{animation:none!important;filter:none!important;transition:height \.55s/);
  assert.doesNotMatch(source, /function polishShutterPage/);
  assert.doesNotMatch(source, /function installShutterWrapper/);
  assert.doesNotMatch(source, /__dmBeta9ShutterPagePolish/);
  assert.doesNotMatch(source, /wrapFunction\([^\n]*renderTapparelle/);
});