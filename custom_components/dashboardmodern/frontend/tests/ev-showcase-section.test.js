// DM-FIX-20260817D
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/sections/ev-showcase-section.js", import.meta.url), "utf8");

async function loadSection() {
  return import(`../src/sections/ev-showcase-section.js?fix=${Date.now()}`);
}

function fakeDocument({ activeMode = "", battWidth = "" } = {}) {
  const buttons = ["off", "pv", "minpv", "now"].map((mode) => ({
    id: `m-btn-${mode}`,
    mode,
  }));
  return {
    querySelector(selector) {
      if (selector !== ".evcc-mode-btn.active") return null;
      return buttons.find((button) => button.mode === activeMode) || null;
    },
    getElementById(id) {
      if (id !== "ev-mod-batt-fill") return null;
      return { style: { width: battWidth } };
    },
  };
}

test("the active EVCC mode is read from the button the legacy runtime marks", async () => {
  const { evActiveMode } = await loadSection();
  assert.equal(evActiveMode(fakeDocument({ activeMode: "pv" })), "pv");
  assert.equal(evActiveMode(fakeDocument({ activeMode: "minpv" })), "minpv");
  assert.equal(evActiveMode(fakeDocument({ activeMode: "now" })), "now");
  assert.equal(evActiveMode(fakeDocument({ activeMode: "off" })), "off");
  // No mode marked yet: the page stays on the neutral colour.
  assert.equal(evActiveMode(fakeDocument()), "");
});

test("an unknown button id never becomes a mode", async () => {
  const { evActiveMode } = await loadSection();
  const scope = { querySelector: () => ({ id: "m-btn-turbo" }) };
  assert.equal(evActiveMode(scope), "");
});

test("the ring reads the state of charge from the bar the render loop writes", async () => {
  const { batteryLevel } = await loadSection();
  assert.equal(batteryLevel(fakeDocument({ battWidth: "68%" })), 68);
  assert.equal(batteryLevel(fakeDocument({ battWidth: "0%" })), 0);
  assert.equal(batteryLevel(fakeDocument({ battWidth: "12.5%" })), 12.5);
  // Out of range values are clamped rather than drawn past the ring.
  assert.equal(batteryLevel(fakeDocument({ battWidth: "140%" })), 100);
  assert.equal(batteryLevel(fakeDocument({ battWidth: "-3%" })), 0);
  // Before the first render there is no width to read.
  assert.equal(batteryLevel(fakeDocument()), null);
  assert.equal(batteryLevel({ getElementById: () => null }), null);
});

test("the arc length matches the percentage it has to draw", async () => {
  const { arcDash } = await loadSection();
  const [drawn, gap] = arcDash(50, 100).split(" ").map(Number);
  assert.equal(drawn, 50);
  assert.equal(gap, 50);
  assert.equal(arcDash(0, 100), "0.0 100.0");
  assert.equal(arcDash(100, 100), "100.0 0.0");
  // A missing reading draws an empty ring instead of a full one.
  assert.equal(arcDash(null, 100), "0.0 100.0");
  assert.equal(arcDash(Number.NaN, 100), "0.0 100.0");
});

test("the redesigned page keeps every legacy runtime hook", () => {
  // The legacy render loop drives these: it writes the width, --batt-col and
  // the low/mid classes on the battery bar, fills the badge ids per EVSE state
  // and marks the active .evcc-mode-btn. Losing any of them freezes the page.
  for (const hook of [
    "ev-mod-batt-fill",
    "lm-hero-card",
    "lm-charge-badge",
    "ev-mod-car-img",
    "evcc-mode-btn",
    "m-btn-",
    "--batt-col",
  ])
    assert.ok(source.includes(hook), hook);
  // The rows next to the ring carry legacy value classes, so the render loop
  // fills them through querySelectorAll instead of this module computing them.
  for (const valueClass of ["v-ev-pow", "v-ev-remain", "v-auto-limite"])
    assert.match(source, new RegExp(`class="dm-evv-row-val ${valueClass}"`), valueClass);
});

test("the section owns presentation only and never recomputes EV values", () => {
  // The header documents the legacy owners by name; the code below it must stay
  // clear of the engine.
  const body = source.slice(source.indexOf("\nimport {"));
  for (const owned of [
    "setEVMode",
    "cdEvApplyCar",
    "renderVehicleSelector",
    "apriStorico\\(",
    "dm\\.ev_target_soc",
    "localStorage",
  ])
    assert.doesNotMatch(body, new RegExp(owned), owned);
  // Event-driven only: no polling, no observer.
  assert.doesNotMatch(body, /setInterval\s*\(/);
  assert.doesNotMatch(body, /MutationObserver/);
});

test("the battery block is moved into the ring, never duplicated", () => {
  const mount = source.slice(source.indexOf("function mountPower"), source.indexOf("function mountStatIcons"));
  // append() moves the node; cloneNode would leave two owners of the same bar.
  assert.match(mount, /\.append\(battery\)/);
  assert.doesNotMatch(mount, /cloneNode/);
  // Mounting twice must not build a second card.
  assert.match(mount, /if \(power\) return power/);
});

test("the target card and the mode buttons carry the configured EVCC colours", () => {
  for (const colour of ["#e11d48", "#059669", "#d97706", "#0284c7"])
    assert.ok(source.includes(colour), colour);
  // The buttons keep their own inline --btn-col instead of a forked palette.
  assert.match(source, /background:var\(--btn-col\)!important/);
  // The target card follows the mirrored mode attribute.
  assert.match(source, /#page-ev\.dm-evv \.lm-target-card\{[\s\S]*?--evv-mode/);
  assert.match(source, /page\.dataset\.dmEvMode = mode/);
});

test("each mode button gets its own animation and reduced motion stops them all", () => {
  for (const keyframe of ["dmEvvOffRing", "dmEvvSpin", "dmEvvCloud", "dmEvvZoom"])
    assert.match(source, new RegExp(`@keyframes ${keyframe}`), keyframe);
  assert.match(source, /prefers-reduced-motion:reduce[\s\S]*?animation:none!important/);
});
