import assert from "node:assert/strict";
import test from "node:test";
import { DashboardStore } from "../src/core/dashboard-store.js";
import { allStates } from "../src/sections/shared.js";
import {
  markRecoveredConfigPending,
  normalizeBatterySocText,
  recoverCanonicalLoads,
  recoverEnergyConfiguration,
} from "../src/sections/beta24-energy-recovery-section.js";

class MemoryStorage {
  constructor(seed = {}) {
    this.values = new Map(Object.entries(seed));
  }
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

const json = (value) => JSON.stringify(value);

function emptySchema4() {
  return {
    schema_version: 4,
    sections: {
      rooms: [],
      cameras: [],
      appliances: [],
      loads: [],
      lights: [],
      climate: [],
      ev: [],
      covers: [],
      pool: {},
      irrigation: {},
      energy: { house: {}, grid: {}, solar: {}, battery: {}, metadata: { semantics_version: 4 } },
      energyLoads: [],
      entityOverrides: {},
    },
    visibility: { energy: true },
  };
}

test("schema-v4 migration recovers newer energy/load sibling keys before they are overwritten", () => {
  const storage = new MemoryStorage({
    dm_dashboard_state: json(emptySchema4()),
    cd_energy_model: json({
      house: {
        power: "sensor.house_power",
        daily_energy: "sensor.house_today",
        monthly_energy: "sensor.house_month",
      },
      solar: { daily_energy: "sensor.solar_today" },
      grid: {},
      battery: { soc: "sensor.battery_soc" },
      metadata: { semantics_version: 4 },
    }),
    cd_entity_overrides: json({
      "dm.energy_energia_prelevata_oggi": "sensor.grid_import_today",
      "dm.energy_energia_immessa_oggi": "sensor.grid_export_today",
      "dm.boiler_potenza_resistenza_boiler": "sensor.boiler_power",
      "dm.energy_boiler_oggi": "sensor.boiler_today",
    }),
    cd_loads: json([
      {
        id: "load-boiler-user",
        name: "Boiler",
        icon: "mdi:water-boiler",
        power_entity: "sensor.boiler_power",
        daily_energy_entity: "sensor.boiler_today",
        show_in_dashboard: true,
      },
    ]),
  });

  const store = new DashboardStore({ storage, sync: async () => {} });
  const result = store.migrate();
  const energy = store.getSection("energy");
  const loads = store.getSection("loads");

  assert.equal(energy.house.power, "sensor.house_power");
  assert.equal(energy.house.daily_energy, "sensor.house_today");
  assert.equal(energy.house.monthly_energy, "sensor.house_month");
  assert.equal(energy.solar.daily_energy, "sensor.solar_today");
  assert.equal(energy.grid.daily_import_energy, "sensor.grid_import_today");
  assert.equal(energy.grid.daily_export_energy, "sensor.grid_export_today");
  assert.equal(energy.battery.soc, "sensor.battery_soc");
  assert.equal(loads.length, 1);
  assert.equal(loads[0].power_entity, "sensor.boiler_power");
  assert.equal(loads[0].daily_energy_entity, "sensor.boiler_today");
  assert.match(result.changes.join("\n"), /beta24 recovery/);

  const persistedEnergy = JSON.parse(storage.getItem("cd_energy_model"));
  const persistedLoads = JSON.parse(storage.getItem("cd_loads"));
  const persistenceMeta = JSON.parse(storage.getItem("dm_persistence_meta"));
  assert.equal(persistedEnergy.house.daily_energy, "sensor.house_today");
  assert.equal(persistedLoads[0].daily_energy_entity, "sensor.boiler_today");
  assert.ok(Number(persistenceMeta.pending_at) > 0);
});

test("recovered config keeps the newest pending timestamp so stale cloud data cannot win", () => {
  const storage = new MemoryStorage({
    dm_persistence_meta: json({ synced_at: 100, pending_at: 250 }),
  });
  assert.equal(markRecoveredConfigPending(storage, 200), true);
  assert.deepEqual(JSON.parse(storage.getItem("dm_persistence_meta")), {
    synced_at: 100,
    pending_at: 250,
  });
  assert.equal(markRecoveredConfigPending(storage, 500), true);
  assert.deepEqual(JSON.parse(storage.getItem("dm_persistence_meta")), {
    synced_at: 100,
    pending_at: 500,
  });
});

test("energy recovery fills only missing canonical fields and never overwrites configured ones", () => {
  const state = emptySchema4();
  state.sections.energy.house.daily_energy = "sensor.keep_today";
  const recovered = recoverEnergyConfiguration(state, {
    energy: {
      house: {
        daily_energy: "sensor.old_today",
        monthly_energy: "sensor.house_month",
      },
    },
    overrides: {
      "dm.energy_produzione_solare_oggi": "sensor.solar_today",
    },
  });
  assert.equal(state.sections.energy.house.daily_energy, "sensor.keep_today");
  assert.equal(state.sections.energy.house.monthly_energy, "sensor.house_month");
  assert.equal(state.sections.energy.solar.daily_energy, "sensor.solar_today");
  assert.equal(recovered, 2);
});

test("retired Beta22 energy loads are promoted once into canonical Loads", () => {
  const state = emptySchema4();
  state.sections.energyLoads = [
    {
      id: "energy-load-pompa",
      name: "Pompa",
      icon: "mdi:pump",
      power_entity: "sensor.pump_power",
      energy_entity: "sensor.pump_total",
    },
  ];
  const added = recoverCanonicalLoads(state, {
    loads: [],
    overrides: {
      "dm.boiler_potenza_resistenza_boiler": "sensor.boiler_power",
      "dm.energy_boiler_oggi": "sensor.boiler_today",
    },
    retiredEnergyLoads: state.sections.energyLoads,
  });

  assert.equal(added, 2);
  assert.equal(state.sections.energyLoads.length, 0);
  assert.equal(state.sections.loads.length, 2);
  const boiler = state.sections.loads.find((item) => item.name === "Boiler");
  const pump = state.sections.loads.find((item) => item.name === "Pompa");
  assert.equal(boiler.daily_energy_entity, "sensor.boiler_today");
  assert.equal(pump.total_energy_entity, "sensor.pump_total");
  assert.equal(pump.history_entity, "sensor.pump_total");

  const second = recoverCanonicalLoads(state, {
    loads: state.sections.loads,
    overrides: {
      "dm.boiler_potenza_resistenza_boiler": "sensor.boiler_power",
      "dm.energy_boiler_oggi": "sensor.boiler_today",
    },
  });
  assert.equal(second, 0);
  assert.equal(state.sections.loads.length, 2);
});

test("SOC text has one stable visible contract", () => {
  assert.equal(normalizeBatterySocText("62%"), "SOC 62%");
  assert.equal(normalizeBatterySocText("SOC 62%"), "SOC 62%");
  assert.equal(normalizeBatterySocText("—"), "SOC —");
});

test("allStates merges Home Assistant, WebView and canonical state registries", () => {
  const previousHass = globalThis.__HASS__;
  const previousPublicHass = globalThis.hass;
  const previousStates = globalThis.STATES;
  const previousRaw = globalThis._RAW_STATES;
  try {
    globalThis.__HASS__ = { states: { "sensor.from_hass": { state: "1" } } };
    globalThis.hass = { states: { "sensor.from_webview": { state: "2" } } };
    globalThis.STATES = { "sensor.from_states": { state: "3" } };
    globalThis._RAW_STATES = { "sensor.from_raw": { state: "4" } };
    const states = allStates();
    assert.equal(states["sensor.from_hass"].state, "1");
    assert.equal(states["sensor.from_webview"].state, "2");
    assert.equal(states["sensor.from_states"].state, "3");
    assert.equal(states["sensor.from_raw"].state, "4");
  } finally {
    globalThis.__HASS__ = previousHass;
    globalThis.hass = previousPublicHass;
    globalThis.STATES = previousStates;
    globalThis._RAW_STATES = previousRaw;
  }
});
