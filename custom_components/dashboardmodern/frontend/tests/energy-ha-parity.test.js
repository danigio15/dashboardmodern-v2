import assert from "node:assert/strict";
import test from "node:test";
import { reconcileEnergyPeriod } from "../src/sections/energy-calculations-section.js";

test("home consumption matches Home Assistant energy flow balance", () => {
  const period = Object.freeze({
    house: 128.2,
    solar: 239.8,
    gridImport: 19.7,
    gridExport: 97.7,
    batteryCharged: 45.6,
    batteryDischarged: 39.6,
  });
  const reconciled = reconcileEnergyPeriod(
    period,
    new Set(["house", "solar", "gridImport", "gridExport", "batteryCharged", "batteryDischarged"]),
  );
  assert.ok(Math.abs(reconciled.house - 155.8) < 1e-9);
  assert.equal(reconciled.solar, 239.8);
  assert.equal(reconciled.gridImport, 19.7);
});

test("reported August monthly flow reproduces the Home Assistant 161 kWh house value", () => {
  const period = Object.freeze({
    house: 0,
    solar: 244,
    gridImport: 19.5,
    gridExport: 99.8,
    batteryCharged: 45.5,
    batteryDischarged: 42.5,
  });
  const reconciled = reconcileEnergyPeriod(
    period,
    new Set(["house", "solar", "gridImport", "gridExport", "batteryCharged", "batteryDischarged"]),
  );
  assert.ok(Math.abs(reconciled.house - 160.7) < 1e-9);
  assert.equal(Math.round(reconciled.house), 161);
});

test("direct home meter remains the fallback when flow sources are incomplete", () => {
  const period = Object.freeze({ house: 128.2, solar: 239.8, gridImport: 0 });
  assert.equal(reconcileEnergyPeriod(period, new Set(["house", "solar"])), period);
});
