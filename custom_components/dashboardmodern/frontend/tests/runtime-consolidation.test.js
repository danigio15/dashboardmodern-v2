import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  periodConsumption,
  periodRange,
  sourcePlans,
} from "../src/core/period-service.js";

const totalState = (id) => ({
  entity_id: id,
  state: "9000",
  attributes: {
    unit_of_measurement: "kWh",
    device_class: "energy",
    state_class: "total_increasing",
  },
});

test("closed month ends before the next month baseline boundary", () => {
  const selected = new Date(2026, 4, 1);
  const range = periodRange("month", selected, new Date(2026, 7, 3));
  assert.equal(range.start.getFullYear(), 2026);
  assert.equal(range.start.getMonth(), 4);
  assert.equal(range.start.getDate(), 1);
  assert.equal(range.end.getFullYear(), 2026);
  assert.equal(range.end.getMonth(), 4);
  assert.equal(range.end.getDate(), 31);
  assert.equal(range.end.getHours(), 23);
  assert.equal(range.end.getMinutes(), 59);
  assert.equal(range.end.getSeconds(), 59);
  assert.equal(range.end.getMilliseconds(), 999);
});

test("year range is independent from selected month", () => {
  const range = periodRange("year", new Date(2025, 9, 1), new Date(2026, 7, 3));
  assert.equal(range.start.getFullYear(), 2025);
  assert.equal(range.start.getMonth(), 0);
  assert.equal(range.start.getDate(), 1);
  assert.equal(range.end.getFullYear(), 2025);
  assert.equal(range.end.getMonth(), 11);
  assert.equal(range.end.getDate(), 31);
  assert.equal(range.end.getMilliseconds(), 999);
  assert.equal(range.period, "month");
});

test("current year range ends at now instead of reusing the selected month", () => {
  const now = new Date(2026, 7, 3, 14, 30, 0, 0);
  const range = periodRange("year", new Date(2026, 4, 1), now);
  assert.equal(range.start.getTime(), new Date(2026, 0, 1).getTime());
  assert.equal(range.end.getTime(), now.getTime());
});

test("appliance cumulative total is converted to selected-period delta", () => {
  assert.equal(periodConsumption([{ sum: 9100 }], { sum: 9000 }), 100);
  assert.equal(periodConsumption([{ sum: 9100 }]), null);
});

test("canonical total sensor is the period source for home energy", () => {
  const states = { "sensor.house_total": totalState("sensor.house_total") };
  const plans = sourcePlans(
    { house: { total_energy: "sensor.house_total" } },
    "month",
    states,
  );
  assert.equal(plans.length, 1);
  assert.equal(plans[0].key, "house");
  assert.equal(plans[0].entity, "sensor.house_total");
  assert.equal(plans[0].direct, false);
  assert.equal(plans[0].reason, "canonical-total");
});

test("production loader owns one atomic runtime without patch cascades", async () => {
  const loader = await readFile(new URL("../legacy/report-mobile-fixes.js", import.meta.url), "utf8");
  const mobile = await readFile(new URL("../legacy/mobile-ui-fixes.js", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../legacy/runtime-consolidated.js", import.meta.url), "utf8");

  assert.match(loader, /runtime-consolidated\.js/);
  assert.doesNotMatch(loader, /release-\d+|runtime-real-ha|runtime-residual|runtime-release-owner/);
  assert.doesNotMatch(mobile, /new\s+MutationObserver/);
  assert.doesNotMatch(mobile, /setInterval\s*\(/);
  assert.doesNotMatch(runtime, /new\s+MutationObserver/);
  assert.doesNotMatch(runtime, /setInterval\s*\(/);
  assert.equal((runtime.match(/new\s+HomeAssistantBroker\s*\(/g) || []).length, 1);
  assert.match(runtime, /loadEnergyPeriod\("day"/);
  assert.match(runtime, /loadEnergyPeriod\("month"/);
  assert.match(runtime, /loadEnergyPeriod\("year"/);
  assert.match(runtime, /Promise\.all/);
});
