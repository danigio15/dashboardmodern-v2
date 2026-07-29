import assert from "node:assert/strict";
import test from "node:test";
import { DashboardStore, hasConfiguredData } from "../src/core/dashboard-store.js";
import { cloneValue, getDeviceDisplayName, getDeviceVisual } from "../src/core/device-model.js";
import { migrateEnergy, migrateRooms, migrateState } from "../src/core/migrations.js";
import { createEnergyReportRows, createRenderCoordinator } from "../src/core/renderers.js";
import { canonicalReportDevices, projectEnergySlots } from "../src/core/energy-projection.js";
import { editorSlotsForSection } from "../src/core/editor-slots.js";

test("visibility recognizes configured pool and irrigation entities without devices", () => {
  assert.equal(hasConfiguredData("pool", { pumpEnt: "switch.pool" }), true);
  assert.equal(hasConfiguredData("irrigation", { rainEnt: "sensor.rain", zones: [] }), true);
  assert.equal(hasConfiguredData("irrigation", { zones: [{ entity: "switch.garden" }] }), true);
  assert.equal(hasConfiguredData("pool", { filterHours: 8 }), false);
});

class MemoryStorage {
  values = new Map();
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

function setup(seed = {}) {
  const storage = new MemoryStorage();
  for (const [key, value] of Object.entries(seed)) storage.setItem(key, JSON.stringify(value));
  const synced = [];
  const store = new DashboardStore({
    storage,
    sync: async (state, change) => synced.push({ state, change }),
  });
  store.migrate();
  return { store, storage, synced };
}

test("canonical display names never concatenate category/type", () => {
  assert.equal(getDeviceDisplayName({ name: "Forno", type: "forno" }), "Forno");
  assert.equal(getDeviceDisplayName({ name: "fOrNo", device_type: "forno" }), "fOrNo");
  assert.equal(
    getDeviceDisplayName(
      { name: "OTHER", entities: ["sensor.oven"] },
      { "sensor.oven": { attributes: { friendly_name: "Forno cucina" } } },
    ),
    "Forno cucina",
  );
  assert.equal(
    getDeviceDisplayName({ name: "generico", entities: ["sensor.microonde_power"] }),
    "Microonde Power",
  );
  assert.equal(getDeviceDisplayName({ name: "Cucina", device_type: "forno" }), "Cucina");
});

test("canonical visual priority is image, legacy image, mdi icon, type, fallback", () => {
  assert.deepEqual(
    getDeviceVisual({ image: "/new.png", image_url: "/old.png", icon: "mdi:stove" }),
    { kind: "image", value: "/new.png" },
  );
  assert.deepEqual(getDeviceVisual({ image_url: "/old.png", icon: "mdi:stove" }), {
    kind: "image",
    value: "/old.png",
  });
  assert.deepEqual(getDeviceVisual({ icon: "mdi:stove", device_type: "microonde" }), {
    kind: "icon",
    value: "mdi:stove",
  });
  assert.deepEqual(getDeviceVisual({ icon: "generico", device_type: "microonde" }), {
    kind: "icon",
    value: "mdi:microwave",
  });
  assert.deepEqual(getDeviceVisual({}), { kind: "icon", value: "mdi:devices" });
});

test("legacy migration is idempotent, retains data, creates room_id and explicit appliance fields", () => {
  const legacy = {
    sections: {
      rooms: [{ name: "Cucina" }],
      appliances: [
        { name: "generico", icon: "forno", room: "Cucina", entities: ["sensor.oven_power"] },
      ],
    },
  };
  const first = migrateState(legacy).state;
  const second = migrateState(first).state;
  assert.deepEqual(second, first);
  const appliance = first.sections.appliances[0];
  assert.ok(appliance.id);
  assert.equal(appliance.room_id, first.sections.rooms[0].id);
  assert.equal(appliance.device_type, "forno");
  assert.equal(appliance.name, "");
  assert.ok(Object.hasOwn(appliance, "monthly_energy_entity"));
});

test("reactive CRUD persists, syncs, preserves ids and emits targeted updates", async () => {
  const { store, storage, synced } = setup({
    cd_sections: { appliances: false },
    cd_stanze: [{ id: "kitchen", name: "Cucina" }],
  });
  const calls = [];
  createRenderCoordinator(store, {
    renderSection: (section) => calls.push(`section:${section}`),
    renderAppliances: () => calls.push("appliances"),
    renderEnergyReport: () => calls.push("report"),
    renderNavbar: () => calls.push("navbar"),
  });
  const added = await store.addItem("appliances", {
    name: "Forno",
    icon: "mdi:stove",
    room_id: "kitchen",
  });
  assert.equal(store.getState().visibility.appliances, true);
  assert.deepEqual(calls, ["section:appliances", "appliances", "report", "navbar"]);
  await store.updateItem("appliances", added.id, { name: "Forno cucina" });
  assert.equal(store.getSection("appliances")[0].id, added.id);
  await store.removeItem("appliances", added.id);
  assert.equal(store.getSection("appliances").length, 0);
  assert.equal(
    store.getState().visibility.appliances,
    true,
    "empty sections stay explicitly visible",
  );
  assert.equal(JSON.parse(storage.getItem("cd_appliances")).length, 0);
  assert.equal(synced.length, 3);
});

test("optimistic listeners render before a delayed backend sync resolves", async () => {
  let releaseSync;
  const syncGate = new Promise((resolve) => {
    releaseSync = resolve;
  });
  const storage = new MemoryStorage();
  const store = new DashboardStore({ storage, sync: () => syncGate });
  store.migrate();
  const changes = [];
  store.subscribe((change) => changes.push(change.status));
  const pending = store.addItem("cameras", { name: "Ingresso", entity: "camera.ingresso" });
  assert.deepEqual(changes, ["optimistic"]);
  assert.equal(store.getSection("cameras").length, 1);
  releaseSync();
  await pending;
  assert.deepEqual(changes, ["optimistic", "success"]);
});

test("failed backend sync rolls model and persistence back without emitting stale DOM event", async () => {
  const storage = new MemoryStorage();
  const changes = [];
  const store = new DashboardStore({
    storage,
    sync: async () => {
      throw new Error("offline");
    },
  });
  store.migrate();
  store.subscribe((change) => changes.push(change));
  await assert.rejects(
    store.addItem("cameras", { name: "Ingresso", entity: "camera.ingresso" }),
    /offline/,
  );
  assert.equal(store.getSection("cameras").length, 0);
  assert.deepEqual(
    changes.map((change) => change.status),
    ["optimistic", "rollback"],
  );
  assert.equal(JSON.parse(storage.getItem("cd_cameras")).length, 0);
});

test("room ids are deterministic and collisions have deterministic suffixes", () => {
  const legacy = [
    { name: "Camera", floor: "Piano 1" },
    { name: "Camera", floor: "Piano 1" },
  ];
  assert.deepEqual(
    migrateRooms(legacy).map((room) => room.id),
    ["room-piano-1-camera", "room-piano-1-camera-2"],
  );
  assert.deepEqual(migrateRooms(legacy), migrateRooms(legacy));
});

test("energy migration retains an object schema instead of coercing it to devices", () => {
  const energy = migrateEnergy({
    house: { power: "sensor.house" },
    grid: { import: "sensor.grid" },
  });
  assert.equal(Array.isArray(energy), false);
  assert.equal(energy.house.power, "sensor.house");
  assert.deepEqual(energy.solar, {});
  assert.deepEqual(energy.battery, {});
});

test("cloneValue works when structuredClone is unavailable", () => {
  const original = globalThis.structuredClone;
  globalThis.structuredClone = undefined;
  try {
    const source = { nested: [1, 2] };
    const copy = cloneValue(source);
    copy.nested.push(3);
    assert.deepEqual(source, { nested: [1, 2] });
  } finally {
    globalThis.structuredClone = original;
  }
});

test("energy report keeps name, category, room and metrics separate", () => {
  const rows = createEnergyReportRows(
    [
      {
        id: "oven",
        name: "Forno",
        device_type: "forno",
        room_id: "kitchen",
        icon: "mdi:stove",
        power_entity: "sensor.oven_power",
        monthly_energy_entity: "sensor.oven_month",
      },
    ],
    {
      "sensor.oven_power": { state: "1200", attributes: { unit_of_measurement: "W" } },
      "sensor.oven_month": { state: "8.8", attributes: { unit_of_measurement: "kWh" } },
    },
    [{ id: "kitchen", name: "Cucina" }],
    0.3,
  );
  assert.equal(rows[0].name, "Forno");
  assert.equal(rows[0].category, "forno");
  assert.equal(rows[0].room.name, "Cucina");
  assert.equal(rows[0].power.value, 1200);
  assert.equal(rows[0].monthly.value, 8.8);
  assert.equal(rows[0].cost, 2.64);
});

test("one successful operation produces exactly one coordinated render", async () => {
  const { store } = setup();
  let sections = 0;
  let cameras = 0;
  createRenderCoordinator(store, {
    renderSection: () => sections++,
    renderCameras: () => cameras++,
  });
  await store.addItem("cameras", { name: "Garage", entity: "camera.garage" });
  assert.equal(sections, 1);
  assert.equal(cameras, 1);
});

test("legacy writes are reconciled back into the canonical runtime state", async () => {
  const { store, storage } = setup();
  store.installLegacyWriteBridge();
  storage.setItem(
    "cd_cameras",
    JSON.stringify([{ id: "legacy", name: "Legacy", entity: "camera.legacy" }]),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.getSection("cameras")[0].id, "legacy");
  assert.equal(
    JSON.parse(storage.getItem("dm_dashboard_state")).sections.cameras[0].name,
    "Legacy",
  );
});

test("add, update, delete and rollback rerender the active editor exactly once", async () => {
  const storage = new MemoryStorage();
  let fail = false;
  const store = new DashboardStore({
    storage,
    sync: async () => {
      if (fail) throw new Error("backend unavailable");
    },
  });
  store.migrate();
  const calls = [];
  createRenderCoordinator(store, {
    renderCurrentEditor: (section, change) => calls.push(`editor:${section}:${change.status}`),
    renderDashboard: (section, change) => calls.push(`dashboard:${section}:${change.status}`),
    renderDropdowns: (section, change) => calls.push(`dropdowns:${section}:${change.status}`),
  });
  const item = await store.addItem("appliances", { name: "Forno", icon: "mdi:stove" });
  assert.equal(calls.filter((call) => call === "editor:appliances:optimistic").length, 1);
  await store.updateItem("appliances", item.id, { name: "Forno nuovo", icon: "mdi:oven" });
  assert.equal(store.getSection("appliances")[0].name, "Forno nuovo");
  await store.removeItem("appliances", item.id);
  assert.equal(store.getSection("appliances").length, 0, "delete is visible before navigation");

  const camera = await store.addItem("cameras", { name: "Ingresso", entity: "camera.ingresso" });
  fail = true;
  await assert.rejects(store.removeItem("cameras", camera.id), /backend unavailable/);
  assert.equal(
    store.getSection("cameras").length,
    1,
    "rollback restores the deleted row immediately",
  );
  assert.equal(calls.filter((call) => call === "editor:cameras:rollback").length, 1);
  assert.ok(calls.some((call) => call.startsWith("dashboard:")));
  assert.ok(calls.some((call) => call.startsWith("dropdowns:")));
});

test("all CRUD editor sections are registered with the reactive coordinator", async () => {
  const { store } = setup();
  const rendered = [];
  createRenderCoordinator(store, { renderCurrentEditor: (section) => rendered.push(section) });
  for (const section of ["appliances", "cameras", "rooms", "ev", "lights", "climate", "covers"]) {
    await store.addItem(section, { name: section, entity: `sensor.${section}` });
  }
  await store.replaceSection("pool", { tempEnt: "sensor.pool" });
  await store.replaceSection("irrigation", { zones: [] });
  await store.replaceSection("energy", { house: { power: "sensor.house" } });
  assert.deepEqual(rendered, [
    "appliances",
    "cameras",
    "rooms",
    "ev",
    "lights",
    "climate",
    "covers",
    "pool",
    "irrigation",
    "energy",
  ]);
});

test("real schema 3 migration imports washer, preserves its visual and legacy loads", () => {
  const schema3 = {
    schema_version: 3,
    sections: { rooms: [], appliances: [], loads: [], entityOverrides: {} },
    visibility: { ev: false },
  };
  const { store, storage } = setup({
    dm_dashboard_state: schema3,
    cd_entity_overrides: {
      "dm.lavatrice_potenza_presa": "sensor.washer_power",
      "dm.lavatrice_presa_avvio": "switch.washer",
    },
    cd_subloads_extra: {
      cucina: [
        {
          id: "toast",
          name: "Tostapane",
          pwr: "sensor.toast_power",
          icon: "🍞",
          room_id: "kitchen",
        },
      ],
    },
    cd_report_devices: [
      { id: "manual-water", name: "Acqua", entity: "sensor.water_month", icon: "💧" },
    ],
  });
  assert.equal(store.getState().schema_version, 4);
  const washer = store.getSection("appliances").find((item) => item.id === "appliance-lavatrice");
  assert.equal(washer.visual_type, "asset");
  assert.equal(washer.visual_key, "lavatrice");
  assert.equal(washer.icon, "");
  assert.deepEqual(
    store.getSection("loads").map((item) => item.id),
    ["toast", "manual-water"],
  );
  assert.ok(storage.getItem("dm_dashboard_backup_v3"));
  const rerun = store.migrate();
  assert.deepEqual(rerun.changes, []);
  assert.equal(
    store.getSection("appliances").filter((item) => item.device_type === "lavatrice").length,
    1,
  );
});

test("real EV slot mappings make EV visible in the same transaction", async () => {
  const { store } = setup({
    dm_dashboard_state: {
      schema_version: 4,
      sections: { entityOverrides: {} },
      visibility: { ev: false },
    },
  });
  await store.replaceSection("entityOverrides", {
    "dm.ev_soc": "sensor.auto_state_of_charge",
    "dm.ev_charge_power": "sensor.wallbox_charge_power",
  });
  assert.equal(store.getState().visibility.ev, true);
});

test("real editor slots reveal EV, Energy, MiniPC, Solar and Security", async () => {
  const cases = [
    ["dm.ev_batteria_auto", "sensor.car_soc", "ev"],
    ["dm.energy_potenza_batteria", "sensor.battery_power", "energy"],
    ["dm.server_cpu", "sensor.minipc_cpu", "server"],
    ["dm.boiler_temperatura", "sensor.solar_boiler", "boiler"],
    ["dm.security_centrale_allarme", "alarm_control_panel.home", "security"],
    ["dm.home_interruttore_antifurto", "switch.alarm", "security"],
  ];
  for (const [slot, entity, section] of cases) {
    const { store } = setup({
      dm_dashboard_state: {
        schema_version: 4,
        sections: { entityOverrides: {} },
        visibility: { [section]: false },
      },
    });
    await store.replaceSection("entityOverrides", { [slot]: entity });
    assert.equal(store.getState().visibility[section], true, slot);
  }
});

test("legacy-only washer reaches schema 4 once with preserved id, entities and asset", () => {
  const { store } = setup({
    cd_entity_overrides: {
      "dm.lavatrice_presa_avvio_lavatrice": "switch.washer",
      "dm.lavatrice_potenza_presa_lavatrice_per_lavatrici_no": "sensor.washer_power",
    },
  });
  const washers = store.getSection("appliances").filter((item) => item.device_type === "lavatrice");
  assert.equal(store.getState().schema_version, 4);
  assert.equal(washers.length, 1);
  assert.equal(washers[0].id, "appliance-lavatrice");
  assert.equal(washers[0].control_entity, "switch.washer");
  assert.equal(washers[0].power_entity, "sensor.washer_power");
  assert.equal(washers[0].visual_type, "asset");
  assert.equal(washers[0].visual_key, "lavatrice");
  assert.equal(store.migrate().changes.length, 0);
});

test("Energy is canonical and deterministically projects public runtime slots", async () => {
  const { store, storage } = setup({
    dm_dashboard_state: {
      schema_version: 4,
      sections: { energy: {}, entityOverrides: {} },
      visibility: {},
    },
  });
  await store.replaceSection("energy", {
    house: { power: "sensor.house" },
    grid: { power: "sensor.grid" },
    solar: { power: "sensor.solar" },
    battery: { power: "sensor.battery", soc: "sensor.soc" },
  });
  const overrides = JSON.parse(storage.getItem("cd_entity_overrides"));
  assert.deepEqual(overrides, projectEnergySlots(store.getSection("energy"), {}));
  assert.equal(overrides["dm.energy_potenza_consumo_casa"], "sensor.house");
  assert.equal(overrides["dm.energy_stato_carica_batteria"], "sensor.soc");
});

test("canonical public Report honors inclusion, presentation, entity and report order", () => {
  const rows = canonicalReportDevices(
    [{ id: "washer", name: "Washer", show_in_report: false, report_entity: "sensor.washer" }],
    [
      {
        id: "water",
        name: "Water",
        show_in_report: true,
        report_label: "Acqua",
        report_icon: "💧",
        report_entity: "sensor.water",
        report_order: 2,
      },
      {
        id: "toast",
        name: "Toast",
        show_in_report: true,
        report_label: "Pane",
        report_icon: "🍞",
        report_entity: "sensor.toast",
        report_order: 1,
      },
    ],
  );
  assert.deepEqual(
    rows.map((row) => [row.key, row.name, row.icon, row.entity]),
    [
      ["toast", "Pane", "🍞", "sensor.toast"],
      ["water", "Acqua", "💧", "sensor.water"],
    ],
  );
});

test("legacy emoji and room names survive load migration without becoming device types", () => {
  const migrated = migrateState(
    {
      schema_version: 3,
      sections: { rooms: [{ id: "room-kitchen", name: "Kitchen" }], loads: [], appliances: [] },
      visibility: {},
    },
    {
      subloads: {
        kitchen: [{ id: "toast", name: "Toast", icon: "🍞", room: "Kitchen", pwr: "sensor.toast" }],
      },
    },
  ).state.sections.loads[0];
  assert.equal(migrated.room_id, "room-kitchen");
  assert.equal(migrated.report_icon, "🍞");
  assert.equal(migrated.emoji_icon, "🍞");
  assert.equal(migrated.icon, "");
  assert.equal(migrated.device_type, "secondary");
});

test("canonical snapshot transfers loads and Report settings atomically between devices", async () => {
  const first = setup().store;
  const load = await first.addItem("loads", {
    name: "Pump",
    power_entity: "sensor.pump",
    show_in_report: true,
  });
  await first.saveReport([
    {
      ...load,
      section: "loads",
      report_label: "Pool pump",
      report_icon: "💧",
      report_entity: "sensor.pump_month",
      report_order: 4,
    },
  ]);
  const second = setup({
    cd_subloads_extra: { stale: [{ name: "Legacy", pwr: "sensor.legacy" }] },
  }).store;
  second.applySnapshot(JSON.stringify(first.getState()));
  assert.deepEqual(second.getSection("loads"), first.getSection("loads"));
  assert.equal(second.getSection("loads")[0].report_label, "Pool pump");
  assert.equal(
    second.getSection("loads").some((item) => item.name === "Legacy"),
    false,
  );
});

test("Report edits preserve a normal load's explicit dashboard visibility", async () => {
  const { store } = setup();
  const load = await store.addItem("loads", {
    name: "Hidden pump",
    power_entity: "sensor.hidden_pump",
    show_in_dashboard: false,
    show_in_report: true,
  });
  await store.saveReport([
    {
      id: load.id,
      section: "loads",
      category: load.category,
      name: load.name,
      show_in_report: true,
      report_label: "Report pump",
      report_entity: "sensor.hidden_pump_month",
      report_order: 1,
    },
  ]);
  const saved = store.getSection("loads")[0];
  assert.equal(saved.show_in_dashboard, false);
  assert.equal(saved.report_label, "Report pump");
});

test("every Energy editor field has one deterministic public slot", () => {
  const fields = {
    house: ["power", "daily_energy", "monthly_energy", "annual_energy"],
    grid: [
      "power",
      "daily_import_energy",
      "daily_export_energy",
      "monthly_import_energy",
      "monthly_export_energy",
    ],
    solar: ["power", "daily_energy", "monthly_energy", "annual_energy"],
    battery: ["power", "soc", "daily_charged_energy", "monthly_charged_energy"],
  };
  const model = {};
  let index = 0;
  for (const [group, keys] of Object.entries(fields)) {
    model[group] = {};
    for (const key of keys) model[group][key] = `sensor.energy_${index++}`;
  }
  const projected = projectEnergySlots(model, {});
  assert.equal(Object.keys(projected).length, index);
  assert.deepEqual(
    new Set(Object.values(projected)),
    new Set(Array.from({ length: index }, (_, i) => `sensor.energy_${i}`)),
  );
});

test("annual Energy is projected while unconsumed lifetime fields stay out of runtime", () => {
  const projected = projectEnergySlots(
    {
      house: {
        daily_energy: "sensor.house_day",
        monthly_energy: "sensor.house_month",
        annual_energy: "sensor.house_year",
        total_energy: "sensor.house_lifetime",
      },
      solar: {
        daily_energy: "sensor.solar_day",
        monthly_energy: "sensor.solar_month",
        annual_energy: "sensor.solar_year",
        total_energy: "sensor.solar_lifetime",
      },
    },
    {},
  );
  assert.equal(projected["dm.energy_consumo_casa_anno"], "sensor.house_year");
  assert.equal(projected["dm.energy_produzione_solare_anno"], "sensor.solar_year");
  assert.equal(projected["dm.energy_consumo_casa_totale"], undefined);
  assert.equal(projected["dm.energy_produzione_solare_totale"], undefined);
  assert.equal(new Set(Object.values(projected)).size, 6);
});

test("Energy slot ownership is derived from the canonical projection without typos", () => {
  const slots = editorSlotsForSection("energy");
  assert.ok(slots.includes("dm.energy_potenza_fotovoltaico"));
  assert.ok(slots.includes("dm.energy_consumo_casa_anno"));
  assert.equal(slots.includes("dm.energy_consumo_casa_totale"), false);
  assert.equal(
    slots.some((slot) => slot.includes("solaar")),
    false,
  );
});

test("Temperature room migration preserves legacy entity ids and display metadata", () => {
  const [room] = migrateRooms([
    {
      name: "Kitchen",
      icon: "mdi:thermometer",
      floor: "Ground",
      temp: "sensor.kitchen_temperature",
      hum: "sensor.kitchen_humidity",
      rgb: "14,165,233",
    },
  ]);
  assert.equal(room.temp, "sensor.kitchen_temperature");
  assert.equal(room.hum, "sensor.kitchen_humidity");
  assert.equal(room.icon, "mdi:thermometer");
  assert.equal(room.rgb, "14,165,233");
  const remounted = migrateRooms([room])[0];
  assert.deepEqual(remounted, room);
});

test("Temperature migration accepts descriptive legacy entity field names", () => {
  const [room] = migrateRooms([
    {
      name: "Office",
      temperature_entity: "sensor.office_temperature",
      humidity_entity: "sensor.office_humidity",
    },
  ]);
  assert.equal(room.temp, "sensor.office_temperature");
  assert.equal(room.hum, "sensor.office_humidity");
});
