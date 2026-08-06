import assert from "node:assert/strict";
import test from "node:test";

import {
  energyBalance,
  energyCost,
  energyPercentages,
  periodDelta,
  sumEnergy,
} from "../src/core/energy-calculations.js";

test("period delta supports cumulative meters and resets", () => {
  assert.equal(periodDelta(100, 125.5), 25.5);
  assert.equal(periodDelta(100, 4.5), 4.5);
  assert.equal(periodDelta("bad", 4), 4);
});

test("energy totals never become negative or NaN", () => {
  assert.equal(sumEnergy([1, "2", -5, undefined]), 3);
});

test("energy balance derives home consumption and self-consumption", () => {
  const balance = energyBalance({
    solar: 20,
    gridImport: 5,
    gridExport: 4,
    batteryCharge: 3,
    batteryDischarge: 2,
  });
  assert.deepEqual(balance, {
    production: 20,
    consumption: 20,
    imported: 5,
    exported: 4,
    charged: 3,
    discharged: 2,
    selfConsumed: 16,
  });
  assert.deepEqual(energyPercentages(balance), {
    selfConsumption: 80,
    selfSufficiency: 80,
  });
});

test("energy cost separates import cost, export credit and net cost", () => {
  assert.deepEqual(
    energyCost({ imported: 10, exported: 3 }, { importPrice: 0.3, exportPrice: 0.1 }),
    { importCost: 3, exportCredit: 0.30000000000000004, netCost: 2.7 },
  );
});
