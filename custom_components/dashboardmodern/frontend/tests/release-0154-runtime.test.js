import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applianceArtwork0154,
  canonicalArtworkType0154,
  isCumulativeEnergyEntity0154,
  periodPlans0154,
} from "../legacy/release-0154-runtime.js";

const totalState = (entityId, friendlyName = entityId) => ({
  entity_id: entityId,
  state: "11919.4",
  attributes: {
    friendly_name: friendlyName,
    unit_of_measurement: "kWh",
    device_class: "energy",
    state_class: "total_increasing",
  },
});

const measurementState = (entityId) => ({
  entity_id: entityId,
  state: "42.6",
  attributes: {
    unit_of_measurement: "kWh",
    device_class: "energy",
    state_class: "measurement",
  },
});

test("a cumulative entity saved in a monthly field is derived instead of shown as lifetime", () => {
  const states = {
    "sensor.solar_total": totalState("sensor.solar_total", "Produzione totale fotovoltaico"),
  };
  const energy = {
    solar: { monthly_energy: "sensor.solar_total" },
  };

  const plans = periodPlans0154(energy, "month", states);
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0], {
    kind: "month",
    group: "solar",
    slot: "dm.energy_produzione_solare_mese",
    source: "sensor.solar_total",
    entity: "sensor.solar_total",
    reason: "explicit-cumulative",
  });
});

test("a genuine monthly measurement remains the explicit period value", () => {
  const states = {
    "sensor.solar_month": measurementState("sensor.solar_month"),
  };
  const energy = {
    solar: { monthly_energy: "sensor.solar_month" },
  };

  assert.deepEqual(periodPlans0154(energy, "month", states), []);
});

test("canonical total fields still derive day, month and year", () => {
  const states = {
    "sensor.house_total": totalState("sensor.house_total"),
  };
  const energy = {
    house: { total_energy: "sensor.house_total" },
  };

  for (const kind of ["day", "month", "year"]) {
    const plans = periodPlans0154(energy, kind, states);
    assert.equal(plans.length, 1);
    assert.equal(plans[0].entity, "sensor.house_total");
    assert.equal(plans[0].reason, "canonical-total");
  }
});

test("legacy monthly overrides are derived when Home Assistant marks them total_increasing", () => {
  const states = {
    "sensor.grid_total_import": totalState("sensor.grid_total_import"),
  };
  const overrides = {
    "dm.energy_rete_acquistata_mese": "sensor.grid_total_import",
  };

  const plans = periodPlans0154({}, "month", states, overrides);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].slot, "dm.energy_rete_acquistata_mese");
  assert.equal(plans[0].reason, "legacy-cumulative");
});

test("cumulative detection uses state_class first and total naming as a safe fallback", () => {
  assert.equal(
    isCumulativeEnergyEntity0154("sensor.any_name", {
      "sensor.any_name": totalState("sensor.any_name"),
    }),
    true,
  );
  assert.equal(isCumulativeEnergyEntity0154("sensor.solarman_total_grid_energy"), true);
  assert.equal(isCumulativeEnergyEntity0154("sensor.energy_month", {
    "sensor.energy_month": measurementState("sensor.energy_month"),
  }), false);
});

test("oven, fridge, microwave and boiler share the same panel artwork contract", () => {
  const fixtures = [
    ["forno", "oven"],
    ["frigo", "fridge"],
    ["microonde", "microwave"],
    ["scaldabagno", "boiler"],
  ];

  for (const [token, canonical] of fixtures) {
    assert.equal(canonicalArtworkType0154(token), canonical);
    const markup = applianceArtwork0154(token, 96);
    assert.match(markup, /dm-appliance-art-0154/);
    assert.match(markup, /data-dm-art-style="panel"/);
    assert.match(markup, new RegExp(`data-dm-art="${canonical}"`));
    assert.match(markup, /dm-art-panel/);
    assert.match(markup, /viewBox="0 0 96 96"/);
  }
});

test("the compatibility entry imports the 0.14.14 runtime after previous layout layers", async () => {
  const entry = await readFile(new URL("../legacy/release-0152-fixes.js", import.meta.url), "utf8");
  const oldLayout = entry.indexOf('import "./appliance-media-layout-lock.js"');
  const newRuntime = entry.indexOf('import "./release-0154-runtime.js"');
  assert.ok(oldLayout >= 0);
  assert.ok(newRuntime > oldLayout);
});
