import assert from "node:assert/strict";
import test from "node:test";
import {
  reconcileEnergyBundle,
  reconcileEnergyPeriod,
} from "../src/sections/energy-calculations-section.js";

test("configured Home/Casa period sensor remains authoritative", () => {
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
  assert.equal(reconciled, period);
  assert.equal(reconciled.house, 128.2);
});

test("August screenshot flows cannot overwrite a configured monthly Casa value", () => {
  const period = Object.freeze({
    house: 321.7,
    solar: 288.8,
    gridImport: 222.0,
    gridExport: 5.8,
    batteryCharged: 142.4,
    batteryDischarged: 136.3,
  });
  // Those five flow legs equal 498.9 kWh. 0.15.16 replaced the configured
  // monthly Casa value with that number; this is the real-device regression.
  const flowBalance = 288.8 + 222.0 + 136.3 - 5.8 - 142.4;
  assert.ok(Math.abs(flowBalance - 498.9) < 1e-9);

  const reconciled = reconcileEnergyPeriod(
    period,
    new Set(["house", "solar", "gridImport", "gridExport", "batteryCharged", "batteryDischarged"]),
  );
  assert.equal(reconciled.house, 321.7);
});

test("flow balance still derives Casa when no Home source is configured", () => {
  const period = Object.freeze({
    house: 0,
    solar: 288.8,
    gridImport: 222.0,
    gridExport: 5.8,
    batteryCharged: 142.4,
    batteryDischarged: 136.3,
  });
  const reconciled = reconcileEnergyPeriod(
    period,
    new Set(["solar", "gridImport", "gridExport", "batteryCharged", "batteryDischarged"]),
  );
  assert.ok(Math.abs(reconciled.house - 498.9) < 1e-9);
});

test("Monthly and Report canonical bundle keep the same configured Casa source", () => {
  const bundle = Object.freeze({
    day: Object.freeze({ house: 12.5, solar: 10, gridImport: 4 }),
    month: Object.freeze({
      house: 321.7,
      solar: 288.8,
      gridImport: 222.0,
      gridExport: 5.8,
      batteryCharged: 142.4,
      batteryDischarged: 136.3,
    }),
    year: Object.freeze({ house: 1200, solar: 900, gridImport: 500 }),
    sources: Object.freeze({
      day: { plans: [{ key: "house" }, { key: "solar" }, { key: "gridImport" }] },
      month: {
        plans: [
          { key: "house" },
          { key: "solar" },
          { key: "gridImport" },
          { key: "gridExport" },
          { key: "batteryCharged" },
          { key: "batteryDischarged" },
        ],
      },
      year: { plans: [{ key: "house" }, { key: "solar" }, { key: "gridImport" }] },
    }),
  });
  const reconciled = reconcileEnergyBundle(bundle);
  assert.equal(reconciled, bundle);
  assert.equal(reconciled.month.house, 321.7);
});
