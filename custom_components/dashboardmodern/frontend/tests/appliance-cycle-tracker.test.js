// DM-FIX-20260816A
import assert from "node:assert/strict";
import test from "node:test";
import { createCycleTracker } from "../src/core/appliance-cycle-tracker.js";

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    dump: () => Object.fromEntries(map),
  };
}

function fakeClock(start) {
  let value = start;
  const now = () => value;
  now.advance = (ms) => {
    value += ms;
    return value;
  };
  return now;
}

const T0 = Date.parse("2026-08-16T09:55:00");

test("a full cycle produces start, duration and integrated energy", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage, now: clock });

  tracker.update([{ id: "washer", mode: "running", watts: 2000 }]);
  assert.equal(tracker.record("washer").active.startMs, T0);

  for (let i = 0; i < 9; i += 1) {
    clock.advance(60000);
    tracker.update([{ id: "washer", mode: "running", watts: 2000 }]);
  }
  clock.advance(60000);
  tracker.update([{ id: "washer", mode: "off", watts: 0 }]);

  const record = tracker.record("washer");
  assert.equal(record.active, undefined);
  assert.equal(record.last.startMs, T0);
  assert.equal(record.last.durationMinutes, 10);
  // 2000 W sustained for 9 minutes of samples ≈ 0.30 kWh via trapezoids.
  assert.ok(Math.abs(record.last.kwh - 0.3) < 0.02, `kwh was ${record.last.kwh}`);
});

test("daily-energy delta wins over the power integral and survives resets", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage, now: clock });

  tracker.update([{ id: "oven", mode: "running", watts: 1000, dailyKwh: 1.0 }]);
  clock.advance(30 * 60000);
  tracker.update([{ id: "oven", mode: "running", watts: 1000, dailyKwh: 1.6 }]);
  clock.advance(60000);
  tracker.update([{ id: "oven", mode: "standby", watts: 1, dailyKwh: 1.62 }]);

  const record = tracker.record("oven");
  assert.equal(record.last.durationMinutes, 31);
  assert.ok(Math.abs(record.last.kwh - 0.62) < 0.001, `kwh was ${record.last.kwh}`);
});

test("short blips without measurable energy are discarded", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage, now: clock });
  tracker.update([{ id: "tv", mode: "running", watts: 40 }]);
  clock.advance(10000);
  tracker.update([{ id: "tv", mode: "off", watts: 0 }]);
  assert.equal(tracker.record("tv").last, undefined);
});

test("the max remaining seconds seen during a cycle is kept as ring total", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage, now: clock });
  tracker.update([{ id: "washer", mode: "running", watts: 500, remainingSeconds: 3500 }]);
  clock.advance(60000);
  tracker.update([{ id: "washer", mode: "running", watts: 500, remainingSeconds: 3600 }]);
  clock.advance(60000);
  tracker.update([{ id: "washer", mode: "running", watts: 500, remainingSeconds: 3400 }]);
  assert.equal(tracker.record("washer").active.maxRemainingSeconds, 3600);
});

test("state persists across tracker instances via storage", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const first = createCycleTracker({ storage, now: clock });
  first.update([{ id: "washer", mode: "running", watts: 1500 }]);
  clock.advance(5 * 60000);
  first.update([{ id: "washer", mode: "running", watts: 1500 }]);

  const second = createCycleTracker({ storage, now: clock });
  clock.advance(60000);
  second.update([{ id: "washer", mode: "off", watts: 0 }]);
  assert.equal(second.record("washer").last.durationMinutes, 6);
});

test("long gaps are clamped so sleeping tabs cannot inflate the integral", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage, now: clock });
  tracker.update([{ id: "washer", mode: "running", watts: 2000 }]);
  clock.advance(60 * 60000); // one silent hour
  tracker.update([{ id: "washer", mode: "running", watts: 2000 }]);
  clock.advance(60000);
  tracker.update([{ id: "washer", mode: "off", watts: 0 }]);
  // Only 5 clamped minutes + 1 minute are integrated, not the whole hour.
  assert.ok(tracker.record("washer").last.kwh < 0.25, `kwh was ${tracker.record("washer").last.kwh}`);
});

test("unavailable freezes the cycle instead of closing or integrating it", () => {
  const storage = fakeStorage();
  const clock = fakeClock(T0);
  const tracker = createCycleTracker({ storage, now: clock });
  tracker.update([{ id: "washer", mode: "running", watts: 2000 }]);
  clock.advance(60000);
  tracker.update([{ id: "washer", mode: "unavailable", watts: null }]);
  clock.advance(60000);
  tracker.update([{ id: "washer", mode: "running", watts: 2000 }]);
  assert.ok(tracker.record("washer").active, "cycle survives the unavailable gap");
  clock.advance(120000);
  tracker.update([{ id: "washer", mode: "off", watts: 0 }]);
  assert.equal(tracker.record("washer").last.startMs, T0);
});
