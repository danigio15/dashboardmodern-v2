import assert from "node:assert/strict";
import test from "node:test";
import {
  hasCompleteHomeFlow,
  hasExplicitHousePeriod,
  reconcileEnergyBundle,
  reconcileEnergyPeriod,
} from "../src/sections/energy-calculations-section.js";

const COMPLETE = new Set([
  "house",
  "solar",
  "gridImport",
  "gridExport",
  "batteryCharged",
  "batteryDischarged",
]);

const plans = (keys = COMPLETE, overrides = {}) =>
  [...keys].map((key) => ({ key, ...(overrides[key] || {}) }));

test("complete flows can derive Casa when no explicit period helper exists", () => {
  const period = Object.freeze({
    house: 134.0,
    solar: 270.6,
    gridImport: 19.7,
    gridExport: 118.8,
    batteryCharged: 49.3,
    batteryDischarged: 42.9,
  });
  const reconciled = reconcileEnergyPeriod(period, COMPLETE);
  assert.notEqual(reconciled, period);
  assert.ok(Math.abs(reconciled.house - 165.1) < 1e-9);
});

test("Casa direct meter remains fallback when the electrical boundary is incomplete", () => {
  const period = Object.freeze({
    house: 134,
    solar: 270.6,
    gridImport: 19.7,
    gridExport: 118.8,
    batteryCharged: 49.3,
    batteryDischarged: 42.9,
  });
  const missingExport = new Set(["house", "solar", "gridImport"]);
  assert.equal(hasCompleteHomeFlow(missingExport), false);
  assert.equal(reconcileEnergyPeriod(period, missingExport), period);

  const halfBattery = new Set(["house", "solar", "gridImport", "gridExport", "batteryCharged"]);
  assert.equal(hasCompleteHomeFlow(halfBattery), false);
  assert.equal(reconcileEnergyPeriod(period, halfBattery), period);
});

test("batteryless installations can derive Casa from Solar and both Grid directions", () => {
  const keys = new Set(["house", "solar", "gridImport", "gridExport"]);
  assert.equal(hasCompleteHomeFlow(keys), true);
  const reconciled = reconcileEnergyPeriod(
    { house: 80, solar: 100, gridImport: 20, gridExport: 30, batteryCharged: 0, batteryDischarged: 0 },
    keys,
  );
  assert.equal(reconciled.house, 90);
});

test("explicit daily Casa helper wins over a different reconstructed flow balance", () => {
  const bundle = Object.freeze({
    day: Object.freeze({
      house: 3.4,
      solar: 1.9,
      gridImport: 0.1,
      gridExport: 0,
      batteryCharged: 1.0,
      batteryDischarged: 2.7,
    }),
    month: Object.freeze({ house: 10, solar: 10, gridImport: 0, gridExport: 0, batteryCharged: 0, batteryDischarged: 0 }),
    year: Object.freeze({ house: 10, solar: 10, gridImport: 0, gridExport: 0, batteryCharged: 0, batteryDischarged: 0 }),
    sources: Object.freeze({
      day: {
        plans: plans(COMPLETE, {
          house: { direct: true, reason: "explicit-period", source: "sensor.house_today" },
        }),
      },
      month: { plans: [{ key: "house", direct: true, reason: "explicit-period" }] },
      year: { plans: [{ key: "house", direct: true, reason: "explicit-period" }] },
    }),
  });
  assert.equal(hasExplicitHousePeriod(bundle, "day"), true);
  const reconciled = reconcileEnergyBundle(bundle);
  assert.equal(reconciled.day.house, 3.4);
  assert.equal(reconciled.day, bundle.day);
});

test("Monthly and Report canonical bundle use flow balance only where no direct Casa period helper exists", () => {
  const bundle = Object.freeze({
    day: Object.freeze({
      house: 5.7,
      solar: 7.3,
      gridImport: 0.8,
      gridExport: 1.1,
      batteryCharged: 1.4,
      batteryDischarged: 0.9,
    }),
    month: Object.freeze({
      house: 134.0,
      solar: 270.6,
      gridImport: 19.7,
      gridExport: 118.8,
      batteryCharged: 49.3,
      batteryDischarged: 42.9,
    }),
    year: Object.freeze({
      house: 760,
      solar: 900,
      gridImport: 100,
      gridExport: 40,
      batteryCharged: 95,
      batteryDischarged: 72,
    }),
    sources: Object.freeze({
      day: { plans: plans(COMPLETE, { house: { direct: true, reason: "explicit-period" } }) },
      month: { plans: plans() },
      year: { plans: plans() },
    }),
  });
  const reconciled = reconcileEnergyBundle(bundle);
  assert.equal(reconciled.day.house, 5.7);
  assert.ok(Math.abs(reconciled.month.house - 165.1) < 1e-9);
  assert.equal(reconciled.year.house, 937);
  assert.equal(reconciled.home_source, "configured-house-period+flow-fallback");
});
