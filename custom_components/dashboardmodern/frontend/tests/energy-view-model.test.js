import assert from "node:assert/strict";
import test from "node:test";
import { createEnergyViewModel, splitDeviceConsumption } from "../src/core/energy-view-model.js";

test("view model exposes monthly and annual financial metrics", () => {
  const model = createEnergyViewModel({
    period: { year: 2026, month: 8 },
    month: { solar: 100, house: 120, gridImport: 40, gridExport: 20, batteryCharged: 5, batteryDischarged: 5 },
    year: { solar: 1000, house: 1200, gridImport: 400, gridExport: 200 },
    rates: { importPrice: 0.3, exportPrice: 0.1 },
  });
  assert.equal(model.overview.production, 100);
  assert.equal(model.overview.consumption, 120);
  assert.equal(model.overview.importCost, 12);
  assert.equal(model.overview.exportIncome, 2);
  assert.equal(model.overview.netCost, 10);
  assert.equal(model.autonomy, 67);
  assert.equal(model.annual.importCost, 120);
});

test("device split follows the selected period grid share", () => {
  const split = splitDeviceConsumption({ house: 100, gridImport: 25 }, 20);
  assert.equal(split.grid, 5);
  assert.equal(split.solar, 15);
});

test("device split is safe with missing house consumption", () => {
  assert.deepEqual(splitDeviceConsumption({}, 10), { grid: 10, solar: 0 });
});
