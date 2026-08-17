// DM-FIX-20260817C
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/sections/security-showcase-section.js", import.meta.url),
  "utf8",
);

async function loadSection() {
  return import(`../src/sections/security-showcase-section.js?fix=${Date.now()}`);
}

test("camera slugs match the legacy ids the camera engine writes into", async () => {
  const { cameraSlug } = await loadSection();
  assert.equal(cameraSlug({ entity: "camera.giardino" }, 0), "cam-giardino");
  assert.equal(cameraSlug({ camera_entity: "camera.retro_casa" }, 2), "cam-retro_casa");
  assert.equal(cameraSlug({}, 4), "cam-x4");
});

test("a camera counts as offline only when Home Assistant has no usable state", async () => {
  const { cameraOffline } = await loadSection();
  const states = {
    "camera.a": { state: "streaming" },
    "camera.b": { state: "idle" },
    "camera.c": { state: "unavailable" },
    "camera.d": { state: "unknown" },
    "camera.e": { state: "" },
  };
  assert.equal(cameraOffline("camera.a", states), false);
  assert.equal(cameraOffline("camera.b", states), false);
  assert.equal(cameraOffline("camera.c", states), true);
  assert.equal(cameraOffline("camera.d", states), true);
  assert.equal(cameraOffline("camera.e", states), true);
  assert.equal(cameraOffline("camera.missing", states), true);
});

test("configured cameras are read through the legacy normalizer when it exists", async () => {
  const { securityCameras } = await loadSection();
  const previous = globalThis.getCameras;
  try {
    globalThis.getCameras = () => [{ entity: "camera.garage", name: "Garage" }];
    assert.deepEqual(securityCameras(), [{ entity: "camera.garage", name: "Garage" }]);
    globalThis.getCameras = () => {
      throw new Error("legacy runtime not booted");
    };
    assert.deepEqual(securityCameras(), []);
  } finally {
    if (previous === undefined) delete globalThis.getCameras;
    else globalThis.getCameras = previous;
  }
});

test("the redesigned alarm panel keeps every legacy runtime hook", () => {
  // The legacy render loop drives this card: it toggles .armed/.triggered on
  // #alarm-stage, writes --al-col/--al-rgb, fills the three ids below and marks
  // the active .alarm-mode-btn[data-mode]. Losing any of them silently freezes
  // the alarm panel on "CARICAMENTO".
  for (const hook of [
    'id="alarm-stage"',
    'id="alarm-icon-new"',
    'id="alarm-state-text-new"',
    'id="alarm-state-timer"',
    'data-mode="away"',
    'data-mode="night"',
    'data-mode="disarm"',
  ])
    assert.ok(source.includes(hook), hook);
  for (const service of ["alarm_arm_away", "alarm_arm_night", "alarm_disarm"])
    assert.match(source, new RegExp(`promptPinAndSet\\('\\$\\{service\\}'\\)|${service}`));
  assert.match(source, /promptPinAndSet/);
  // The timer element is hidden/shown through the legacy `.show` class.
  assert.match(source, /\.dm-sec-timer\.show/);
  // "Protetto / Intrusione" is derived from the legacy classes, not recomputed.
  assert.match(source, /\.dm-sec-alarm\.armed \.dm-sec-chip::after/);
  assert.match(source, /\.dm-sec-alarm\.triggered \.dm-sec-chip::after/);
});

test("camera cards keep the contracts the camera engine and the clock rely on", () => {
  assert.match(source, /class="cam-card dm-cam"/);
  assert.match(source, /<img id="\$\{esc\(model\.slug\)\}"/);
  assert.match(source, /class="dm-cam-time cam-time" id="time-/);
  assert.match(source, /root\.apriCamera\(slug, clean\(card\.dataset\.dmTitle\)\)/);
  assert.match(source, /id="cam-grid"/);
});

test("the section owns presentation only and never forks the streaming engine", () => {
  // The file header documents the legacy owners by name; only the code below it
  // has to stay free of them.
  const body = source.slice(source.indexOf("\nimport {"));
  for (const owned of [
    "dmCamOpen",
    "dmCamWebRTC",
    "dmCamHLS",
    "dmCamMJPEG",
    "dmCamPolling",
    "toggleFullScreenCam",
    "isPseudoFullscreen",
    "camera/stream",
  ])
    assert.doesNotMatch(body, new RegExp(owned), owned);
  // Event-driven only: no polling, no observer.
  assert.doesNotMatch(body, /setInterval\s*\(/);
  assert.doesNotMatch(body, /MutationObserver/);
});

test("the camera wall is only rebuilt when the configured cameras change", () => {
  // A blind repaint would drop every <img> already holding a live frame.
  const sync = source.slice(source.indexOf("function syncCards"), source.indexOf("export function renderSecurity"));
  assert.match(sync, /grid\._sig === signature/);
  assert.match(sync, /grid\._sig = signature/);
  assert.match(sync, /cam-card:not\(\.dm-cam\)/);
});
