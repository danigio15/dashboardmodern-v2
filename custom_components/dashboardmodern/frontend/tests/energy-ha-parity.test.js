import assert from "node:assert/strict";
import test from "node:test";
import {
  hasCompleteHomeFlow,
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

test("real August Home Assistant flows produce the same Casa value", () => {
  const period = Object.freeze({
    // Solarman total_load_consumption shown by DashboardModern after 0.15.17.
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

test("Monthly and Report canonical bundle share the HA-style Casa balance", () => {
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
      day: { plans: [...COMPLETE].map((key) => ({ key })) },
      month: { plans: [...COMPLETE].map((key) => ({ key })) },
      year: { plans: [...COMPLETE].map((key) => ({ key })) },
    }),
  });
  const reconciled = reconcileEnergyBundle(bundle);
  assert.ok(Math.abs(reconciled.month.house - 165.1) < 1e-9);
  assert.equal(reconciled.home_source, "home-assistant-flow-balance");
  assert.equal(reconciled.year.house, 937);
});
