// DM-FIX-20260816A
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { applianceCardModel } from "../src/core/appliance-card-view-model.js";

const NOW = Date.parse("2026-08-16T10:30:00");

async function loadSection() {
  return import(`../src/sections/appliance-showcase-section.js?fix=${Date.now()}`);
}

function washerModel(overrides = {}) {
  return applianceCardModel(
    {
      id: "appl-washer",
      name: "Lavatrice",
      visual_key: "lavatrice",
      device_type: "lavatrice",
      power_entity: "sensor.washer_power",
      remaining_entity: "sensor.washer_left",
      cycle_minutes: 60,
      threshold_run: 5,
      control_entity: "switch.washer",
      total_energy_entity: "sensor.washer_total",
      history_entity: "sensor.washer_total",
      room_id: "room-laundry",
      ...overrides,
    },
    {
      "sensor.washer_power": { state: "1900", attributes: { unit_of_measurement: "W" } },
      "sensor.washer_left": { state: "30", attributes: { unit_of_measurement: "min" } },
      "switch.washer": { state: "on", attributes: {} },
      "sensor.washer_total": {
        state: "412",
        attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
      },
    },
    {
      rooms: [{ id: "room-laundry", name: "Lavanderia" }],
      locale: "it",
      now: NOW,
      priceKwh: 0.25,
      index: 3,
    },
  );
}

function offModel(id, name, index = 0) {
  return applianceCardModel(
    { id, name, visual_key: "asciugatrice", power_entity: "sensor.none" },
    {},
    { locale: "it", now: NOW, index },
  );
}

test("filter and sort helpers implement the sidebar and chip semantics", async () => {
  const { filterShowcaseModels, showcaseCounts } = await loadSection();
  const running = washerModel();
  const off = offModel("appl-dryer", "Asciugatrice", 1);
  const models = [off, running];

  const counts = showcaseCounts(models);
  assert.equal(counts.total, 2);
  assert.equal(counts.running, 1);
  assert.equal(counts.off, 1);
  assert.equal(counts.rooms.get("room-laundry"), 1);
  assert.equal(counts.unassigned, 1);
  assert.equal(Math.round(counts.watts), 1900);

  const byPower = filterShowcaseModels(models, { filter: "all", room: "all", sort: "power-desc" });
  assert.deepEqual(
    byPower.map((model) => model.id),
    ["appl-washer", "appl-dryer"],
  );
  assert.deepEqual(
    filterShowcaseModels(models, { filter: "running", room: "all" }).map((model) => model.id),
    ["appl-washer"],
  );
  assert.deepEqual(
    filterShowcaseModels(models, { filter: "all", room: "unassigned" }).map((model) => model.id),
    ["appl-dryer"],
  );
  assert.deepEqual(
    filterShowcaseModels(models, { filter: "all", room: "room-laundry" }).map((model) => model.id),
    ["appl-washer"],
  );
});

test("sparkline path stays inside the viewbox and closes the area", async () => {
  const { sparklinePath } = await loadSection();
  const { line, area } = sparklinePath([0, 500, 2450, 1200], 100, 28);
  assert.match(line, /^M0 25/);
  assert.match(line, /L100 /);
  assert.match(area, /L0 28 Z$/);
  const flat = sparklinePath([], 100, 28);
  assert.match(flat.line, /^M0 25 L100 25$/);
});

test("card markup carries the legacy contract hooks and the reference layout", async () => {
  const { buildCardMarkup } = await loadSection();
  const markup = buildCardMarkup(washerModel());
  // legacy/e2e contract hooks
  assert.match(markup, /appl-wide-card/);
  assert.match(markup, /data-appliance-id="appl-washer"/);
  assert.match(markup, /appl-wide-name/);
  assert.match(markup, /data-dm-power-toggle="true"/);
  // reference design pieces
  assert.match(markup, /IN FUNZIONE/);
  assert.match(markup, /dm-ap-ring/);
  assert.match(markup, /0:30/);
  assert.match(markup, /RIMANENTI/);
  assert.match(markup, /Potenza attuale/);
  assert.match(markup, /1\.9 kW/);
  assert.match(markup, /Ultimo ciclo/);
  assert.match(markup, /Avvio/);
  assert.match(markup, /Durata/);
  assert.match(markup, /Consumo/);
  assert.match(markup, /Costo/);
  // running animations are driven by these class/data hooks: the hero SVG
  // exposes the drum group the CSS spins while the appliance runs
  assert.match(markup, /is-run/);
  assert.match(markup, /data-art="washer"/);
  assert.match(markup, /data-dm-hero="washer"/);
  assert.match(markup, /dmh-drum/);
  // history button reuses the storico popup with the cumulative meter
  assert.match(markup, /data-dm-history="sensor\.washer_total"/);
});

test("temperature cards render the fridge strip instead of the power meter", async () => {
  const { buildCardMarkup } = await loadSection();
  const fridge = applianceCardModel(
    {
      id: "appl-fridge",
      name: "Frigorifero",
      visual_key: "frigo",
      power_entity: "sensor.fridge_power",
      temperature_entity: "sensor.fridge_temp",
      threshold_run: 60,
    },
    {
      "sensor.fridge_power": { state: "2", attributes: { unit_of_measurement: "W" } },
      "sensor.fridge_temp": { state: "4", attributes: { unit_of_measurement: "°C" } },
    },
    { locale: "it", now: NOW, index: 2 },
  );
  const markup = buildCardMarkup(fridge);
  assert.match(markup, /Temperatura/);
  assert.match(markup, /4 °C/);
  assert.match(markup, /dm-ap-bar cold/);
  assert.doesNotMatch(markup, /Potenza attuale/);
  assert.match(markup, /data-dm-hero="fridge"/);
  assert.match(markup, /dmh-light/);
});

test("off cards show the muted meter and no countdown ring", async () => {
  const { buildCardMarkup } = await loadSection();
  const markup = buildCardMarkup(offModel("appl-dryer", "Asciugatrice"));
  assert.match(markup, /SPENTO/);
  assert.match(markup, /0 W/);
  assert.doesNotMatch(markup, /dm-ap-ring/);
  assert.doesNotMatch(markup, /dm-ap-fx/);
});

test("the hero artwork covers every catalog type with animatable mechanisms", async () => {
  const { applianceHeroArtwork, HERO_ARTWORK_TYPES } = await import(
    "../src/core/appliance-hero-artwork.js"
  );
  const expected = [
    "washer", "dryer", "dishwasher", "oven", "microwave", "fridge", "freezer",
    "cooktop", "hood", "iron", "vacuum", "robot-vacuum", "air-conditioner",
    "fan", "boiler", "television", "coffee", "toaster", "kettle", "generic",
  ];
  assert.deepEqual([...HERO_ARTWORK_TYPES].sort(), [...expected].sort());
  for (const type of expected) {
    const markup = applianceHeroArtwork(type, 160);
    assert.match(markup, new RegExp(`data-dm-hero="${type}"`), `hero missing for ${type}`);
    assert.match(markup, /<svg /, `svg missing for ${type}`);
  }
  // Catalog keys resolve to the same hero set (incl. the bare "robot" key).
  assert.match(applianceHeroArtwork("lavastoviglie"), /data-dm-hero="dishwasher"/);
  assert.match(applianceHeroArtwork("robot"), /data-dm-hero="robot-vacuum"/);
  assert.match(applianceHeroArtwork("congelatore"), /data-dm-hero="freezer"/);
  assert.match(applianceHeroArtwork("frigo"), /data-dm-hero="fridge"/);
  // Key mechanisms exist where the running animations expect them.
  assert.match(applianceHeroArtwork("washer"), /dmh-drum/);
  assert.match(applianceHeroArtwork("oven"), /dmh-fan[\s\S]*dmh-glow|dmh-glow[\s\S]*dmh-fan/);
  assert.match(applianceHeroArtwork("dishwasher"), /dmh-jets/);
  assert.match(applianceHeroArtwork("freezer"), /dmh-frost/);
  assert.match(applianceHeroArtwork("fan"), /dmh-fan/);
  assert.match(applianceHeroArtwork("television"), /dmh-screen/);
});

test("the showcase keeps the KPI-popup and daily-energy sidebar contracts", async () => {
  const source = await readFile(
    new URL("../src/sections/appliance-showcase-section.js", import.meta.url),
    "utf8",
  );
  // #appl-kpi-grid with .glance-card children + hidden labels keeps the KPI
  // popups (running / instant power) and the daily popup attachable.
  assert.match(source, /id="appl-kpi-grid"/);
  assert.match(source, /glance-card dm-total-power/);
  assert.match(source, /glance-card dm-total-running/);
  assert.match(source, /glance-card dm-total-daily/);
  assert.match(source, /Consumo istantaneo|totalHidden/);
  assert.match(source, /Energia giornaliera|todayHidden/);
  // The overview grid keeps the legacy id + active view classes for e2e.
  assert.match(source, /id="appl-grid-overview" class="appl-main-view active/);
  // No polling: the renderer must not own timers.
  assert.doesNotMatch(source, /setInterval\s*\(/);
  // Popups and editor are reused, not reimplemented.
  assert.match(source, /apriApplianceDetail/);
  assert.match(source, /apriStorico/);
  assert.match(source, /apriConfigEntita/);
});

test("the section runtime installs the showcase before the KPI popups wrap", async () => {
  const source = await readFile(
    new URL("../src/sections/section-runtime.js", import.meta.url),
    "utf8",
  );
  const showcase = source.lastIndexOf("installApplianceShowcaseSection()");
  const popups = source.lastIndexOf("installApplianceKpiPopups()");
  assert.ok(showcase > 0 && popups > 0 && showcase < popups);
  assert.match(source, /"appliance-showcase"/);
});

test("canonical artwork types are idempotent (dishwasher never becomes washer)", async () => {
  const { applianceArtwork, canonicalArtworkType } = await import(
    "../src/core/appliance-artwork.js"
  );
  for (const type of [
    "oven", "microwave", "fridge", "boiler", "washer", "dryer", "dishwasher",
    "cooktop", "television", "hood", "iron", "vacuum", "robot-vacuum",
    "air-conditioner", "fan", "coffee", "toaster", "kettle", "generic",
  ]) {
    assert.equal(canonicalArtworkType(type), type, `canonical type drifted for ${type}`);
  }
  assert.match(applianceArtwork("dishwasher", 30), /data-dm-art="dishwasher"/);
  assert.match(applianceArtwork("lavastoviglie", 30), /data-dm-art="dishwasher"/);
  assert.match(applianceArtwork("lavatrice", 30), /data-dm-art="washer"/);
});

test("normalizeDevice persists every showcase config field", async () => {
  const { normalizeDevice } = await import("../src/core/device-model.js");
  const normalized = normalizeDevice(
    {
      id: "appl-1",
      name: "Lavatrice",
      icon: "lavatrice",
      image_url: "https://example.com/washer.png",
      remaining_entity: "sensor.left",
      cycle_duration_entity: "sensor.total",
      cycle_minutes: "120",
      temperature_entity: "sensor.temp",
      temp_min: "-2",
      temp_max: "8",
      max_power: "2400",
      price_kwh: "0.25",
      alert_entity: "binary_sensor.problem",
      last_start_entity: "sensor.start",
      last_duration_entity: "sensor.duration",
      last_energy_entity: "sensor.energy",
      last_cost_entity: "sensor.cost",
      threshold_run: "6",
      threshold_standby: "0.5",
    },
    "appliances",
    { rooms: [] },
  );
  assert.equal(normalized.image, "https://example.com/washer.png");
  assert.equal(normalized.remaining_entity, "sensor.left");
  assert.equal(normalized.cycle_duration_entity, "sensor.total");
  assert.equal(normalized.cycle_minutes, 120);
  assert.equal(normalized.temperature_entity, "sensor.temp");
  assert.equal(normalized.temp_min, -2);
  assert.equal(normalized.temp_max, 8);
  assert.equal(normalized.max_power, 2400);
  assert.equal(normalized.price_kwh, 0.25);
  assert.equal(normalized.alert_entity, "binary_sensor.problem");
  assert.equal(normalized.last_start_entity, "sensor.start");
  assert.equal(normalized.last_duration_entity, "sensor.duration");
  assert.equal(normalized.last_energy_entity, "sensor.energy");
  assert.equal(normalized.last_cost_entity, "sensor.cost");
  assert.equal(normalized.threshold_run, 6);
  assert.equal(normalized.threshold_standby, 0.5);
  // Empty numeric strings must be dropped, never stored as 0.
  const emptied = normalizeDevice(
    { id: "appl-2", name: "Forno", cycle_minutes: "", max_power: "", threshold_run: "" },
    "appliances",
    { rooms: [] },
  );
  assert.equal("cycle_minutes" in emptied, false);
  assert.equal("max_power" in emptied, false);
  assert.equal("threshold_run" in emptied, false);
});
