import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";
import { migrateState } from "../src/core/migrations.js";

const manifestUrl = new URL("../../manifest.json", import.meta.url);
const readmeUrl = new URL("../../../../README.md", import.meta.url);
const rootIconUrl = new URL("../../../../brand/icon.png", import.meta.url);
const rootLogoUrl = new URL("../../../../brand/logo.png", import.meta.url);
const bootstrapUrl = new URL("../legacy/config.js", import.meta.url);
const buildInfoUrl = new URL("../legacy/build-info.js", import.meta.url);
const obsoleteEntryUrl = new URL("../legacy/report-mobile-fixes.js", import.meta.url);
const historyUrl = new URL("../src/sections/history-section.js", import.meta.url);
const refreshUrl = new URL("../src/sections/energy-refresh-section.js", import.meta.url);

test("the Energy parity, refresh and history release is consistently versioned as 0.15.18", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const readme = await readFile(readmeUrl, "utf8");
  const buildInfo = await readFile(buildInfoUrl, "utf8");

  assert.equal(manifest.version, "0.15.18");
  assert.match(readme, /version-0\.15\.18/);
  assert.match(readme, /Novità 0\.15\.18/);
  assert.match(readme, /165,1 kWh/);
  assert.match(readme, /history\/history_during_period/);
  assert.match(readme, /Mese\/Anno al periodo corrente/);
  assert.match(
    readme,
    /https:\/\/raw\.githubusercontent\.com\/danigio15\/dashboardmodern-v2\/main\/brand\/logo\.png/,
  );
  assert.doesNotMatch(readme, /main\/assets\/logo|brand\/logo@2x\.png/);
  assert.match(buildInfo, /["']?integrationVersion["']?\s*:\s*["']0\.15\.18["']/);
  assert.match(buildInfo, /["']?dashboardVersion["']?\s*:\s*["']0\.15\.18["']/);
  assert.match(buildInfo, /["']?moduleVersion["']?\s*:\s*14/);
});

test("canonical history does not use the legacy REST token transport", async () => {
  const history = await readFile(historyUrl, "utf8");
  assert.match(history, /history\/history_during_period/);
  assert.match(history, /DashboardModernEnergyService\?\.broker/);
  assert.doesNotMatch(history, /LONG_LIVED_TOKEN|\/api\/history\/period|fetch\s*\(/);
});

test("Energy refresh owns initial current-period synchronization", async () => {
  const refresh = await readFile(refreshUrl, "utf8");
  assert.match(refresh, /dashboardmodern:states-ready/);
  assert.match(refresh, /month\.dataset\.init/);
  assert.match(refresh, /DashboardModernEnergyService/);
});

test("local package brand assets remain valid", async () => {
  for (const url of [rootIconUrl, rootLogoUrl]) {
    const details = await stat(url);
    assert.ok(details.isFile());
    assert.ok(details.size > 1_000);
  }
});

test("the hosted bootstrap delegates once to the idempotent section runtime", async () => {
  const source = await readFile(bootstrapUrl, "utf8");
  assert.match(source, /__DASHBOARDMODERN_LEGACY_READY__/);
  assert.match(source, /DashboardModernModules/);
  assert.match(source, /\.\.\/src\/sections\/section-runtime\.js/);
  assert.doesNotMatch(source, /report-mobile-fixes|setInterval\s*\(|MutationObserver/);
  await assert.rejects(access(obsoleteEntryUrl));
});

test("schema migration aliases legacy annual/lifetime values once and preserves later blanks", () => {
  const legacy = migrateState({
    schema_version: 4,
    sections: {
      energy: {
        house: { total_energy: "sensor.house_total" },
        solar: { annual_energy: "sensor.solar_year" },
        grid: {},
        battery: {},
        metadata: { semantics_version: 2 },
      },
    },
  }).state.sections.energy;
  assert.equal(legacy.house.annual_energy, "sensor.house_total");
  assert.equal(legacy.solar.total_energy, "sensor.solar_year");
  assert.equal(legacy.metadata.semantics_version, 4);

  legacy.house.annual_energy = "";
  const saved = migrateState({ schema_version: 4, sections: { energy: legacy } }).state.sections.energy;
  assert.equal(saved.house.annual_energy, "");
  assert.equal(saved.house.total_energy, "sensor.house_total");
  assert.equal(saved.metadata.semantics_version, 4);
});
