import assert from "node:assert/strict";
import test from "node:test";

import {
  periodValue0153,
  statisticsRequest0153,
} from "../legacy/energy-monthly-report-media-fixes.js";

test("Recorder compatibility request never sends change inside types", () => {
  const previous = globalThis.resolveEntity;
  globalThis.resolveEntity = (entityId) =>
    entityId === "dm.energy_consumo_casa_mese" ? "sensor.total_house_energy" : entityId;
  try {
    const request = statisticsRequest0153(
      ["dm.energy_consumo_casa_mese", "sensor.appliance_total"],
      "2026-08-01T00:00:00Z",
      "2026-08-02T00:00:00Z",
      "day",
    );
    assert.equal(request.type, "recorder/statistics_during_period");
    assert.deepEqual(request.statistic_ids, [
      "sensor.total_house_energy",
      "sensor.appliance_total",
    ]);
    assert.equal(request.period, "day");
    assert.equal("types" in request, false);
  } finally {
    if (previous === undefined) delete globalThis.resolveEntity;
    else globalThis.resolveEntity = previous;
  }
});

test("monthly Report values sum Recorder changes", () => {
  assert.equal(
    periodValue0153([
      { start: "2026-08-01T00:00:00Z", change: 1.4, sum: 901.4 },
      { start: "2026-08-02T00:00:00Z", change: 2.6, sum: 904.0 },
    ]),
    4,
  );
});

test("monthly Report values use the pre-period baseline for cumulative totals", () => {
  assert.equal(periodValue0153([{ sum: 1042.6 }], { sum: 1000 }), 42.6);
});

test("cumulative meter resets stay non-negative in the Report", () => {
  assert.equal(
    periodValue0153([
      { start: "2026-08-01T00:00:00Z", sum: 98 },
      { start: "2026-08-02T00:00:00Z", sum: 3 },
      { start: "2026-08-03T00:00:00Z", sum: 8 },
    ]),
    8,
  );
});
