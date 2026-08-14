import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const temperatureUrl = new URL("../src/sections/temperature-section.js", import.meta.url);
const layoutUrl = new URL("../src/sections/temperature-layout-section.js", import.meta.url);
const migrationsUrl = new URL("../src/core/migrations.js", import.meta.url);

test("Temperature configured rows keep a visible room name beside the icon", async () => {
  const source = await readFile(temperatureUrl, "utf8");
  assert.match(source, /function normalizeTemperatureConfiguredRows\(\)/);
  assert.match(source, /primary\.textContent = name/);
  assert.match(source, /width:auto!important/);
  assert.match(source, /grid-template-columns:56px minmax\(0,1fr\) 48px 48px/);
});

test("Temperature optional entity names are canonical room fields", async () => {
  const source = await readFile(migrationsUrl, "utf8");
  assert.match(source, /temp_name: String\(room\.temp_name \|\| room\.temperature_name \|\| ""\)/);
  assert.match(source, /hum_name: String\(room\.hum_name \|\| room\.humidity_name \|\| ""\)/);
});

test("Temperature editor exposes and persists both optional display names", async () => {
  const source = await readFile(layoutUrl, "utf8");
  assert.match(source, /dm-temperature-name/);
  assert.match(source, /dm-humidity-name/);
  assert.match(source, /pendingLabels/);
  assert.match(source, /store\.updateItem\("rooms", id, patch\)/);
  assert.doesNotMatch(source, /MutationObserver|setInterval\s*\(/);
});

test("legacy real-device row repair cannot overwrite custom Temperature names with raw entity ids", async () => {
  const source = await readFile(
    new URL("../src/sections/beta16-real-device-layout-section.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /room\.temp_name \|\| room\.temperature_name/);
  assert.match(source, /room\.hum_name \|\| room\.humidity_name/);
  assert.match(source, /nodes\.secondary\.textContent = labels\.join\(" · "\)/);
});

test("Temperature card renders optional entity names below the room and preserves generic metric labels", async () => {
  const source = await readFile(temperatureUrl, "utf8");
  assert.match(source, /temp-room-entity-name/);
  assert.match(source, /roomCopy\.append\(name, entityName\)/);
  assert.match(source, /entityName\.textContent = labels\.join\(" · "\)/);
  assert.match(source, /cp-temp-current-lbl/);
  assert.match(source, /cp-temp-target/);
});
