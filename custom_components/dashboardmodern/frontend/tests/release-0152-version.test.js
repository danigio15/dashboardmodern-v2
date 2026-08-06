import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { migrateState } from "../src/core/migrations.js";

const manifestUrl = new URL("../../manifest.json", import.meta.url);
const readmeUrl = new URL("../../../../README.md", import.meta.url);
const rootIconUrl = new URL("../../../../brand/icon.png", import.meta.url);
const rootLogoUrl = new URL("../../../../brand/logo.png", import.meta.url);
const productionEntryUrl = new URL("../legacy/report-mobile-fixes.js", import.meta.url);

test("the modular regression-fix release is consistently versioned as 0.15.8", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const readme = await readFile(readmeUrl, "utf8");

  assert.equal(manifest.version, "0.15.8");
  assert.match(readme, /version-0\.15\.8/);
  assert.match(readme, /Release 0\.15\.8/);
  assert.doesNotMatch(readme, /version-0\.15\.7|Release 0\.15\.7|Novità 0\.15\.7/);
  assert.match(
    readme,
    /https:\/\/raw\.githubusercontent\.com\/danigio15\/dashboardmodern-v2\/main\/assets\/logo@2x\.png/,
  );
});

test("HACS root brand assets are shipped", async () => {
  for (const url of [rootIconUrl, rootLogoUrl]) {
    const details = await stat(url);
    assert.ok(details.isFile());
    assert.ok(details.size > 1_000);
  }
});

test("the production entry delegates once to the idempotent section runtime", async () => {
  const source = await readFile(productionEntryUrl, "utf8");
  assert.doesNotMatch(source, /transport\/hosted-bridge-guard\.js/);
  assert.match(source, /sections\/section-runtime\.js/);
  assert.doesNotMatch(
    source,
    /appliance-artwork|alerts-runtime|vehicle-image-runtime|runtime-consolidated|mobile-ui-fixes/,
  );
  assert.doesNotMatch(source, /release-\d{4}[^"']*\.js/);
  assert.doesNotMatch(source, /new MutationObserver|setInterval\s*\(/);
});

test("schema migration preserves lifetime and annual Energy sources together", () => {
  const totalOnly = migrateState({
    schema_version: 4,
    sections: {
      energy: {
        house: { total_energy: "sensor.house_total" },
        solar: { total_energy: "sensor.solar_total" },
        grid: {},
        battery: {},
        metadata: { semantics_version: 2 },
      },
    },
  }).state.sections.energy;
  assert.deepEqual(totalOnly.house, {
    total_energy: "sensor.house_total",
    annual_energy: "sensor.house_total",
  });
  assert.deepEqual(totalOnly.solar, {
    total_energy: "sensor.solar_total",
    annual_energy: "sensor.solar_total",
  });
  assert.equal(totalOnly.metadata.semantics_version, 3);

  const annualOnly = migrateState({
    schema_version: 4,
    sections: {
      energy: {
        house: { annual_energy: "sensor.house_year" },
        solar: { annual_energy: "sensor.solar_year" },
        grid: {},
        battery: {},
        metadata: { semantics_version: 2 },
      },
    },
  }).state.sections.energy;
  assert.equal(annualOnly.house.total_energy, "sensor.house_year");
  assert.equal(annualOnly.solar.total_energy, "sensor.solar_year");
  assert.equal(annualOnly.metadata.semantics_version, 3);
});
