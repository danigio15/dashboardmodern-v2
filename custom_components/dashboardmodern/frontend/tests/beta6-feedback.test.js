import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("the icon engine owns the quick-action defaults and the visual picking", async () => {
  const entry = await read("src/sections/beta-entry-section.js");
  const engine = await read("src/sections/icon-engine-section.js");
  /* La rifinitura di beta6 non c'e' piu': sei delle sue sette passate
   * chiedevano gia' al motore delle icone di lavorare, e l'unica cosa sua — il
   * tasto che apre il catalogo accanto a `#ed-qa-icon` — e' passata al motore,
   * che quel tasto lo dipingeva e lo faceva gia' aprire. */
  assert.doesNotMatch(entry, /beta6-feedback-section\.js/);
  assert.match(entry, /import "\.\/icon-engine-section\.js";/);
  assert.doesNotMatch(entry, /quickActionGlyphByType|dm-beta6-quick-action-layout/);
  assert.doesNotMatch(entry, /__dmV01525GlyphRepair|dmBeta7IconToken|scheduleV01525QuickActionRepair/);
  assert.match(engine, /luci_group: \{ glyph: "💡", mdi: "mdi:lightbulb-group" \}/);
  assert.match(engine, /builtin_clima: \{ glyph: "❄️", mdi: "mdi:snowflake" \}/);
  assert.match(engine, /builtin_antifurto: \{ glyph: "🛡️", mdi: "mdi:shield-home" \}/);
  assert.match(engine, /builtin_lavatrice: \{ glyph: "🧺", mdi: "mdi:washing-machine" \}/);
  assert.match(engine, /toggle: \{ glyph: "🔀", mdi: "mdi:toggle-switch-outline" \}/);
  assert.match(engine, /script: \{ glyph: "▶️", mdi: "mdi:script-text-play" \}/);
  assert.match(engine, /scene: \{ glyph: "🎬", mdi: "mdi:movie-open" \}/);
  assert.match(engine, /modal\.id = "dm-visual-picker"/);
  /* La voce scelta finisce nel campo. Di norma col nome del disegno; dove il
   * consumatore stampa la casella come testo nudo, col segno. */
  assert.match(engine, /input\.value = options\.glifo === true \? item\.glyph \|\| item\.value : item\.value/);
});

test("the quick-action icon field is built, hidden and picked by the icon engine", async () => {
  const engine = await read("src/sections/icon-engine-section.js");
  assert.match(engine, /input\.closest\?\.\("\.ed-form-row"\)/);
  assert.match(engine, /input\.insertAdjacentElement\("afterend", trigger\)/);
  assert.match(engine, /#ed-qa-icon\.dm-beta6-qa-icon-value\{display:none!important\}/);
  assert.match(engine, /grid-template-columns:minmax\(0,1fr\) 56px!important/);
  assert.match(engine, /#ed-qa-name\{grid-column:1\/-1!important\}/);
  assert.match(engine, /\.dm-beta6-qa-icon-trigger/);
  assert.match(engine, /event\.stopImmediatePropagation\(\)/);
  assert.match(engine, /openIconPicker\(activation\.input, activation\.kind/);
  /* Il valore che si salva resta portatile: chi lo stampa altrove lo stampa
   * come testo nudo, e un «mdi:snowflake» ci finirebbe scritto per esteso. */
  assert.match(engine, /function azionePortatile/);
  assert.match(engine, /if \(portatile !== corrente\) input\.value = portatile;/);
  assert.match(engine, /input\.dataset\.dmBeta7DefaultGlyph = prossimo\.glyph;/);
});

test("manufacturer art is canonical, with a local Leapmotor emblem and no post-render swapping", async () => {
  const catalog = await read("src/core/personalization-catalog.js");
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
});

test("the icon engine does not repaint the whole dashboard or beat on a timer", async () => {
  const source = await read("src/sections/icon-engine-section.js");
  assert.doesNotMatch(source, /wrapFunction\("render"/);
  assert.doesNotMatch(source, /chart\.resize|chart\.update|__DASHBOARDMODERN_BETA5_ROOT_CAUSES__/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
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
  /* Il pannello «Dimmer e colori» di beta6 puntava a `#wz-lights-list`, un
   * nodo che nella plancia non esiste piu' da nessuna parte — quindi non si e'
   * mai visto. Le capacita' della luce e la chiamata al servizio le dice il
   * modello puro, e la scheda controlli la disegna la scena delle Luci: e'
   * quello il posto in cui questa promessa va tenuta. */
  const model = await read("src/core/light-model.js");
  assert.match(model, /supported_color_modes/);
  assert.match(model, /data\.brightness_pct = clamp\(/);
  assert.match(model, /data\.rgb_color = hexToRgb\(change\.hex\)/);
  const scene = await read("src/sections/lights-scene-section.js");
  assert.match(scene, /data-dm-light-brightness/);
  assert.match(scene, /data-dm-light-color/);
});
