// DM-FIX-20260818A
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/sections/minipc-showcase-section.js", import.meta.url),
  "utf8",
);

async function loadSection() {
  return import(`../src/sections/minipc-showcase-section.js?fix=${Date.now()}`);
}

function fakeDocument({ widths = {}, dash = "", netClasses = [] } = {}) {
  return {
    getElementById(id) {
      if (id === "srv-temp-circle") {
        return { getAttribute: (name) => (name === "stroke-dasharray" ? dash : null) };
      }
      if (id === "waw-net-badge") {
        return { classList: { contains: (name) => netClasses.includes(name) } };
      }
      if (id in widths) return { style: { width: widths[id] } };
      return null;
    },
  };
}

test("each gauge reads the load from the bar the render loop writes", async () => {
  const { metricLevel } = await loadSection();
  const scope = fakeDocument({
    widths: { "srv-fill-cpu": "23.4%", "srv-fill-ram": "61%", "srv-fill-disk": "0%" },
  });
  assert.equal(metricLevel("srv-fill-cpu", scope), 23.4);
  assert.equal(metricLevel("srv-fill-ram", scope), 61);
  assert.equal(metricLevel("srv-fill-disk", scope), 0);
  // Out of range widths are clamped rather than drawn past the ring.
  assert.equal(
    metricLevel("srv-fill-cpu", fakeDocument({ widths: { "srv-fill-cpu": "140%" } })),
    100,
  );
  assert.equal(metricLevel("srv-fill-cpu", fakeDocument({ widths: { "srv-fill-cpu": "-4%" } })), 0);
  // Before the first render there is no width to read.
  assert.equal(metricLevel("srv-fill-cpu", fakeDocument()), null);
});

test("a prism stands as tall as the load it carries", async () => {
  const { barHeight } = await loadSection();
  // 0% still leaves a base plate, 100% reaches the top of the scene.
  assert.equal(barHeight(0, 100), 6);
  assert.equal(barHeight(100, 100), 100);
  assert.equal(barHeight(50, 100), 53);
  // Out of range readings are clamped instead of growing out of the panel.
  assert.equal(barHeight(140, 100), 100);
  assert.equal(barHeight(-20, 100), 6);
  // No reading yet: the base plate, not a full prism.
  assert.equal(barHeight(null, 100), 6);
  assert.equal(barHeight(Number.NaN, 100), 6);
});

test("a prism keeps its own colour until the legacy thresholds bite", async () => {
  const { levelColour } = await loadSection();
  // Same 65 / 85 pair the legacy setRing() uses for these three gauges.
  assert.equal(levelColour(20, "#06b6d4"), "#06b6d4");
  assert.equal(levelColour(65, "#06b6d4"), "#06b6d4");
  assert.equal(levelColour(66, "#06b6d4"), "#f59e0b");
  assert.equal(levelColour(85, "#06b6d4"), "#f59e0b");
  assert.equal(levelColour(86, "#06b6d4"), "#ef4444");
  // No reading at all keeps the configured colour instead of raising an alarm.
  assert.equal(levelColour(null, "#10b981"), "#10b981");
});

test("the thermal scale follows the arc the runtime drew, never a sensor", async () => {
  const { tempFraction } = await loadSection();
  assert.equal(tempFraction(fakeDocument({ dash: "50 50" })), 0.5);
  assert.equal(tempFraction(fakeDocument({ dash: "90.5 135.7" })).toFixed(3), "0.400");
  assert.equal(tempFraction(fakeDocument({ dash: "0 226" })), 0);
  // Nothing drawn yet, or an unreadable value: the pin stays at the cold end.
  assert.equal(tempFraction(fakeDocument()), 0);
  assert.equal(tempFraction(fakeDocument({ dash: "0 0" })), 0);
});

test("the temperature badge takes its level and wording from the legacy line", async () => {
  const { tempLevel, tempWording } = await loadSection();
  assert.equal(tempLevel("🟢 Ottimale"), "ok");
  assert.equal(tempLevel("🟡 Nella norma"), "warm");
  assert.equal(tempLevel("🔴 Alta — Controllare"), "hot");
  assert.equal(tempLevel("—"), "");
  assert.equal(tempLevel(), "");
  // The wording survives in both locales, minus the marker the dot replaces.
  assert.equal(tempWording("🟢 Ottimale"), "Ottimale");
  assert.equal(tempWording("🔴 High — Check it"), "High — Check it");
  assert.equal(tempWording("—"), "—");
});

test("connectivity is mirrored from the badge class, not recomputed", async () => {
  const { networkState } = await loadSection();
  assert.equal(networkState(fakeDocument({ netClasses: ["srv-status-badge", "online"] })), "on");
  assert.equal(networkState(fakeDocument({ netClasses: ["srv-status-badge", "offline"] })), "off");
  // Before the first tick the badge carries neither class.
  assert.equal(networkState(fakeDocument({ netClasses: ["srv-status-badge"] })), "");
  assert.equal(networkState(fakeDocument()), "");
});

test("the trace keeps only the readings the page already showed", async () => {
  const { sampleCpu } = await loadSection();
  const samples = [];
  const scope = fakeDocument({ widths: { "srv-fill-cpu": "12%" } });
  sampleCpu(scope, samples);
  sampleCpu(scope, samples);
  assert.deepEqual(samples, [12, 12]);
  // A tick with no width to read adds nothing rather than a zero.
  sampleCpu(fakeDocument(), samples);
  assert.equal(samples.length, 2);
  // The window is bounded, so a long session cannot grow without end.
  const long = [];
  for (let index = 0; index < 400; index += 1) sampleCpu(scope, long);
  assert.equal(long.length, 96);
});

test("the curve draws the samples as a spline and the area under it", async () => {
  const { tracePaths, traceOffset } = await loadSection();
  const empty = tracePaths([]);
  assert.equal(empty.line, "");
  assert.equal(empty.area, "");
  // A single reading is drawn flat across the band instead of as a lone dot.
  const single = tracePaths([50], 100, 50);
  assert.match(single.line, /^M0\.0 ([\d.]+) C[\d.]+ \1 [\d.]+ \1 100\.0 \1$/);
  const many = tracePaths([0, 60, 100], 100, 50);
  assert.match(many.line, /^M0\.0 /);
  // One cubic segment per gap between readings: the curve is smooth.
  assert.equal(many.line.match(/C/g)?.length, 2);
  assert.match(many.line, /100\.0 [\d.]+$/);
  // The area closes onto the baseline so the fill never leaks upwards.
  assert.equal(many.area.endsWith("L100 50 L0 50 Z"), true);
  // Higher load sits higher in the band, and the dot uses the same geometry.
  assert.ok(traceOffset(90) < traceOffset(10));
  assert.ok(traceOffset(100) >= 0 && traceOffset(0) <= 1);
  assert.equal(traceOffset(Number.NaN), traceOffset(0));
});

test("a spike cannot bow the curve out of its band", async () => {
  const { smoothPath } = await loadSection();
  assert.equal(smoothPath([]), "");
  const height = 50;
  // Alternating floor and ceiling readings: the control points of a
  // Catmull-Rom spline overshoot, so they are clamped inside the band.
  const points = [0, 100, 0, 100].map((level, index) => ({
    x: index * 10,
    y: level ? 1 : height - 1,
  }));
  const numbers = smoothPath(points, height)
    .split(/[\sC]+/)
    .map(Number)
    .filter((value) => Number.isFinite(value));
  for (const value of numbers.filter((_, index) => index % 2 === 1)) {
    assert.ok(value >= 1 && value <= height - 1, `${value} outside the band`);
  }
});

test("a gauge past a legacy threshold says so on its label too", async () => {
  const { levelName } = await loadSection();
  assert.equal(levelName(12), "ok");
  assert.equal(levelName(65), "ok");
  assert.equal(levelName(70), "warn");
  assert.equal(levelName(85), "warn");
  assert.equal(levelName(92), "alert");
  // No reading yet: the label stays neutral instead of claiming a level.
  assert.equal(levelName(null), "");
});

test("the redesigned page keeps every legacy runtime hook", () => {
  // The legacy render loop drives these: it writes the bar widths, the arc and
  // its threshold colour, the status wording and the badge classes. Losing any
  // of them freezes the page on its first paint.
  for (const hook of [
    "srv-fill-cpu",
    "srv-fill-ram",
    "srv-fill-disk",
    "srv-temp-circle",
    "v-srv-temp-status",
    "waw-net-badge",
    "srv-metric-val",
    "srv-metric-fill",
  ])
    assert.ok(source.includes(hook), hook);
  // The bar is hidden, never removed: it is the value the rings read.
  assert.match(source, /\.srv-metric-bar\{display:none!important\}/);
});

test("the section owns presentation only and never reads Home Assistant state", () => {
  const body = source.slice(source.indexOf("\nimport {"));
  for (const owned of [
    "STATES",
    "getRawState",
    "getDisplay",
    "apriStorico\\(",
    "apriSrvHistory\\(",
    "dm\\.server_temperatura_cpu",
    "localStorage",
  ])
    assert.doesNotMatch(body, new RegExp(owned), owned);
  // No polling.
  assert.doesNotMatch(body, /setInterval\s*\(/);
  // One observer, and only for the one thing that announces itself no other
  // way: cdAutoHide() empties a block by writing an inline style on its cards
  // and is called from inside the runtime, so there is no name to wrap and no
  // event to hear. It is scoped to the page and to that attribute — never to
  // the document, and never to what the cards say.
  assert.equal(body.match(/new (?:root\.)?MutationObserver\s*\(/g)?.length ?? 0, 1);
  assert.match(
    body,
    /observe\(page, \{ attributes: true, attributeFilter: \["style"\], subtree: true \}\)/,
  );
});

test("a prism is built once and copies no value node", () => {
  const mount = source.slice(
    source.indexOf("function mountPrism"),
    source.indexOf("function mountScene"),
  );
  // Mounting twice must not stack a second prism on the same card.
  assert.match(mount, /if \(card\.dataset\.dmSrvxPrism\) return/);
  // The reading stays the node the render loop writes: nothing is cloned and no
  // value is read out of the DOM to be printed somewhere else.
  assert.doesNotMatch(mount, /cloneNode/);
  assert.doesNotMatch(mount, /textContent/);
  // Each prism knows which slot of the scene it stands in.
  assert.match(mount, /--dm-srvx-slot/);
});

test("the machine is a box of six faces, and the old glyph slot is emptied", () => {
  // One face list drives both the machine and the prisms.
  assert.match(source, /const BOX_FACES = \["front", "back", "left", "right", "top", "bottom"\]/);
  const mount = source.slice(
    source.indexOf("function mountScene"),
    source.indexOf("function mountTrace"),
  );
  // The legacy icon slot keeps existing — the runtime owns that markup — it is
  // just emptied, never removed from the header.
  assert.match(mount, /slot\.textContent = ""/);
  assert.doesNotMatch(mount, /\.remove\(\)/);
});

test("nothing forces a display the auto-hide writes inline on a card", () => {
  // cdAutoHide() shows and hides these cards by writing an inline display, so a
  // display marked !important would either strand a hidden card on the page or
  // show one the user never mapped.
  const styles = source.slice(source.indexOf("function minipcShowcaseCss"));
  for (const card of [".srv-metric", ".srv-temp-card", ".srv-tel-card", ".srv-status-card"]) {
    const pattern = new RegExp(`${card.replace(".", "\\.")}\\{[^}]*display:[^};]*!important`);
    assert.doesNotMatch(styles, pattern, card);
  }
  // A block emptied by the auto-hide drops its heading too, and the board is
  // told so telemetry can take the whole row instead of leaving a hole.
  assert.match(source, /cards\.every\(\(card\) => card\.style\.display === "none"\)/);
  assert.match(
    styles,
    /\[data-dm-srvx-thermal="off"\][\s\S]*?\.srv-tel-grid\{grid-column:1 \/ -1\}/,
  );
});

test("the page dresses both locales and both themes", () => {
  // Every string this module adds goes through the locale helper.
  assert.match(source, /t\("Carico CPU · live", "CPU load · live"\)/);
  assert.match(source, /t\(group\.it, group\.en\)/);
  assert.match(source, /html\[data-theme="dark"\] #page-server\.dm-srvx/);
  // Motion is decoration: it stops when the system asks for less of it.
  assert.match(source, /prefers-reduced-motion:reduce[\s\S]*?animation:none!important/);
});
