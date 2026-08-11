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

test("beta11 pool uses a semantic responsive plant schematic", () => {
  assert.match(css, /#page-piscina \.pool-hero::before/);
  assert.match(css, /#page-piscina \.pool-hero::after/);
  assert.match(css, /\.pool-tg\[data-act="pump"\]/);
  assert.match(css, /\.pool-tg\[data-act="heat"\]/);
  assert.match(css, /\.pool-tg\[data-act="light"\]/);
  assert.match(css, /\.pool-card:not\(:has\(\.pool-bar\)\)/);
  assert.match(css, /\.pool-card:has\(\.pool-bar\)/);
  assert.match(css, /#page-piscina #pool-wrap > \.pool-card \.pool-sub\s*\{[^}]*position:\s*static\s*!important/s);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?#page-piscina \.pool-hero/);
  assert.equal(balancedBraces(css), true);
});
