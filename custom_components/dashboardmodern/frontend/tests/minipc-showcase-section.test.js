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
  assert.equal(metricLevel("srv-fill-cpu", fakeDocument({ widths: { "srv-fill-cpu": "140%" } })), 100);
  assert.equal(metricLevel("srv-fill-cpu", fakeDocument({ widths: { "srv-fill-cpu": "-4%" } })), 0);
  // Before the first render there is no width to read.
  assert.equal(metricLevel("srv-fill-cpu", fakeDocument()), null);
});

test("the ring draws exactly the percentage it was given", async () => {
  const { ringDash } = await loadSection();
  const [drawn, gap] = ringDash(40, 100).split(" ").map(Number);
  assert.equal(drawn, 40);
  assert.equal(gap, 60);
  assert.equal(ringDash(0, 100), "0.0 100.0");
  assert.equal(ringDash(100, 100), "100.0 0.0");
  // A missing reading draws an empty ring instead of a full one.
  assert.equal(ringDash(null, 100), "0.0 100.0");
  assert.equal(ringDash(Number.NaN, 100), "0.0 100.0");
});

test("the gauge keeps its own colour until the legacy thresholds bite", async () => {
  const { ringColour } = await loadSection();
  // Same 65 / 85 pair the legacy setRing() uses for these three gauges.
  assert.equal(ringColour(20, "#06b6d4"), "#06b6d4");
  assert.equal(ringColour(65, "#06b6d4"), "#06b6d4");
  assert.equal(ringColour(66, "#06b6d4"), "#f59e0b");
  assert.equal(ringColour(85, "#06b6d4"), "#f59e0b");
  assert.equal(ringColour(86, "#06b6d4"), "#ef4444");
  // No reading at all keeps the configured colour instead of raising an alarm.
  assert.equal(ringColour(null, "#10b981"), "#10b981");
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

test("the trace draws the samples as a line and the area under it", async () => {
  const { tracePaths, traceOffset } = await loadSection();
  const empty = tracePaths([]);
  assert.equal(empty.line, "");
  assert.equal(empty.area, "");
  // A single reading is drawn flat across the band instead of as a lone dot.
  const single = tracePaths([50], 100, 50);
  assert.match(single.line, /^M0 [\d.]+ L100 [\d.]+$/);
  const many = tracePaths([0, 100], 100, 50);
  assert.match(many.line, /^M0\.0 /);
  assert.match(many.line, /L100\.0 /);
  // The area closes onto the baseline so the fill never leaks upwards.
  assert.equal(many.area.endsWith("L100 50 L0 50 Z"), true);
  // Higher load sits higher in the band, and the dot uses the same geometry.
  assert.ok(traceOffset(90) < traceOffset(10));
  assert.ok(traceOffset(100) >= 0 && traceOffset(0) <= 1);
  assert.equal(traceOffset(Number.NaN), traceOffset(0));
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
  // Event-driven only: no polling, no observer.
  assert.doesNotMatch(body, /setInterval\s*\(/);
  assert.doesNotMatch(body, /MutationObserver/);
});

test("the value nodes are moved into the rings, never duplicated", () => {
  const mount = source.slice(source.indexOf("function mountGauge"), source.indexOf("function mountChassis"));
  // append() moves the node; cloneNode would leave two writers of one value.
  assert.match(mount, /\.append\(value\)/);
  assert.doesNotMatch(mount, /cloneNode/);
  // Mounting twice must not build a second ring.
  assert.match(mount, /if \(card\.dataset\.dmSrvxGauge\) return/);
});

test("nothing forces a display the auto-hide writes inline on a card", () => {
  // cdAutoHide() shows and hides these cards by writing an inline display, so a
  // display:none|flex marked !important would either strand a hidden card on
  // the page or hide one the user mapped.
  const styles = source.slice(source.indexOf("function minipcShowcaseCss"));
  for (const card of [".srv-metric", ".srv-temp-card", ".srv-tel-card", ".srv-status-card"]) {
    const pattern = new RegExp(`${card.replace(".", "\\.")}\\{[^}]*display:[^};]*!important`);
    assert.doesNotMatch(styles, pattern, card);
  }
  // A block emptied by the auto-hide drops its heading too.
  assert.match(source, /cards\.every\(\(card\) => card\.style\.display === "none"\)/);
});

test("the page dresses both locales and both themes", () => {
  // Every string this module adds goes through the locale helper.
  assert.match(source, /t\("Carico CPU · live", "CPU load · live"\)/);
  assert.match(source, /t\(group\.it, group\.en\)/);
  assert.match(source, /html\[data-theme="dark"\] #page-server\.dm-srvx/);
  // Motion is decoration: it stops when the system asks for less of it.
  assert.match(source, /prefers-reduced-motion:reduce[\s\S]*?animation:none!important/);
});
