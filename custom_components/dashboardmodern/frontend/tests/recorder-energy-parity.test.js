import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { periodConsumption, recorderBucketConsumptions } from "../src/core/period-service.js";

const fixture = JSON.parse(await readFile(new URL("fixtures/ha-recorder-energy.json", import.meta.url)));

test("DashboardModern equals Home Assistant Energy for reset-aware Recorder sum growth", () => {
  const value = periodConsumption(fixture.rows, fixture.baseline);
  assert.ok(Math.abs(value - fixture.home_assistant_energy) < 1e-9);
  assert.equal(value, fixture.rows.at(-1).sum - fixture.baseline.sum);
});

test("daily chart buckets use the same Recorder sum growth as the period total", () => {
  const buckets = recorderBucketConsumptions(fixture.rows, fixture.baseline);
  const total = buckets.reduce((sum, row) => sum + row.change, 0);
  assert.ok(Math.abs(total - fixture.home_assistant_energy) < 1e-9);
  assert.ok(buckets.every((row) => row.change >= 0));
});

test("a missing sample at the initial boundary uses only the preceding baseline", () => {
  const baseline = { start: "2026-07-31T23:00:00Z", sum: 100 };
  const rows = [{ start: "2026-08-01T00:17:00Z", sum: 101.25 }, { start: "2026-08-01T01:17:00Z", sum: 103.5 }];
  assert.equal(periodConsumption(rows, baseline), 3.5);
});

test("an incomplete current month uses its latest Recorder sum", () => {
  const baseline = { start: "2026-07-31T23:00:00Z", sum: 500 };
  const partial = [{ start: "2026-08-06T18:00:00Z", sum: 527.4 }];
  assert.ok(Math.abs(periodConsumption(partial, baseline) - 27.4) < 1e-9);
});

test("incompatible or unavailable rows never fall back to state or max", () => {
  assert.equal(periodConsumption([{ state: 10, max: 10 }], { state: 2, max: 2 }), null);
  assert.equal(periodConsumption([{ sum: "unavailable" }], { sum: 2 }), null);
});
