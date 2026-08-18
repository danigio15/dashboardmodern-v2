import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const scene = await read("../src/sections/shutter-scene-section.js");
const runtime = await read("../src/sections/section-runtime.js");
const legacyCss = await read("../legacy/dashboard-runtime-it.css");

test("the Tapparelle page has exactly one render owner, installed once", () => {
  assert.match(scene, /root\.renderTapparelle = owned/);
  assert.match(scene, /owned\[MARKER\] = true/);
  assert.match(scene, /if \(typeof current === "function" && current\[MARKER\]\) return/);
  // Replacing the legacy painter, not decorating it: a wrapper would paint the
  // legacy markup first and this module's markup over it on every tick.
  assert.doesNotMatch(scene, /wrapFunction/);
  assert.equal((runtime.match(/shutter-scene-section\.js/g) || []).length, 1);
  assert.equal((runtime.match(/installShutterSceneSection\(\)/g) || []).length, 1);
});

test("markup is rebuilt per structural signature, not per repaint", () => {
  // The legacy loop calls renderTapparelle every 2s. Rewriting innerHTML each
  // time would drop the position track the user is holding.
  assert.match(scene, /if \(state\.signature !== current \|\| !grid\.querySelector\("\[data-dm-shutter-card\]"\)\)/);
  assert.match(scene, /function syncCard\(card, view\)/);
  assert.doesNotMatch(scene, /setInterval\s*\(/);
  assert.doesNotMatch(scene, /MutationObserver/);
});

test("the cards keep every legacy class the skin and the device contracts use", () => {
  for (const className of [
    "tapp-card",
    "tapp-head",
    "tapp-name",
    "tapp-state",
    "tapp-win",
    "tapp-glass",
    "tapp-shutter",
    "tapp-pos",
    "tapp-ctl",
    "tapp-btn",
  ]) {
    assert.match(scene, new RegExp(`class="[^"]*\\b${className}\\b`), `missing ${className}`);
  }
  assert.match(scene, /const SLAT_COUNT = 8/);
  assert.match(scene, /`<i><\/i>`\.repeat\(SLAT_COUNT\)/);
});

test("markup avoids the tags the legacy stylesheet claims globally", () => {
  // dashboard-runtime.css styles bare `header` and `h1,h2,h3`, so a <header>
  // here would inherit a card background and a 30px margin.
  assert.match(legacyCss, /^header \{/m);
  assert.match(legacyCss, /^h1, h2, h3 \{/m);
  assert.doesNotMatch(scene, /<(?:header|h1|h2|h3)[ >]/);
  assert.match(scene, /role="heading" aria-level="2"/);
  assert.match(scene, /role="heading" aria-level="3"/);
});

test("commands stay on the legacy handler and positions go through the service", () => {
  assert.equal((scene.match(/onclick="cdTappCmd\(this\)"/g) || []).length, 5);
  assert.match(scene, /data-svc="open_cover"/);
  assert.match(scene, /data-svc="stop_cover"/);
  assert.match(scene, /data-svc="close_cover"/);
  assert.match(scene, /dmCallHaService\?\.\("cover", "set_cover_position"/);
});

test("only a cover that reports SET_POSITION becomes draggable", () => {
  assert.match(scene, /const SUPPORT_SET_POSITION = 4/);
  assert.match(scene, /settable: Boolean\(features & SUPPORT_SET_POSITION\)/);
  assert.match(scene, /if \(!view\.settable\) return `<div class="dm-tapp-track" data-dm-static/);
});

test("the page keeps the same way back home as every other section", () => {
  // Same class, same label and the same inline handler the legacy runtime uses,
  // so it looks and behaves like the button on Clima or Temperature.
  assert.match(scene, /class="back-home-btn dm-tapp-back"/);
  assert.match(scene, /<span class="bh-icon">←<\/span>/);
  assert.match(scene, /onclick="document\.querySelector\('\[data-tab=&quot;home&quot;\]'\)\.click\(\); if\(navigator\.vibrate\)navigator\.vibrate\(5\);"/);
  // Rendered inside the grid, so it lines up with the header and the cards
  // instead of sitting against the viewport edge where the runtime puts it.
  assert.match(scene, /let markup = backHomeMarkup\(\) \+ heroMarkup\(\)/);
  assert.match(scene, /grid\.innerHTML = `\$\{backHomeMarkup\(\)\}<div class="ed-empty/);
  assert.match(scene, /\.back-home-btn\.dm-tapp-back\{grid-column:1\/-1!important;justify-self:start!important/);
  // And the runtime's own copy is dropped, so the page never shows two.
  assert.match(scene, /function dropLegacyBackHome\(\)/);
  assert.match(scene, /querySelectorAll\(":scope > \.back-home-btn"\)/);
  assert.match(scene, /dropLegacyBackHome\(\);\n {2}const views = coverList\(\);/);
});

test("nothing shares the row with the window", () => {
  // The track used to stand beside the window, which narrowed the window and
  // left the panel short of the card edge with an empty column next to it.
  assert.match(scene, /\.dm-tapp-stage\{display:block!important;min-width:0!important\}/);
  assert.match(scene, /\.dm-tapp-stage \.tapp-win\{width:100%!important/);
  // The position is a full-width rail under the window with the readout at its
  // end, so it is one horizontal control instead of a vertical one at the side.
  assert.match(scene, /<div class="dm-tapp-bar">\n\s+\$\{trackMarkup\(view\)\}\n\s+<div class="tapp-pos" data-dm-readout><\/div>\n\s+<\/div>/);
  assert.match(scene, /\.dm-tapp-track\{\n\s+position:relative!important;flex:1 1 auto!important/);
  assert.match(scene, /background:linear-gradient\(90deg,var\(--tapp-track-sky\) 0 calc\(var\(--tapp-open,0\) \* 100%\)/);
  assert.doesNotMatch(scene, /rotate\(-90deg\)/);
  assert.doesNotMatch(scene, /cursor:ns-resize/);
});

test("a position the user asked for survives the next legacy repaint", () => {
  // Home Assistant keeps reporting the old position until the motor arrives.
  assert.match(scene, /const GRAB_MS = \d+/);
  assert.match(scene, /range !== doc\.activeElement && !state\.grabbed\.has\(view\.entity\)/);
  assert.match(scene, /const grab = state\.grabbed\.get\(entity\)/);
});
