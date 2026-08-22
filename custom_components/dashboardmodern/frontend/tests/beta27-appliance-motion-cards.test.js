import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/sections/appliance-layout-section.js", import.meta.url),
  "utf8",
);

test("beta27 appliance cards keep room context in the reference layout", () => {
  assert.match(source, /function roomForDevice/);
  assert.match(source, /device\.room_id \|\| device\.room/);
  assert.match(source, /category\.textContent = roomText\(room\)/);
  assert.match(source, /data-tab='appliances-main'/);
  assert.match(source, /\.appl-section-tab/);
});

test("beta27 appliance cards expose running and standby visual states", () => {
  assert.match(source, /data-appliance-state=\\?"standby\\?"/);
  assert.match(source, /data-appliance-state=\\?"running\\?"/);
  assert.match(source, /dm-appliance-standby-breathe/);
  /* I disegni di stato non hanno piu' un ramo a movimento ridotto che li
   * spegne: su molti desktop quell'impostazione e' attiva a insaputa di chi
   * guarda, e "in funzione" senza movimento e' stato segnalato tre volte
   * come animazioni assenti. */
  assert.doesNotMatch(source, /prefers-reduced-motion:reduce\)\{#page-appliances-main \.appl-wide-card/);
});

test("beta27 gives appliance families distinct physical animations", () => {
  for (const token of [
    "washer",
    "dryer",
    "fan",
    "dishwasher",
    "boiler",
    "hood",
    "air-conditioner",
    "robot-vacuum",
    "vacuum",
    "iron",
    "oven",
    "cooktop",
    "toaster",
    "kettle",
    "coffee",
    "microwave",
    "television",
    "fridge",
    "generic",
  ]) {
    assert.ok(source.includes(`data-dm-appliance-type=\\"${token}\\"`) || source.includes(`data-dm-appliance-type="${token}"`), token);
  }
  assert.match(source, /dm-appliance-drum-spin/);
  assert.match(source, /dm-appliance-water-wave/);
  assert.match(source, /dm-appliance-air-flow/);
  assert.match(source, /dm-appliance-rover/);
  assert.match(source, /dm-appliance-sway/);
  assert.match(source, /dm-appliance-heat/);
  assert.match(source, /dm-appliance-microwave/);
  assert.match(source, /dm-appliance-active-glow/);
});

test("beta27 appliance layout remains event driven without document observers", () => {
  assert.doesNotMatch(source, /MutationObserver/);
  assert.match(source, /wrapFunction\("renderAppliances"/);
  assert.match(source, /dashboardmodern:state-changed/);
});
