import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isCumulativeEnergyEntity,
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

const measurementState = (id) => ({
  entity_id: id,
  state: "42.6",
  attributes: {
    unit_of_measurement: "kWh",
    device_class: "energy",
    state_class: "measurement",
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

test("Recorder change buckets are summed and meter resets stay non-negative", () => {
  assert.ok(
    Math.abs(
      periodConsumption([
        { start: "2026-08-01T00:00:00Z", change: 1.2, sum: 11843.0 },
        { start: "2026-08-01T01:00:00Z", change: 2.4, sum: 11845.4 },
      ]) - 3.6,
    ) < 1e-9,
  );
  assert.equal(
    periodConsumption([
      { start: "2026-08-01T00:00:00Z", state: 98 },
      { start: "2026-08-01T01:00:00Z", state: 3 },
      { start: "2026-08-01T02:00:00Z", state: 8 },
    ]),
    8,
  );
});

test("canonical total sensor derives every Energy period", () => {
  const states = { "sensor.house_total": totalState("sensor.house_total") };
  for (const kind of ["day", "month", "year"]) {
    const plans = sourcePlans({ house: { total_energy: "sensor.house_total" } }, kind, states);
    assert.equal(plans.length, 1);
    assert.equal(plans[0].key, "house");
    assert.equal(plans[0].entity, "sensor.house_total");
    assert.equal(plans[0].direct, false);
    assert.equal(plans[0].reason, "canonical-total");
  }
});

test("cumulative monthly fields are derived while genuine measurements remain direct", () => {
  const cumulative = sourcePlans(
    { solar: { monthly_energy: "sensor.solar_total" } },
    "month",
    { "sensor.solar_total": totalState("sensor.solar_total") },
  )[0];
  assert.equal(cumulative.direct, false);
  assert.equal(cumulative.reason, "explicit-cumulative");

  const direct = sourcePlans(
    { solar: { monthly_energy: "sensor.solar_month" } },
    "month",
    { "sensor.solar_month": measurementState("sensor.solar_month") },
  )[0];
  assert.equal(direct.direct, true);
  assert.equal(direct.reason, "explicit-period");
});

test("legacy overrides still classify total increasing meters safely", () => {
  const plans = sourcePlans(
    {},
    "month",
    { "sensor.grid_total_import": totalState("sensor.grid_total_import") },
    { "dm.energy_rete_acquistata_mese": "sensor.grid_total_import" },
  );
  assert.equal(plans.length, 1);
  assert.equal(plans[0].slot, "dm.energy_rete_acquistata_mese");
  assert.equal(plans[0].reason, "legacy-cumulative");
  assert.equal(isCumulativeEnergyEntity("sensor.solarman_total_grid_energy"), true);
  assert.equal(
    isCumulativeEnergyEntity("sensor.energy_month", {
      "sensor.energy_month": measurementState("sensor.energy_month"),
    }),
    false,
  );
});

test("production entry delegates to imported section owners", async () => {
  const loader = await readFile(new URL("../legacy/report-mobile-fixes.js", import.meta.url), "utf8");
  const mobile = await readFile(new URL("../legacy/mobile-ui-fixes.js", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../legacy/runtime-consolidated.js", import.meta.url), "utf8");
  const sections = await readFile(new URL("../src/sections/section-runtime.js", import.meta.url), "utf8");
  const energy = await readFile(new URL("../src/sections/energy-section.js", import.meta.url), "utf8");
  const guard = await readFile(new URL("../src/transport/hosted-bridge-guard.js", import.meta.url), "utf8");

  assert.match(loader, /sections\/section-runtime\.js/);
  assert.match(runtime, /sections\/energy-section\.js/);
  assert.match(runtime, /sections\/lights-alerts-section\.js/);
  for (const name of ["energy", "temperature", "appliances", "lights-alerts", "editor-crud"])
    assert.match(sections, new RegExp(`${name}-section\\.js`));
  assert.doesNotMatch(loader, /release-\d+|runtime-real-ha|runtime-residual|runtime-release-owner/);
  assert.doesNotMatch(runtime, /HomeAssistantBroker|setInterval\s*\(/);
  assert.doesNotMatch(mobile, /setInterval\s*\(|new\s+MutationObserver/);
  assert.equal((energy.match(/new\s+SafeHomeAssistantBroker\s*\(/g) || []).length, 1);
  assert.match(energy, /loadEnergyPeriod\("day"/);
  assert.match(energy, /loadEnergyPeriod\("month"/);
  assert.match(energy, /loadEnergyPeriod\("year"/);
  assert.match(energy, /Promise\.all/);
  assert.match(energy, /Incomplete Home Assistant statistics/);
  assert.match(guard, /sanitizeHostedCredentials/);
  assert.doesNotMatch(guard, /send\s*\(.*access_token/);
});
