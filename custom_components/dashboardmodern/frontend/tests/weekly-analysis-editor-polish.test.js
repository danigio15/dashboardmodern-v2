import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  weekRanges,
  weeklyHomeFromValues,
  weeklySourcePlans,
} from "../src/sections/energy-analysis-section.js";

const contractsUrl = new URL("../src/sections/editor-contracts-section.js", import.meta.url);
const runtimeUrl = new URL("../src/sections/section-runtime.js", import.meta.url);

test("weekly Energy ranges compare Monday-to-now with the previous complete Monday-to-Monday week", () => {
  const now = new Date(2026, 7, 8, 17, 53, 0);
  const range = weekRanges(now);

  assert.deepEqual(
    [range.currentStart.getFullYear(), range.currentStart.getMonth(), range.currentStart.getDate()],
    [2026, 7, 3],
  );
  assert.deepEqual(
    [range.previousStart.getFullYear(), range.previousStart.getMonth(), range.previousStart.getDate()],
    [2026, 6, 27],
  );
  assert.deepEqual(
    [range.previousEnd.getFullYear(), range.previousEnd.getMonth(), range.previousEnd.getDate()],
    [2026, 7, 3],
  );
  assert.equal(range.currentEnd.getTime(), now.getTime());
});

test("weekly Home uses the same complete Home Assistant flow balance as Report", () => {
  const result = weeklyHomeFromValues(
    new Map([
      ["house", 40],
      ["solar", 70],
      ["gridImport", 20],
      ["gridExport", 10],
      ["batteryCharged", 12],
      ["batteryDischarged", 8],
    ]),
    new Set([
      "house",
      "solar",
      "gridImport",
      "gridExport",
      "batteryCharged",
      "batteryDischarged",
    ]),
  );

  assert.equal(result.value, 76);
  assert.equal(result.source, "home-assistant-flow-balance");
});

test("weekly Home keeps the House total meter as fallback when the flow boundary is incomplete", () => {
  const result = weeklyHomeFromValues(new Map([["house", 31.25]]), new Set(["house"]));
  assert.equal(result.value, 31.25);
  assert.equal(result.source, "house-total-fallback");
});

test("weekly sources use cumulative Recorder-capable meters instead of current-period helpers", () => {
  const energy = {
    house: { monthly_energy: "sensor.house_month", total_energy: "sensor.house_total" },
    solar: { monthly_energy: "sensor.solar_month", total_energy: "sensor.solar_total" },
    grid: {
      monthly_import_energy: "sensor.grid_import_month",
      monthly_export_energy: "sensor.grid_export_month",
      total_import_energy: "sensor.grid_import_total",
      total_export_energy: "sensor.grid_export_total",
    },
    battery: {},
  };
  const states = Object.fromEntries(
    ["house_total", "solar_total", "grid_import_total", "grid_export_total"].map((name) => [
      `sensor.${name}`,
      { attributes: { state_class: "total_increasing", unit_of_measurement: "kWh" } },
    ]),
  );

  const plans = weeklySourcePlans(energy, states, (value) => value);
  assert.deepEqual(
    plans.map((plan) => [plan.key, plan.entity]),
    [
      ["house", "sensor.house_total"],
      ["gridImport", "sensor.grid_import_total"],
      ["gridExport", "sensor.grid_export_total"],
      ["solar", "sensor.solar_total"],
    ],
  );
  assert.ok(plans.every((plan) => !plan.entity.includes("_month")));
});

test("canonical editor contracts own the requested mobile polish without changing the Energy engine", async () => {
  const contracts = await readFile(contractsUrl, "utf8");
  const runtime = await readFile(runtimeUrl, "utf8");

  assert.match(
    contracts,
    /grid-template-areas:\"main edit delete\" \"room room room\" \"order order order\"/,
  );
  assert.match(contracts, /ASSOCIA SENSORI/);
  assert.match(contracts, /SALVA MODIFICHE/);
  assert.match(contracts, /select\[name=\\?"icon\\?"\]/);
  assert.match(contracts, /applianceArtwork/);
  assert.match(contracts, /dmPreviewSource = "artwork"/);
  assert.match(contracts, /contatore totale kWh/);
  assert.doesNotMatch(contracts, /MutationObserver|setInterval\s*\(/);
  assert.match(runtime, /installEnergyAnalysisSection/);
  assert.doesNotMatch(runtime, /installEditorPolishSection|editor-polish-section/);
});
