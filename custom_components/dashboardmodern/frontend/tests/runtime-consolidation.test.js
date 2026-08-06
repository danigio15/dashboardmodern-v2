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

test("closed month uses the exact exclusive next-month boundary", () => {
  const selected = new Date(2026, 4, 1);
  const range = periodRange("month", selected, new Date(2026, 7, 3));
  assert.equal(range.start.getFullYear(), 2026);
  assert.equal(range.start.getMonth(), 4);
  assert.equal(range.start.getDate(), 1);
  assert.equal(range.end.getFullYear(), 2026);
  assert.equal(range.end.getDate(), 1);
  assert.equal(range.end.getMonth(), 5);
  assert.equal(range.end.getHours(), 0);
});

test("year range is independent from selected month", () => {
  const range = periodRange("year", new Date(2025, 9, 1), new Date(2026, 7, 3));
  assert.equal(range.start.getFullYear(), 2025);
  assert.equal(range.start.getMonth(), 0);
  assert.equal(range.start.getDate(), 1);
  assert.equal(range.end.getFullYear(), 2026);
  assert.equal(range.end.getMonth(), 0);
  assert.equal(range.end.getDate(), 1);
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

test("Recorder sum growth matches Home Assistant across physical meter resets", () => {
  const baseline = { start: "2026-07-31T23:00:00Z", state: 98, sum: 11839.4 };
  const rows = [
    { start: "2026-08-01T00:00:00Z", state: 1.2, sum: 11840.6 },
    { start: "2026-08-01T01:00:00Z", state: 3.6, sum: 11843.0 },
    { start: "2026-08-01T02:00:00Z", state: 0.5, sum: 11843.5 },
  ];
  assert.ok(Math.abs(periodConsumption(rows, baseline) - 4.1) < 1e-9);
  assert.equal(periodConsumption(rows.map(({ sum: _sum, ...row }) => row), baseline), null);
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

test("production entry delegates once to the section runtime, which owns the guard", async () => {
  const loader = await readFile(new URL("../legacy/report-mobile-fixes.js", import.meta.url), "utf8");
  const prelude = await readFile(new URL("../legacy/bridge-prelude.js", import.meta.url), "utf8");
  const sections = await readFile(new URL("../src/sections/section-runtime.js", import.meta.url), "utf8");
  const energy = await readFile(new URL("../src/sections/energy-section.js", import.meta.url), "utf8");
  const stability = await readFile(
    new URL("../src/sections/energy-stability-section.js", import.meta.url),
    "utf8",
  );
  const guidance = await readFile(
    new URL("../src/sections/energy-guidance-section.js", import.meta.url),
    "utf8",
  );
  const report = await readFile(
    new URL("../src/sections/report-editor-section.js", import.meta.url),
    "utf8",
  );
  const editors = await readFile(
    new URL("../src/sections/unified-editors-section.js", import.meta.url),
    "utf8",
  );
  const applianceLayout = await readFile(
    new URL("../src/sections/appliance-layout-section.js", import.meta.url),
    "utf8",
  );
  const ev = await readFile(new URL("../src/sections/ev-section.js", import.meta.url), "utf8");
  const guard = await readFile(
    new URL("../src/transport/hosted-bridge-guard.js", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(loader, /transport\/hosted-bridge-guard\.js/);
  assert.match(loader, /sections\/section-runtime\.js/);
  assert.match(sections, /transport\/hosted-bridge-guard\.js/);
  assert.doesNotMatch(
    loader,
    /runtime-consolidated|mobile-ui-fixes|alerts-runtime|vehicle-image-runtime|release-\d+/,
  );

  for (const name of [
    "data-contracts",
    "energy",
    "energy-stability",
    "energy-guidance",
    "temperature",
    "temperature-layout",
    "appliances",
    "appliance-layout",
    "appliance-editor",
    "lights-alerts",
    "alerts",
    "unified-editors",
    "editor-crud",
    "editor-contracts",
    "report-editor",
    "shutter",
    "shutter-alert-layout",
    "ev",
  ]) {
    assert.match(sections, new RegExp(`${name}-section\\.js`));
  }

  assert.equal((energy.match(/new\s+SafeHomeAssistantBroker\s*\(/g) || []).length, 1);
  assert.match(energy, /loadEnergyPeriod\("day"/);
  assert.match(energy, /loadEnergyPeriod\("month"/);
  assert.match(energy, /loadEnergyPeriod\("year"/);
  assert.match(energy, /Promise\.all/);
  assert.match(energy, /Incomplete Home Assistant statistics/);
  assert.match(stability, /waitForHostedBridge/);
  assert.match(stability, /refreshEnergy/);
  assert.match(stability, /dm-energy-awaiting/);
  assert.match(
    guidance,
    /Seleziona il contatore totale kWh per calcolare anche i mesi precedenti/,
  );
  assert.match(guidance, /Report storico usa il contatore totale cumulativo/);
  assert.match(report, /dm-report-row-editor/);
  assert.match(report, /grid-template-areas/);
  for (const kind of ["action", "climate", "shutter", "room"])
    assert.match(editors, new RegExp(`kind === "${kind}"`));
  assert.match(applianceLayout, /border-radius:22px/);
  assert.doesNotMatch(applianceLayout, /border-radius:999px/);
  assert.match(ev, /dm-vehicle-profile-card/);
  assert.match(ev, /dm-vehicle-native-select/);
  assert.doesNotMatch(ev, /shutter|alert/i);

  assert.match(guard, /isStructurallyHostedDashboard/);
  assert.match(guard, /adoptHostedBridge/);
  assert.match(guard, /sanitizeHostedCredentials/);
  assert.match(guard, /BridgeCtor\.__dmInjectedHostedAdapter !== true/);
  assert.match(guard, /access_token: HOSTED_PLACEHOLDER/);
  assert.doesNotMatch(guard, /access_token:\s*(?:token|nativeCredential\(\)|root\.)/);
  assert.doesNotMatch(prelude, /__DASHBOARDMODERN_REAL_TOKEN__/);
  assert.doesNotMatch(prelude, /access_token/);

  for (const deleted of [
    "../legacy/mobile-ui-fixes.js",
    "../legacy/runtime-consolidated.js",
    "../src/core/alerts-runtime.js",
    "../src/core/vehicle-image-runtime.js",
    "../src/core/runtime-startup-coordinator.js",
  ]) {
    await assert.rejects(readFile(new URL(deleted, import.meta.url), "utf8"), {
      code: "ENOENT",
    });
  }
});
