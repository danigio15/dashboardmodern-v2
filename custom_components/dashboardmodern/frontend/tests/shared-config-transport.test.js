// DM-FIX-20260817A
//
// End-to-end behaviour of the shared configuration transport, driven through the
// globals the vendored runtime uses (cdSyncPull/cdSyncPush) against a fake
// hosted bridge. The regression these cover is the one that emptied real
// plance: a device that could not read the stored configuration used to declare
// itself authoritative and write its own empty snapshot over everybody else's.
import assert from "node:assert/strict";
import test from "node:test";

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
  clear() {
    this.values.clear();
  }
}

const configured = (name = "Cucina") => ({
  dm_dashboard_state: JSON.stringify({
    schema_version: 4,
    sections: { rooms: [{ id: "r1", name }] },
  }),
  cd_stanze: JSON.stringify([{ id: "r1", name, temp: "sensor.t" }]),
});

const storage = new MemoryStorage();
const sent = [];
// The store as Home Assistant would hold it, plus one kept revision.
const shared = {
  snapshot: { revision: 4, updated_at: 5000, keys_revision: 2, reset: false, values: configured() },
  recoverable: [],
  profile: "primary",
};
let transportFails = false;

function bridgeSocketClass() {
  return class FakeBridgeSocket {
    constructor() {
      this.readyState = 1;
      this.onmessage = null;
      this.onerror = null;
      setTimeout(() => {
        if (transportFails) this.onerror?.({ type: "error" });
        else this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
      }, 0);
    }
    send(raw) {
      const message = JSON.parse(raw);
      sent.push(message);
      let result = null;
      if (message.type === "dashboardmodern/config/get") result = shared;
      else if (message.type === "dashboardmodern/config/set") {
        shared.snapshot = {
          revision: shared.snapshot.revision + 1,
          updated_at: 6000,
          keys_revision: message.snapshot.keys_revision,
          reset: message.reset === true,
          values: message.snapshot.values,
        };
        result = { status: "saved", profile: "primary", snapshot: shared.snapshot, recoverable: [] };
      } else if (message.type === "frontend/get_user_data") result = { value: null };
      setTimeout(() => {
        this.onmessage?.({
          data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
        });
      }, 0);
    }
    close() {
      this.readyState = 3;
    }
  };
}

const realSetTimeout = globalThis.setTimeout;
globalThis.addEventListener = () => {};
globalThis.localStorage = storage;
globalThis.__DASHBOARDMODERN_HOSTED__ = true;
globalThis.__DASHBOARDMODERN_PROFILE__ = "primary";
globalThis.__DASHBOARDMODERN_INSTANCE__ = "entry-a";
globalThis.__DASHBOARDMODERN_PRIMARY__ = true;
globalThis.__DASHBOARDMODERN_BRIDGE_WS__ = bridgeSocketClass();
// Long timers are the retry/backoff schedule. Dropping them keeps the test
// deterministic instead of waiting for the real backoff.
globalThis.setTimeout = (handler, delay = 0, ...rest) =>
  Number(delay) > 200 ? 0 : realSetTimeout(handler, delay, ...rest);

await import("../src/sections/config-persistence-section.js");

const sentOfType = (type) => sent.filter((message) => message.type === type);

test("a failed read never turns the device into the writer", async () => {
  transportFails = true;
  storage.clear();
  for (const [key, value] of Object.entries(configured("Locale"))) storage.setItem(key, value);

  assert.equal(await globalThis.cdSyncPull(), false);
  // An edit while Home Assistant is unreachable must not be pushed blindly.
  storage.setItem("cd_stanze", JSON.stringify([{ id: "r1", name: "Offline" }]));
  await globalThis.cdSyncPush();

  assert.deepEqual(sentOfType("dashboardmodern/config/set"), []);
});

test("a device with no configuration adopts the shared one", async () => {
  transportFails = false;
  storage.clear();

  await globalThis.cdSyncPull();

  // Restoring normalizes rooms, so only the restored identity is asserted.
  const [room] = JSON.parse(storage.getItem("cd_stanze"));
  assert.equal(room.name, "Cucina");
  assert.equal(room.temp, "sensor.t");
  const [request] = sentOfType("dashboardmodern/config/get");
  assert.equal(request.profile, "primary");
  assert.equal(request.entry_id, "entry-a");
});

test("an emptied device never writes its emptiness over the shared configuration", async () => {
  transportFails = false;
  const before = sentOfType("dashboardmodern/config/set").length;

  // Exactly what a fresh browser or a cleared cache produces.
  storage.removeItem("cd_stanze");
  storage.removeItem("dm_dashboard_state");
  await globalThis.cdSyncPush();

  assert.equal(sentOfType("dashboardmodern/config/set").length, before);
  // The shared copy is intact and has been restored on this device instead.
  assert.deepEqual(shared.snapshot.values, configured());
  assert.equal(JSON.parse(storage.getItem("cd_stanze"))[0].name, "Cucina");
});

test("a real local edit is pushed with the revision it was based on", async () => {
  transportFails = false;
  const revision = shared.snapshot.revision;
  storage.setItem("cd_stanze", JSON.stringify([{ id: "r1", name: "Terrazzo" }]));

  await globalThis.cdSyncPush();

  const writes = sentOfType("dashboardmodern/config/set");
  const last = writes[writes.length - 1];
  assert.equal(last.expected_revision, revision);
  assert.deepEqual(JSON.parse(last.snapshot.values.cd_stanze)[0].name, "Terrazzo");
  assert.equal(shared.snapshot.revision, revision + 1);
});

test.after(() => {
  globalThis.setTimeout = realSetTimeout;
});
