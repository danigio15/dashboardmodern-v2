import test from "node:test";
import assert from "node:assert/strict";

import {
  mdiGlyph0151,
  periodDelta,
  periodRange,
} from "../legacy/release-0151-fixes.js";

test("periodDelta sums recorder change buckets", () => {
  assert.equal(periodDelta([{ change: 1.25 }, { change: 2.75 }]), 4);
});

test("periodDelta handles a total_increasing reset", () => {
  assert.equal(periodDelta([{ state: 100 }, { state: 105 }, { state: 2 }, { state: 8 }]), 13);
});

test("periodRange returns exact historical month boundaries", () => {
  const selected = new Date(2026, 4, 1);
  const now = new Date(2026, 6, 31, 12, 0, 0);
  const range = periodRange("month", selected, now);
  assert.equal(range.start.toISOString(), new Date(2026, 4, 1).toISOString());
  assert.equal(range.end.toISOString(), new Date(2026, 5, 1).toISOString());
  assert.equal(range.period, "day");
});

test("room and appliance MDI icons always have a visible fallback", () => {
  assert.equal(mdiGlyph0151("mdi:home"), "🏠");
  assert.equal(mdiGlyph0151("mdi:stove"), "♨️");
  assert.equal(mdiGlyph0151("mdi:fridge-outline"), "❄️");
  assert.notEqual(mdiGlyph0151("mdi:unknown-device"), "mdi:unknown-device");
});
