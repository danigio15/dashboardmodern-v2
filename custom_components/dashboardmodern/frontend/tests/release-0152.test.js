import assert from "node:assert/strict";
import test from "node:test";

import {
  applianceArtwork0152,
  periodConsumption0152,
  periodRange0152,
} from "../legacy/release-0152-fixes.js";

test("one lifetime statistic is never displayed as a period total", () => {
  assert.equal(periodConsumption0152([{ sum: 11884.3, state: 11884.3 }]), null);
});

test("Recorder change is summed for the selected period", () => {
  assert.equal(
    periodConsumption0152([
      { start: "2026-08-01T00:00:00Z", change: 1.2, sum: 11843.0 },
      { start: "2026-08-01T01:00:00Z", change: 2.4, sum: 11845.4 },
    ]),
    3.6,
  );
});

test("a baseline turns a single cumulative row into a real delta", () => {
  assert.equal(
    periodConsumption0152([{ sum: 9842.2 }], { sum: 9799.6 }),
    42.600000000000364,
  );
});

test("cumulative resets are handled without a negative period", () => {
  assert.equal(
    periodConsumption0152([
      { start: "2026-08-01T00:00:00Z", state: 98 },
      { start: "2026-08-01T01:00:00Z", state: 3 },
      { start: "2026-08-01T02:00:00Z", state: 8 },
    ]),
    8,
  );
});

test("day, month and year ranges use the correct Recorder buckets", () => {
  const selected = new Date(2026, 6, 1);
  const now = new Date(2026, 7, 1, 5, 30);
  assert.equal(periodRange0152("day", now, now).period, "hour");
  assert.equal(periodRange0152("month", selected, now).period, "day");
  assert.equal(periodRange0152("year", selected, now).period, "month");
});

test("fridge and boiler use filled dedicated artwork", () => {
  const fridge = applianceArtwork0152("frigo", 76);
  const boiler = applianceArtwork0152("scaldabagno", 76);
  assert.match(fridge, /data-dm-art="fridge"/);
  assert.match(fridge, /fill="#0f2942"/);
  assert.match(boiler, /data-dm-art="boiler"/);
  assert.match(boiler, /fill="#0f2942"/);
  assert.equal(applianceArtwork0152("forno", 76), "");
});
