import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const entryUrl = new URL("../src/sections/beta-entry-section.js", import.meta.url);
const polishUrl = new URL("../src/sections/beta9-real-device-polish-section.js", import.meta.url);
const engineUrl = new URL("../src/sections/icon-engine-section.js", import.meta.url);

test("beta9 real-device polish loads after the older beta7 compatibility layers", async () => {
  const entry = await readFile(entryUrl, "utf8");
  const regression = entry.indexOf('import "./beta7-regression-section.js"');
  const finalPolish = entry.indexOf('import "./beta9-real-device-polish-section.js"');
  assert.ok(regression >= 0);
  assert.ok(finalPolish > regression);
});

test("quick-action icons are delegated to the single-owner engine without beta9 repaint", async () => {
  const [source, engine] = await Promise.all([
    readFile(polishUrl, "utf8"),
    readFile(engineUrl, "utf8"),
  ]);
  assert.match(source, /DashboardModernIconEngine\?\.syncQuickActions\?\.\(\)/);
  assert.match(source, /#dm-visual-picker\[data-kind="action"\]\[data-dm-icon-engine="single-owner"\]/);
  assert.doesNotMatch(source, /icon\.innerHTML\s*=.*dm-v01525-action-glyph/);
  assert.doesNotMatch(source, /visual\.innerHTML\s*=.*dm-v01525-picker-glyph/);
  assert.match(engine, /renderIconGlyph\(target, "action", token, \{ size: 42 \}\)/);
  assert.match(engine, /target\.dataset\.dmActionStyle = "icon-engine"/);
  assert.match(engine, /event\.stopImmediatePropagation\(\)/);
});

test("EV brand dropdown owns logo preview and model options, and not its place", async () => {
  const source = await readFile(polishUrl, "utf8");
  // Where the panel goes belongs to the module that builds it — inside the
  // vehicle's own section. This one used to prepend it to the tab on every
  // pass, and the tab flickered between the two placements.
  assert.doesNotMatch(source, /body\.prepend\(panel\)/);
  assert.match(source, /brandSelect\.addEventListener\("input", syncBrand\)/);
  assert.match(source, /brandSelect\.addEventListener\("change", syncBrand\)/);
  assert.match(source, /modelSelect\.innerHTML = modelOptions\(brand, keep\)/);
  assert.match(source, /"Leapmotor": \["T03", "B10", "C10", "C10 REEV"\]/);
  assert.match(source, /"MINI": \["Cooper Electric", "Aceman", "Countryman Electric"\]/);
  /* Lo sbiancamento non c'e' piu', ed e' voluto.
   *
   * Serviva quando i loghi arrivavano da un CDN come immagini di provenienza
   * incerta: si normalizzavano a un inchiostro solo. Adesso le figure stanno
   * in casa e si disegnano come maschera, ognuna col colore vero del suo
   * marchio — e ridipingerle tutte uguali era esattamente cio' che era stato
   * chiesto di non fare. */
  assert.doesNotMatch(source, /filter:grayscale\(1\) brightness\(0\)/);
  assert.doesNotMatch(
    source,
    /#dm-visual-picker\[data-kind="car"\] \.dm-car-brand\{\s*color:/,
    "il marchio nel catalogo tiene il colore che si e' dato",
  );
  assert.match(source, /dm-v10-brand-wordmark/);
});

test("room and temperature editors are repaired without a global observer", async () => {
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /dm-room-config-row/);
  assert.match(source, /DashboardModernIconEngine\?\.render\?\.\(visual, "room", token, \{ size: 31 \}\)/);
  assert.doesNotMatch(source, /visual\.innerHTML = roomMarkup\(room, 34\);\s*visual\.dataset\.roomIcon/);
  assert.match(source, /select\.disabled = false/);
  assert.match(source, /select\.removeAttribute\("disabled"\)/);
  assert.match(source, /pointer-events", "auto", "important"/);
  assert.doesNotMatch(source, /MutationObserver/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
});

test("shutters are compact and alert animations follow the alert kind", async () => {
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /max-width", "360px", "important"/);
  assert.match(source, /height", "132px", "important"/);
  assert.match(source, /slat\.style\.setProperty\("animation", "none", "important"\)/);
  // Anche l'avviso tapparella fermo si muove: "static" lo lasciava l'unico
  // immobile del quadro, e da fuori sembrava un'animazione dimenticata.
  assert.match(source, /shutterMoving\(\) \? "shutter-moving" : "shutter"/);
  assert.match(source, /\.dm-alert-shutter \.dm-alert-glyph/);
  assert.match(source, /@keyframes dmAlertShutter\{[\s\S]*scaleY\(\.55\)/);
  // Every animation acts out its own alert, and it animates the glyph rather
  // than the disc the glyph sits in.
  assert.match(source, /\.dm-alert-door \.dm-alert-glyph/);
  assert.match(source, /transform-origin:left center!important;animation:dmAlertDoor/);
  // The leaf narrows towards its hinge and comes back: a door swinging open,
  // drawn in two dimensions. A perspective rotateY reads the same and opens a
  // 3D rendering context on every alert icon, which WebKit did not survive.
  assert.match(source, /@keyframes dmAlertDoor\{[\s\S]*scaleX\(\.44\)/);
  assert.doesNotMatch(source, /@keyframes dmAlertDoor\{[\s\S]{0,200}perspective\(/);
  // The level drops by squashing towards the base, not by being clipped: these
  // animations never stop, and only transform and opacity spare the engine a
  // repaint on every frame.
  assert.match(source, /@keyframes dmAlertBattery\{[\s\S]*transform:scaleY\(\.44\)/);
  assert.doesNotMatch(source, /@keyframes dmAlert[\s\S]*?\{[^}]*(clip-path|filter:(?!none))/);
  assert.doesNotMatch(source, /dmAlertOpening/);
  for (const kind of ["window", "leak", "flame", "motion", "temperature", "power", "light", "security"]) {
    assert.match(source, new RegExp(`\\.dm-alert-${kind} \\.dm-alert-glyph`));
  }
  /* E nessun ramo a movimento ridotto le spegne: il movimento e' il segnale
   * dell'avviso, e su molti desktop quell'impostazione di sistema e' attiva a
   * insaputa di chi guarda la plancia. Da desktop gli avvisi parevano fermi. */
  assert.doesNotMatch(source, /prefers-reduced-motion[\s\S]{0,200}dm-alert/);
});

test("add-light layout cannot collapse its entity field", async () => {
  const source = await readFile(polishUrl, "utf8");
  assert.match(source, /dm-light-add-entity-row/);
  assert.match(source, /grid-template-columns:minmax\(0,1fr\) 58px!important/);
  assert.match(source, /#luce-add-ent/);
  assert.match(source, /setProperty\("position", "static", "important"\)/);
});