import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const guardUrl = new URL("../src/sections/beta17-final-icon-polish-section.js", import.meta.url);
const layoutUrl = new URL("../src/sections/temperature-layout-section.js", import.meta.url);

test("configured Temperature rows restore the canonical room name beside the icon", async () => {
  const source = await readFile(guardUrl, "utf8");
  assert.match(source, /function ensureTemperatureRowMain\(row, room\)/);
  assert.match(source, /primary\.textContent = name/);
  assert.match(source, /data-temperature-room\]\[data-room-id\]/);
  assert.match(source, /dmTemperatureNameVisible/);
  assert.match(source, /style\.setProperty\("display", "block", "important"\)/);
});

test("Temperature editor exposes and persists custom display names for both entities", async () => {
  const source = await readFile(guardUrl, "utf8");
  assert.match(source, /dm-temperature-name/);
  assert.match(source, /dm-humidity-name/);
  assert.match(source, /temp_name/);
  assert.match(source, /hum_name/);
  assert.match(source, /pendingLabels/);
  assert.match(source, /store\.updateItem\("rooms", id, patch\)/);
});

test("custom Temperature entity names are projected onto live dashboard labels", async () => {
  const source = await readFile(guardUrl, "utf8");
  assert.match(source, /function repairTemperatureDashboardLabels\(\)/);
  assert.match(source, /\.cp-temp-current-lbl/);
  assert.match(source, /\.cp-temp-target \.lbl/);
  assert.match(source, /dmBeta20TemperatureEntityLabels/);
});

test("Beta20 label hardening reuses an existing scoped owner and keeps the layout shim passive", async () => {
  const source = await readFile(guardUrl, "utf8");
  const layout = await readFile(layoutUrl, "utf8");
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.match(source, /store\.subscribe/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(layout, /return false/);
  assert.doesNotMatch(layout, /installStyle|setInterval|MutationObserver|querySelector|innerHTML/);
});