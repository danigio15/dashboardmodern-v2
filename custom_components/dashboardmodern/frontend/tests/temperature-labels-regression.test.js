import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutUrl = new URL("../src/sections/temperature-layout-section.js", import.meta.url);

test("configured Temperature rows always restore the canonical room name beside the icon", async () => {
  const source = await readFile(layoutUrl, "utf8");
  assert.match(source, /function ensureRowText\(row, room\)/);
  assert.match(source, /primary\.textContent = name/);
  assert.match(source, /data-temperature-room\]\[data-room-id\]/);
  assert.match(source, />\.ed-row-main\{\s*display:block!important/);
  assert.match(source, />\.ed-row-main>\.ed-row-new/);
});

test("Temperature editor exposes and persists custom display names for both entities", async () => {
  const source = await readFile(layoutUrl, "utf8");
  assert.match(source, /dm-temperature-name/);
  assert.match(source, /dm-humidity-name/);
  assert.match(source, /temp_name/);
  assert.match(source, /hum_name/);
  assert.match(source, /pendingLabels/);
  assert.match(source, /store\.updateItem\("rooms", id, patch\)/);
});

test("custom Temperature entity names are projected onto live dashboard labels", async () => {
  const source = await readFile(layoutUrl, "utf8");
  assert.match(source, /function repairDashboardCards\(\)/);
  assert.match(source, /\.cp-temp-current-lbl/);
  assert.match(source, /\.cp-temp-target \.lbl/);
  assert.match(source, /dmTemperatureEntityLabels/);
});

test("Temperature label hardening stays event-driven", async () => {
  const source = await readFile(layoutUrl, "utf8");
  assert.doesNotMatch(source, /MutationObserver|setInterval\s*\(/);
  assert.match(source, /store\.subscribe/);
  assert.match(source, /requestAnimationFrame/);
});
