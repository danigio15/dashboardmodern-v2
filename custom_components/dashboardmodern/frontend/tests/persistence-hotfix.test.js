import assert from "node:assert/strict";
import test from "node:test";
import { DashboardStore } from "../src/core/dashboard-store.js";

globalThis.addEventListener = () => {};
const {
  applyRestoredValues,
  CONFIG_KEYS,
  integrationUserDataKey,
  mergeLegacyMissingConfig,
  migrateLegacyUserData,
  normalizeRemoteSnapshot,
  normalizeRestoredValues,
  persistenceReconcileAction,
  sameConfigValues,
} = await import("../src/sections/config-persistence-section.js");

// DM-FIX-20260815G

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
  const store = new DashboardStore({ storage, sync: async () => {} });
  store.migrate();
  return { store, storage };
}

test("primary persistence uses the integration runtime key", () => {
  assert.equal(integrationUserDataKey(), "dashboardmodern_integration_config");
});

test("secondary persistence uses the sanitized runtime instance suffix", () => {
  assert.equal(
    integrationUserDataKey({ primary: false, instance: "Casa / mare! 123456789" }),
    "dashboardmodern_integration_config__Casamare12345678",
  );
});

test("legacy remote payload migrates once to the unified key", async () => {
  globalThis.__DASHBOARDMODERN_PRIMARY__ = true;
  globalThis.__DASHBOARDMODERN_INSTANCE__ = "integration";
  const legacy = { version: 1, values: { cd_sections: '{"home":true}' } };
  const values = new Map([["dashboardmodern_v2_config:integration", legacy]]);
  const pushes = [];
  const fetchValue = async (key) => values.get(key) || null;
  const pushValue = async (key, value) => {
    pushes.push([key, value]);
    values.set(key, value);
  };
  assert.equal(await migrateLegacyUserData(fetchValue, pushValue), legacy);
  assert.equal(await migrateLegacyUserData(fetchValue, pushValue), legacy);
  assert.deepEqual(pushes, [["dashboardmodern_integration_config", legacy]]);
});

test("modern persistence covers legacy user-editable keys that used to stay device-local", () => {
  for (const key of [
    "cd_branding",
    "cd_devices",
    "cd_flow_nodes",
    "cd_avvisi_custom",
    "cd_text_overrides",
    "cd_hidden_elements",
  ])
    assert.ok(CONFIG_KEYS.includes(key), `${key} must be synchronized`);
});

test("flat legacy cloud payload is accepted and upgraded to the modern envelope", () => {
  const remote = normalizeRemoteSnapshot({
    __ts: 12345,
    _savedAt: 12000,
    cd_sections: '{"energy":true}',
    cd_devices: '[{"name":"Pompa"}]',
  });
  assert.deepEqual(remote, {
    version: 1,
    keys_revision: 0,
    updated_at: 12345,
    migrated_from: "legacy-flat",
    values: {
      cd_sections: '{"energy":true}',
      cd_devices: '[{"name":"Pompa"}]',
    },
  });
});

test("old incomplete cloud snapshot keeps local fields that were never synchronized", () => {
  const local = {
    cd_sections: '{"energy":true}',
    cd_devices: '[{"name":"Pompa smartphone"}]',
    cd_avvisi_custom: '[{"name":"Allarme"}]',
  };
  const oldRemote = normalizeRemoteSnapshot({
    version: 1,
    updated_at: 5000,
    values: { cd_sections: '{"energy":false}' },
  });
  const merged = mergeLegacyMissingConfig(oldRemote, local);
  assert.equal(merged.values.cd_sections, '{"energy":false}');
  assert.equal(merged.values.cd_devices, local.cd_devices);
  assert.equal(merged.values.cd_avvisi_custom, local.cd_avvisi_custom);
});

test("revision-2 cloud absence is authoritative and is not filled from stale local data", () => {
  const remote = normalizeRemoteSnapshot({
    version: 1,
    keys_revision: 2,
    updated_at: 5000,
    values: { cd_sections: '{"energy":false}' },
  });
  const merged = mergeLegacyMissingConfig(remote, {
    cd_devices: '[{"name":"Stale"}]',
  });
  assert.equal(Object.hasOwn(merged.values, "cd_devices"), false);
});

test("store preserves a fresh legacy visibility write instead of overwriting it", () => {
  const { store, storage } = setup({ cd_sections: { home: false } });
  const external = { home: true, energy: false };
  storage.setItem("cd_sections", JSON.stringify(external));
  store.persist();
  assert.deepEqual(JSON.parse(storage.getItem("cd_sections")), external);
  assert.deepEqual(store.getState().visibility, external);
});

test("store preserves fresh room edits including Temperature display names", () => {
  const { store, storage } = setup();
  const rooms = [
    {
      id: "room-kitchen",
      name: "Kitchen",
      temp: "sensor.kitchen",
      temp_name: "Sonda cucina",
      hum: "sensor.kitchen_humidity",
      hum_name: "Umidità cucina",
    },
  ];
  storage.setItem("cd_stanze", JSON.stringify(rooms));
  store.persist();
  const saved = JSON.parse(storage.getItem("cd_stanze"))[0];
  assert.equal(saved.temp_name, "Sonda cucina");
  assert.equal(saved.hum_name, "Umidità cucina");
  assert.equal(store.getSection("rooms")[0].temp_name, "Sonda cucina");
});

test("restore normalizes room names in canonical and legacy snapshots", () => {
  const restored = normalizeRestoredValues({
    cd_stanze: JSON.stringify([{ id: "room_x", name: "", temp: "sensor.t" }]),
    dm_dashboard_state: JSON.stringify({
      schema_version: 4,
      sections: { rooms: [{ id: "room_y", name: "", temp: "sensor.y" }] },
    }),
  });
  assert.equal(JSON.parse(restored.cd_stanze)[0].name, "Room 1");
  assert.equal(JSON.parse(restored.dm_dashboard_state).sections.rooms[0].name, "Room 1");
});

test("configured desktop restores the newer remote phone snapshot", () => {
  const local = {
    cd_stanze: JSON.stringify([{ id: "room-old", name: "Vecchia" }]),
    cd_sections: JSON.stringify({ temp: true }),
  };
  const remote = {
    version: 1,
    keys_revision: 2,
    updated_at: 5000,
    values: {
      cd_stanze: JSON.stringify([{ id: "room-new", name: "Nuova" }]),
      cd_sections: JSON.stringify({ temp: true, energy: true }),
    },
  };
  assert.equal(
    persistenceReconcileAction({ remote, localConfigured: true, pendingAt: 0, local }),
    "restore-remote",
  );
});

test("configured desktop also restores a newer flat legacy phone snapshot", () => {
  const local = { cd_devices: '[{"name":"Vecchio"}]' };
  const remote = { __ts: 5000, cd_devices: '[{"name":"Nuovo"}]' };
  assert.equal(
    persistenceReconcileAction({ remote, localConfigured: true, pendingAt: 0, local }),
    "restore-remote",
  );
});

test("newer unsynced local edit wins over an older remote snapshot", () => {
  const local = { cd_sections: JSON.stringify({ energy: true }) };
  const remote = {
    version: 1,
    keys_revision: 2,
    updated_at: 4000,
    values: { cd_sections: JSON.stringify({ energy: false }) },
  };
  assert.equal(
    persistenceReconcileAction({ remote, localConfigured: true, pendingAt: 5000, local }),
    "push-local",
  );
});

test("first configured device seeds remote storage when no remote exists", () => {
  assert.equal(
    persistenceReconcileAction({
      remote: null,
      localConfigured: true,
      local: { cd_stanze: "[]" },
    }),
    "push-local",
  );
});

test("identical local and remote snapshots do not rewrite either side", () => {
  const values = {
    cd_sections: JSON.stringify({ energy: true }),
    cd_costo_kwh: "0.28",
  };
  assert.equal(sameConfigValues(values, { ...values }), true);
  assert.equal(
    persistenceReconcileAction({
      remote: { version: 1, keys_revision: 2, updated_at: 100, values: { ...values } },
      localConfigured: true,
      pendingAt: 200,
      local: values,
    }),
    "in-sync",
  );
});

test("remote restore propagates deletions instead of leaving stale desktop keys", () => {
  const storage = new MemoryStorage();
  storage.setItem("cd_sections", JSON.stringify({ energy: true }));
  storage.setItem("cd_stanze", JSON.stringify([{ id: "stale", name: "Stale" }]));
  storage.setItem("cd_devices", JSON.stringify([{ name: "Stale device" }]));
  storage.setItem("cd_costo_kwh", "0.31");

  assert.equal(
    applyRestoredValues(storage, {
      cd_sections: JSON.stringify({ energy: false }),
      cd_costo_kwh: "0.27",
    }),
    true,
  );
  assert.equal(storage.getItem("cd_stanze"), null);
  assert.equal(storage.getItem("cd_devices"), null);
  assert.equal(storage.getItem("cd_costo_kwh"), "0.27");
  assert.deepEqual(JSON.parse(storage.getItem("cd_sections")), { energy: false });
});
