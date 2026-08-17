import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../legacy/dashboard-runtime.css", import.meta.url), "utf8");

function balancedBraces(source) {
  let depth = 0;
  for (const char of source) {
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

test("beta11 daily chart stays inside one bounded responsive parent", () => {
  assert.match(css, /\.energy-dashboard \.ed-chart-card\s*\{[^}]*overflow:\s*hidden\s*!important/s);
  assert.match(css, /\.energy-dashboard \.ed-chart-wrap\s*\{[^}]*height:\s*clamp\(250px,\s*38vw,\s*330px\)\s*!important/s);
  assert.match(css, /\.energy-dashboard \.ed-chart-wrap\s*\{[^}]*contain:\s*layout paint\s*!important/s);
  assert.match(css, /#ed-daily-canvas\[data-dm-actual-history\][\s\S]*?height:\s*100%\s*!important/s);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.energy-dashboard \.ed-chart-wrap\s*\{[^}]*height:\s*270px\s*!important/s);
});

test("the beta11 pool schematic stood down for the dedicated scene owner", () => {
  // Pool geometry now belongs to pool-irrigation-scene-section.js, which draws
  // its own markup. Leaving these absolute-position overrides here would only
  // re-apply to whatever element happened to reuse a legacy .pool-* class.
  assert.doesNotMatch(css, /#page-piscina/);
  assert.doesNotMatch(css, /\.pool-hero/);
  assert.doesNotMatch(css, /\.pool-tg/);
  assert.doesNotMatch(css, /\.pool-card/);
  assert.equal(balancedBraces(css), true);
});
