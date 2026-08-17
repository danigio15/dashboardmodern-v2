import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  gaugePosition,
  gaugeVerdict,
  lawnPlacement,
} from "../src/sections/pool-irrigation-scene-section.js";

const source = await readFile(
  new URL("../src/sections/pool-irrigation-scene-section.js", import.meta.url),
  "utf8",
);

test("a reading inside its healthy band lands in the middle third of the gauge", () => {
  assert.equal(gaugeVerdict(7.3, 7.0, 7.6), "ok");
  const centre = gaugePosition(7.3, 7.0, 7.6);
  assert.ok(centre > 33 && centre < 67, `pH 7.3 sat at ${centre}%`);
});

test("a reading outside its band is flagged and pushed towards the matching end", () => {
  assert.equal(gaugeVerdict(6.4, 7.0, 7.6), "low");
  assert.equal(gaugeVerdict(8.2, 7.0, 7.6), "high");
  assert.ok(gaugePosition(6.4, 7.0, 7.6) < 33);
  assert.ok(gaugePosition(8.2, 7.0, 7.6) > 67);
});

test("gauge positions stay on the track even for readings far past the thresholds", () => {
  for (const value of [-40, 0, 999]) {
    const position = gaugePosition(value, 0.5, 1.5);
    assert.ok(position >= 0 && position <= 100, `${value} mapped to ${position}%`);
  }
});

test("a missing reading has no gauge and no verdict", () => {
  assert.equal(gaugePosition(null, 7, 7.6), null);
  assert.equal(gaugePosition("n/a", 7, 7.6), null);
  assert.equal(gaugeVerdict(undefined, 7, 7.6), "");
});

test("a reading without thresholds still resolves to a finite position", () => {
  const position = gaugePosition(1.9, null, null);
  assert.ok(Number.isFinite(position) && position >= 0 && position <= 100);
  assert.equal(gaugeVerdict(1.9, null, null), "ok");
});

test("sprinklers fill the lawn in two rows and never leave its edges", () => {
  for (const count of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const spots = Array.from({ length: count }, (_value, index) => lawnPlacement(count, index));
    for (const spot of spots) {
      assert.ok(spot.x >= 5 && spot.x <= 95, `x ${spot.x} for ${count} zones`);
      assert.ok(spot.y > 0 && spot.y < 100);
    }
    const columns = new Set(spots.map((spot) => `${spot.y}:${spot.x.toFixed(2)}`));
    assert.equal(columns.size, count, `${count} zones overlapped on the lawn`);
  }
});

test("the back row sits higher and smaller than the front row", () => {
  const back = lawnPlacement(4, 0);
  const front = lawnPlacement(4, 3);
  assert.ok(back.y < front.y);
  assert.ok(back.scale < front.scale);
});

test("the scene owns both legacy paint functions instead of decorating them", () => {
  assert.match(source, /root\[name\] = owned/);
  assert.match(source, /"renderPiscina", POOL_MARKER/);
  assert.match(source, /"renderIrrigazione", IRRIGATION_MARKER/);
  // Commands stay with the legacy handlers: service domains, the filtration
  // sequencer and the rain skip must not be reimplemented here.
  assert.match(source, /root\.cdPoolBtn\?\.\(button\)/);
  assert.match(source, /root\.cdIrrBtn\?\.\(button\)/);
  assert.doesNotMatch(source, /call_service/);
});

test("the renderers repaint markup only when the configuration structure changes", () => {
  // The legacy loop calls both renderers every second while the page is
  // visible. An unconditional innerHTML write would restart the water and the
  // sprinkler animations on each of those ticks.
  assert.match(source, /state\.poolSignature !== signature \|\| !wrap\.querySelector/);
  assert.match(source, /state\.irrigationSignature !== signature \|\| !head\.querySelector/);
  assert.doesNotMatch(source, /setInterval/);
  assert.doesNotMatch(source, /MutationObserver/);
});

test("running zones drive the spray, the splashes and the wet grass from one attribute", () => {
  assert.match(source, /node\.dataset\.state = running\[index\] \? "on" : "off"/);
  for (const layer of ["dm-zone-spray", "dm-zone-splashes", "dm-zone-wet", "dm-zone-fan"]) {
    assert.match(source, new RegExp(`\\.dm-zone\\[data-state="on"\\] \\.${layer}`));
  }
  // Each droplet keyframe must have a landing ring waiting where it comes down.
  for (let index = 0; index < 8; index += 1) {
    assert.match(source, new RegExp(`@keyframes dmDrop${index}\\{`));
    assert.match(source, new RegExp(`\\.dm-zone-splashes \\.dm-drop-${index}\\{left:`));
  }
});

test("the spray keyframes are applied as longhands so the per-droplet delays survive", () => {
  // An `animation:` shorthand at this specificity would reset every delay to 0
  // and collapse the fan into a single clump leaving the sprinkler head.
  assert.match(source, /\.dm-zone-spray i\{\s*animation-name:var\(--drop-path\)/);
  assert.doesNotMatch(source, /\.dm-zone-spray i\{animation:/);
});

test("motion is dropped for viewers who ask for reduced motion", () => {
  assert.match(source, /@media \(prefers-reduced-motion:reduce\)/);
});
