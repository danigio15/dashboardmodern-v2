import assert from "node:assert/strict";
import test from "node:test";
import { createEnergyBundleService } from "../src/core/energy-bundle-service.js";

const periodResult = (value) => ({
  data: { solar: value },
  complete: true,
  missing: [],
  plans: [],
  values: new Map(),
});

test("atomic bundle loads day, month, year and device periods together", async () => {
  const energyCalls = [];
  const deviceCalls = [];
  const service = createEnergyBundleService({
    now: () => new Date(2026, 7, 6),
    loadEnergyPeriod: async (kind, date) => {
      energyCalls.push([kind, date.getFullYear(), date.getMonth() + 1]);
      return periodResult({ day: 1, month: 2, year: 3 }[kind]);
    },
    loadDevicePeriod: async (kind, date) => {
      deviceCalls.push([kind, date.getFullYear(), date.getMonth() + 1]);
      return { devices: [], values: new Map() };
    },
    readRates: () => ({ importPrice: 0.3, exportPrice: 0.1 }),
  });

  const bundle = await service.load({ year: 2025, month: 4 });
  assert.equal(bundle.day.solar, 1);
  assert.equal(bundle.month.solar, 2);
  assert.equal(bundle.year.solar, 3);
  assert.deepEqual(energyCalls, [
    ["day", 2026, 8],
    ["month", 2025, 4],
    ["year", 2025, 4],
  ]);
  assert.deepEqual(deviceCalls, [
    ["month", 2025, 4],
    ["year", 2025, 4],
  ]);
  assert.equal(bundle.rates.importPrice, 0.3);
});

test("an incomplete period rejects the whole atomic bundle", async () => {
  const service = createEnergyBundleService({
    loadEnergyPeriod: async (kind) =>
      kind === "month"
        ? {
            data: {},
            complete: false,
            missing: [{ group: "grid", key: "month", entity: "sensor.grid_total" }],
          }
        : periodResult(1),
    loadDevicePeriod: async () => ({ devices: [], values: new Map() }),
    readRates: () => ({}),
  });
  await assert.rejects(
    service.load({ year: 2026, month: 8 }),
    /month:grid\.month:sensor\.grid_total/,
  );
});

test("a newer load invalidates an older in-flight result", async () => {
  let resolveFirst;
  const first = new Promise((resolve) => { resolveFirst = resolve; });
  let calls = 0;
  const service = createEnergyBundleService({
    loadEnergyPeriod: async () => {
      calls += 1;
      if (calls === 1) return first;
      return periodResult(2);
    },
    loadDevicePeriod: async () => ({ devices: [], values: new Map() }),
    readRates: () => ({}),
  });
  const oldLoad = service.load({ year: 2026, month: 7 });
  const newLoad = service.load({ year: 2026, month: 8 });
  resolveFirst(periodResult(1));
  assert.equal(await oldLoad, null);
  assert.ok(await newLoad);
});
