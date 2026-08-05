import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import test from "node:test";

const PRELUDE = readFileSync(
  fileURLToPath(new URL("../legacy/bridge-prelude.js", import.meta.url)),
  "utf8",
);

function runPrelude({ parent: parentValue, host = "ha.local:8123", storage = {}, query = "", SocketCtor } = {}) {
  const writes = [];
  const listeners = new Map();
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
    WebSocket: SocketCtor || MockWebSocket,
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
    setTimeout,
  };
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
    dispatch(type) {
      listeners.get(type)?.();
    },
  };
}

test("hosted mode uses a network-inert stub until the explicit bridge exists", () => {
  const { window } = runPrelude({ parent: { __DASHBOARDMODERN_HOST__: true } });

  assert.equal(window.__DASHBOARDMODERN_HOSTED__, true);
  assert.equal(window.__DASHBOARDMODERN_CONNECTION__.token, "__dashboardmodern_hosted__");
  assert.equal(window.__DASHBOARDMODERN_CONNECTION__.local_ip, "ha.local:8123");
  assert.equal(window.__DASHBOARDMODERN_REAL_TOKEN__, undefined);
  assert.equal(window.DASHBOARDMODERN_AUTH_TOKEN, undefined);
  assert.equal(window.WebSocket.name, "StubSocket");
  assert.equal(window.WebSocket.__dmHostedStub, true);
  assert.equal(window.__DASHBOARDMODERN_BRIDGED__, undefined);
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

test("a WebView-native constructor without native-code text is never trusted", () => {
  let constructed = 0;
  function AndroidWebViewSocket() {
    constructed += 1;
  }
  AndroidWebViewSocket.toString = () => "function WebSocket() { [android bridge] }";

  const { window } = runPrelude({
    parent: { __DASHBOARDMODERN_HOST__: true },
    SocketCtor: AndroidWebViewSocket,
  });

  assert.equal(window.WebSocket.name, "StubSocket");
  assert.equal(window.WebSocket.__dmHostedStub, true);
  assert.equal(constructed, 0);
  assert.notEqual(window.__DASHBOARDMODERN_BRIDGE_WS__, AndroidWebViewSocket);
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

test("host query markers enable hosted mode without a readable parent", () => {
  const { window } = runPrelude({ parent: "cross-origin", query: "?dmi=test&dmp=1" });

  assert.equal(window.__DASHBOARDMODERN_HOSTED__, true);
  assert.equal(window.__DASHBOARDMODERN_CONNECTION__.token, "__dashboardmodern_hosted__");
  assert.equal(window.WebSocket.__dmHostedStub, true);
});

test("without a host the prelude is a no-op", () => {
  for (const parent of ["self", { __DASHBOARDMODERN_HOST__: false }, "cross-origin"]) {
    const { window, writes } = runPrelude({ parent });

    assert.equal(window.__DASHBOARDMODERN_HOSTED__, undefined);
    assert.equal(window.__DASHBOARDMODERN_CONNECTION__, undefined);
    assert.deepEqual(writes, []);
  }
});

test("the source contains no usable token handoff or WebSocket source heuristic", () => {
  assert.doesNotMatch(PRELUDE, /__DASHBOARDMODERN_REAL_TOKEN__/);
  assert.doesNotMatch(PRELUDE, /access_token/);
  assert.doesNotMatch(PRELUDE, /LONG_LIVED_TOKEN/);
  assert.doesNotMatch(PRELUDE, /native code/);
  assert.doesNotMatch(PRELUDE, /PRELUDE_WEBSOCKET|DeferredSocket/);
});
