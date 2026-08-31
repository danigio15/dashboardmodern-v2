import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("feedback layer keeps legacy quick-action defaults while the icon engine owns visual picking", async () => {
  const entry = await read("src/sections/beta-entry-section.js");
  const feedback = await read("src/sections/beta6-feedback-section.js");
  const engine = await read("src/sections/icon-engine-section.js");
  assert.match(entry, /beta4-mobile-polish-section\.js";\nimport "\.\/beta6-feedback-section\.js";/);
  assert.match(entry, /import "\.\/icon-engine-section\.js";/);
  assert.doesNotMatch(entry, /quickActionGlyphByType|dm-beta6-quick-action-layout/);
  assert.doesNotMatch(entry, /__dmV01525GlyphRepair|dmBeta7IconToken|scheduleV01525QuickActionRepair/);
  assert.match(feedback, /luci_group:\{glyph:"💡",mdi:"mdi:lightbulb-group"\}/);
  assert.match(feedback, /builtin_clima:\{glyph:"❄️",mdi:"mdi:snowflake"\}/);
  assert.match(feedback, /builtin_antifurto:\{glyph:"🛡️",mdi:"mdi:shield-home"\}/);
  assert.match(feedback, /builtin_lavatrice:\{glyph:"🧺",mdi:"mdi:washing-machine"\}/);
  assert.match(feedback, /toggle:\{glyph:"🔀",mdi:"mdi:toggle-switch-outline"\}/);
  assert.match(feedback, /script:\{glyph:"▶️",mdi:"mdi:script-text-play"\}/);
  assert.match(feedback, /scene:\{glyph:"🎬",mdi:"mdi:movie-open"\}/);
  assert.match(feedback, /DashboardModernIconEngine\?\.syncQuickActions\?\.\(\)/);
  assert.match(engine, /modal\.id = "dm-visual-picker"/);
  /* La voce scelta finisce nel campo. Di norma col nome del disegno; dove il
   * consumatore stampa la casella come testo nudo, col segno. */
  assert.match(engine, /input\.value = options\.glifo === true \? item\.glyph \|\| item\.value : item\.value/);
});

test("legacy quick-action editor delegates picker and glyph rendering to the icon engine", async () => {
  const source = await read("src/sections/beta6-feedback-section.js");
  const engine = await read("src/sections/icon-engine-section.js");
  assert.match(source, /input\.closest\?\.\("\.ed-form-row"\)/);
  assert.match(source, /input\.insertAdjacentElement\("afterend",preview\)/);
  assert.match(source, /#ed-qa-icon\.dm-beta6-qa-icon-value\{display:none!important\}/);
  assert.match(source, /grid-template-columns:minmax\(0,1fr\) 56px!important/);
  assert.match(source, /#ed-qa-name\{grid-column:1\/-1!important\}/);
  assert.match(source, /DashboardModernIconEngine\?\.markup\?\./);
  assert.match(source, /DashboardModernIconEngine\?\.openPicker\?\./);
  assert.doesNotMatch(source, /__dmBeta7QuickIcons/);
  assert.match(engine, /\.dm-beta6-qa-icon-trigger/);
  assert.match(engine, /event\.stopImmediatePropagation\(\)/);
  assert.match(engine, /openIconPicker\(activation\.input, activation\.kind/);
});

test("manufacturer art is canonical, with a local Leapmotor emblem and no post-render swapping", async () => {
  const catalog = await read("src/core/personalization-catalog.js");
  const feedback = await read("src/sections/beta6-feedback-section.js");
  /* I loghi stanno in casa, non su un CDN.
   *
   * Questa prova fissava l'indirizzo remoto — `simple-icons@…/icons/x.svg` —
   * cioe' esattamente la cosa che non andava: una plancia di Home Assistant sta
   * su una rete di casa, e molte non escono su internet. Li' i loghi non
   * arrivavano MAI, tutti quanti, e nessuno se ne accorgeva perche' un'immagine
   * che non arriva non fa rumore. Adesso i file sono dentro l'integrazione, e
   * niente in questo modulo puo' andare a prenderli fuori. */
  assert.doesNotMatch(catalog, /https?:\/\//);
  assert.match(catalog, /function cartellaLoghi/);
  assert.match(catalog, /dashboardmodern_static\/brands\//);
  assert.match(catalog, /LOGHI_IN_CASA\.includes\(item\.id\)/);
  assert.match(catalog, /function leapmotorVisual/);
  assert.match(catalog, /dm-leapmotor-mark/);
  assert.doesNotMatch(catalog, /upload\.wikimedia\.org\/wikipedia\/commons\/d\/d8\/Leapmotor_logo_en\.svg/);
  assert.match(catalog, /data-brand-source="canonical"/);
  assert.match(catalog, /data-dm-beta5-brand="\$\{item\.name\}"/);
  assert.match(catalog, /data-brand-logo="\$\{item\.id\}"/);
  assert.doesNotMatch(feedback, /polishVehicleBrandImages|SIMPLE_ICON_SLUGS|dm-beta6-brand-image/);
});

test("feedback layer no longer repaints the whole dashboard or resizes Chart.js", async () => {
  const source = await read("src/sections/beta6-feedback-section.js");
  assert.doesNotMatch(source, /wrapFunction\("render"/);
  assert.doesNotMatch(source, /chart\.resize|chart\.update|__DASHBOARDMODERN_BETA5_ROOT_CAUSES__/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.match(source, /#ed-daily-chart \.ed-chart-wrap/);
});

test("EV selector updates existing cards instead of rebuilding them on every state event", async () => {
  const source = await read("src/sections/ev-section.js");
  assert.match(source, /selectorStructureSignature/);
  // La firma sta sull'elemento, non nel modulo: la tendina si disegna in due
  // posti — la pagina Auto e il popup dell'auto — e un valore solo avrebbe
  // fatto ridisegnare l'una a ogni passata dell'altra, che e' esattamente il
  // ricostruire-tutto che questa prova impedisce.
  assert.match(source, /dataset\.dmEvSignature !== structure/);
  assert.match(source, /small\.textContent!==meta/);
  assert.match(source, /legacyRefreshSignature/);
  assert.match(source, /signature===state\.legacyRefreshSignature/);
  assert.doesNotMatch(source, /nav\.replaceChildren\(\.\.\.buttons\)/);
});

test("EV brand card keeps one geometry before and after the beta11 marker", async () => {
  // The freshly re-rendered card must not wear a different layout than the
  // one beta11 applies a moment later: that mismatch was the visible "flip".
  const entry = await read("src/sections/beta-entry-section.js");
  assert.match(entry, /dm-beta7-ev-brand-layout/);
  assert.match(entry, /grid-template-columns:112px minmax\(0,1fr\)!important/);
  assert.match(entry, /\.dm-brand-preview \.dm-car-brand/);
  const base = await read("src/sections/personalization-section.js");
  assert.match(base, /\.dm-brand-preview\{[^}]*grid-template-columns:112px minmax\(0,1fr\)/);
});

test("Lights popup keeps dimmer and RGB controls based on HA capabilities", async () => {
  const source = await read("src/sections/beta6-feedback-section.js");
  assert.match(source, /supported_color_modes/);
  assert.match(source, /BRIGHTNESS_MODES/);
  assert.match(source, /RGB_MODES/);
  assert.match(source, /brightness_pct:Number\(slider\.value\)/);
  assert.match(source, /rgb_color:hexToRgb\(event\.target\.value\)/);
  assert.match(source, /cdCallServiceJson\("light","turn_on"/);
  assert.match(source, /Dimmer e colori/);
});