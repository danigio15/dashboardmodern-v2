import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import test from "node:test";

const PRELUDE = readFileSync(
  fileURLToPath(new URL("../legacy/bridge-prelude.js", import.meta.url)),
  "utf8",
);

function runPrelude({
  parent: parentValue,
  host = "ha.local:8123",
  storage = {},
  query = "",
  namespaced = false,
  withIntervals = false,
}) {
  const writes = [];
  const listeners = new Map();
  const intervals = [];
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
  }
  const parent =
    parentValue === "self"
      ? null
      : parentValue === "cross-origin"
        ? new Proxy(
            {},
            {
              get() {
                throw new Error("cross-origin");
              },
            },
          )
        : parentValue;
  const document = {
    documentElement: { lang: "it" },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };
  const window = {
    document,
    location: { host, search: query, href: `http://${host}/dashboard.html${query}` },
    WebSocket: MockWebSocket,
    localStorage: {
      getItem: (key) => (key in storage ? storage[key] : null),
      setItem: (key, value) => {
        writes.push(key);
        storage[key] = String(value);
      },
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };
  if (namespaced) window.__DASHBOARDMODERN_STORAGE_NS__ = "test-instance";
  if (withIntervals) {
    window.setInterval = (handler, delay) => {
      intervals.push({ handler, delay });
      return intervals.length;
    };
  }
  window.parent = parentValue === "self" ? window : parent;
  const context = createContext({
    window,
    document,
    parent: window.parent,
    setTimeout,
    clearTimeout,
    Event,
  });
  runInContext(PRELUDE, context);
  return {
    window,
    storage,
    writes,
    intervals,
    dispatch(type) {
      listeners.get(type)?.();
    },
  };
}

test("the runtime's intervals are noted with id, period and source until the runtime is ready", () => {
  /* Il runtime vendorizzato arma i suoi setInterval senza tenerne gli
   * identificativi: il preludio, che gira prima, e' l'unico posto da cui
   * annotarli. Vale nella plancia ospitata e in quella autonoma. */
  for (const parent of ["self", { __DASHBOARDMODERN_HOST__: true }]) {
    const { window, intervals } = runPrelude({ parent, withIntervals: true });
    assert.equal(window.setInterval.__dmTimerAnnotati, true);
    const id = window.setInterval(function () {
      try {
        window.cdApplyNavVis();
      } catch (e) {}
    }, 3000);
    assert.equal(intervals.length, 1, "the real setInterval still arms the timer");
    assert.equal(window.__DASHBOARDMODERN_LEGACY_INTERVALS__.length, 1);
    const [voce] = window.__DASHBOARDMODERN_LEGACY_INTERVALS__;
    assert.equal(voce.id, id);
    assert.equal(voce.period, 3000);
    assert.match(voce.fn, /cdApplyNavVis\(\)/);
    assert.equal(voce.cleared, false);
    // Quello che i moduli armano dopo, a guscio pronto, non e' del guscio.
    window.__DASHBOARDMODERN_LEGACY_READY__ = true;
    window.setInterval(() => {}, 1000);
    assert.equal(intervals.length, 2);
    assert.equal(window.__DASHBOARDMODERN_LEGACY_INTERVALS__.length, 1);
  }
});

test("without a setInterval to wrap the prelude does not mind", () => {
  const { window } = runPrelude({ parent: "self" });
  assert.equal(window.setInterval, undefined);
  assert.deepEqual(window.__DASHBOARDMODERN_LEGACY_INTERVALS__, undefined);
});

test("hosted mode exposes only the placeholder and the injected non-native adapter", () => {
  const { window } = runPrelude({ parent: { __DASHBOARDMODERN_HOST__: true } });

  assert.equal(window.__DASHBOARDMODERN_HOSTED__, true);
  assert.equal(window.__DASHBOARDMODERN_CONNECTION__.token, "__dashboardmodern_hosted__");
  assert.equal(window.__DASHBOARDMODERN_CONNECTION__.local_ip, "ha.local:8123");
  assert.equal(window.__DASHBOARDMODERN_REAL_TOKEN__, undefined);
  assert.equal(window.DASHBOARDMODERN_AUTH_TOKEN, undefined);
  assert.equal(window.WebSocket.name, "DeferredSocket");
  assert.equal(window.WebSocket.__dmInjectedHostedAdapter, true);
  assert.equal(window.__DASHBOARDMODERN_BRIDGE_WS__, window.WebSocket);
  assert.equal(window.__DASHBOARDMODERN_BRIDGED__, true);
});

test("an explicit parent bridge is the only hosted transport", () => {
  class BridgeSocket {}
  const { window } = runPrelude({
    parent: {
      __DASHBOARDMODERN_HOST__: true,
      __DASHBOARDMODERN_BRIDGE_WS__: BridgeSocket,
    },
  });

  assert.equal(window.WebSocket, BridgeSocket);
  assert.equal(window.__DASHBOARDMODERN_BRIDGE_WS__, BridgeSocket);
  assert.equal(window.__DASHBOARDMODERN_BRIDGED__, true);
  assert.equal(window.__DASHBOARDMODERN_REAL_TOKEN__, undefined);
});

test("the prelude never writes to shared localStorage", () => {
  const storage = {
    cd_connection: JSON.stringify({
      token: "real-standalone-token",
      dashboard_path: "/lovelace/2",
    }),
  };
  const { writes } = runPrelude({
    parent: { __DASHBOARDMODERN_HOST__: true },
    storage,
  });

  assert.deepEqual(writes, []);
  assert.equal(JSON.parse(storage.cd_connection).token, "real-standalone-token");
});

test("hosted namespaced state completes visibility before the legacy write bridge starts", () => {
  const state = {
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
      irrigation: { zones: [] },
      energy: { house: { total_energy: "sensor.house_total" } },
      entityOverrides: { "dm.server_cpu": "sensor.server_cpu" },
    },
    visibility: { energy: true, appliances: true },
  };
  const storage = { dm_dashboard_state: JSON.stringify(state) };
  const { writes } = runPrelude({
    parent: { __DASHBOARDMODERN_HOST__: true },
    storage,
    namespaced: true,
  });

  assert.deepEqual(writes, ["dm_dashboard_state", "cd_sections"]);
  const migrated = JSON.parse(storage.dm_dashboard_state);
  assert.equal(migrated.visibility.energy, true);
  assert.equal(migrated.visibility.appliances, true, "explicit visibility is preserved");
  assert.equal(migrated.visibility.server, true);
  assert.equal(migrated.visibility.ev, false);
  assert.equal(migrated.visibility.clima, false);
  assert.equal(migrated.visibility.temp, false);
  assert.equal(migrated.visibility.security, false);
  assert.equal(migrated.visibility.tapparelle, false);
  assert.equal(migrated.visibility.irrigazione, false);
  assert.equal(migrated.visibility.piscina, false);
  assert.deepEqual(JSON.parse(storage.cd_sections), migrated.visibility);
});

test("host query markers enable hosted mode without a readable parent", () => {
  const { window } = runPrelude({ parent: "cross-origin", query: "?dmi=test&dmp=1" });

  assert.equal(window.__DASHBOARDMODERN_HOSTED__, true);
  assert.equal(window.__DASHBOARDMODERN_CONNECTION__.token, "__dashboardmodern_hosted__");
});

test("without a host the prelude is a no-op", () => {
  for (const parent of ["self", { __DASHBOARDMODERN_HOST__: false }, "cross-origin"]) {
    const { window, writes } = runPrelude({ parent });

    assert.equal(window.__DASHBOARDMODERN_HOSTED__, undefined);
    assert.equal(window.__DASHBOARDMODERN_CONNECTION__, undefined);
    assert.deepEqual(writes, []);
  }
});

test("the source contains no usable token handoff", () => {
  assert.doesNotMatch(PRELUDE, /__DASHBOARDMODERN_REAL_TOKEN__/);
  assert.doesNotMatch(PRELUDE, /access_token/);
  assert.doesNotMatch(PRELUDE, /LONG_LIVED_TOKEN/);
});