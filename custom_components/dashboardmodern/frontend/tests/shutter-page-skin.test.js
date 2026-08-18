import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const shutter = await read("../src/sections/shutter-section.js");
const beta9 = await read("../src/sections/beta9-real-device-polish-section.js");

/**
 * The skin is one template literal handed to installStyle. A stray backtick
 * inside it silently splits the literal into a comparison expression instead of
 * failing to parse, so the stylesheet is read back the same way a browser would
 * see it and every assertion below runs against that text.
 */
function skin(source) {
  const call = source.indexOf('installStyle("dm-shutter-section-style", `');
  assert.notEqual(call, -1, "shutter section must install its stylesheet");
  const open = source.indexOf("`", call);
  const close = source.indexOf("`", open + 1);
  const css = source.slice(open + 1, close);
  assert.match(css, /page-tapparelle/, "stylesheet is truncated by a stray backtick");
  return css;
}

const css = skin(shutter);

test("the shutter page paints a real window behind the slats", () => {
  assert.match(css, /--tapp-sky:linear-gradient/);
  assert.match(css, /--tapp-sun:radial-gradient/);
  assert.match(css, /--tapp-hill-a:radial-gradient/);
  assert.match(css, /--tapp-hill-b:radial-gradient/);
  assert.match(css, /--tapp-mullion:linear-gradient/);
  assert.match(css, /\.tapp-win\{[^}]*background:var\(--tapp-mullion\),var\(--tapp-clouds\),var\(--tapp-stars\),var\(--tapp-sun\),var\(--tapp-trees\),var\(--tapp-hill-a\),var\(--tapp-hill-b\),var\(--tapp-sky\)!important/);
  assert.match(css, /\.tapp-win::before\{[^}]*background:var\(--tapp-box\)!important/);
  assert.match(css, /\.tapp-win::after\{[^}]*background:var\(--tapp-guides\)!important/);
});

test("the shutter panel carries its own slat texture so a closed shutter is opaque", () => {
  // The groove stop of --tapp-slat is translucent, so every layer that paints
  // the texture also names the opaque base colour behind it. Without it the sky
  // shows through one pixel of every slat on a fully closed shutter.
  assert.match(css, /--tapp-slat-base:#[0-9a-f]{6}/);
  assert.match(css, /\.tapp-shutter\{[^}]*var\(--tapp-slat\) left bottom\/100% 12px repeat-y var\(--tapp-slat-base\)!important/);
  assert.match(css, /\.tapp-shutter::before\{[^}]*var\(--tapp-slat\) left bottom\/100% 12px repeat-y var\(--tapp-slat-base\)/);
  assert.match(css, /\.tapp-shutter i\{[^}]*background:none!important;border:0!important/);
});

test("the slats travel while the shutter is moving", () => {
  // Beta9 pins animation:none on the panel itself, and an inline declaration
  // cannot reach a pseudo-element — that is why the travelling texture lives on
  // ::before. An !important declaration outranks a CSS animation, so every
  // property the keyframes drive has to stay normal-weight.
  assert.match(css, /\.tapp-shutter\.closing::before\{animation:dmTappRoll [^}]*infinite!important\}/);
  assert.match(css, /\.tapp-shutter\.opening::before\{animation:dmTappRoll [^}]*infinite reverse!important\}/);
  assert.match(css, /@keyframes dmTappRoll\{from\{background-position-y:100%\}to\{background-position-y:calc\(100% \+ 12px\)\}\}/);
  for (const rule of [
    css.match(/\.tapp-shutter::before\{[^}]*\}/)[0],
    css.match(/\.tapp-card::before\{[^}]*\}/)[0],
  ]) {
    assert.doesNotMatch(rule, /background(-position|-size|-repeat)?:[^;}]*!important/);
  }
});

test("the page skin keeps the Beta9 first-paint geometry", () => {
  assert.match(css, /First paint is already the final Beta9 geometry/);
  assert.match(css, /#tapp-grid\{display:grid!important;grid-template-columns:repeat\(auto-fit,minmax\(280px,360px\)\)!important/);
  assert.match(css, /\.tapp-card\{box-sizing:border-box!important;width:100%!important;max-width:360px!important/);
  assert.match(css, /\.tapp-win\{box-sizing:border-box!important;height:132px!important;min-height:132px!important;max-height:132px!important/);
  assert.match(css, /\.tapp-shutter\{animation:none!important;filter:none!important;transition:height \.55s/);
});

test("the skin themes itself instead of hard-coding one palette", () => {
  assert.match(css, /html\[data-theme="dark"\] body #page-tapparelle#page-tapparelle,html body\.dark-theme #page-tapparelle#page-tapparelle\{/);
  assert.match(css, /--tapp-stars:none/);
  assert.match(css, /--tapp-stars:radial-gradient/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("card controls and the open/close-everything bar have one owner", () => {
  assert.match(css, /\.tapp-btn\[data-svc="open_cover"\]\{background:var\(--tapp-up-bg\)/);
  assert.match(css, /\.tapp-btn\[data-svc="stop_cover"\]\{background:var\(--tapp-stop-bg\)/);
  assert.match(css, /\.tapp-btn\[data-svc="close_cover"\]\{background:var\(--tapp-down-bg\)/);
  assert.match(css, /\.tapp-btn\[data-all\]\{[^}]*height:46px!important/);
  assert.doesNotMatch(beta9, /\.tapp-btn/);
});

test("the page skin stays static CSS and never walks the grid", () => {
  const page = shutter.slice(shutter.indexOf("Tapparelle page"));
  assert.doesNotMatch(page, /querySelector|MutationObserver|setInterval/);
  assert.doesNotMatch(shutter, /wrapFunction\([^\n]*renderTapparelle/);
});
