import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import test from "node:test";

const PRELUDE = readFileSync(
  fileURLToPath(new URL("../legacy/bridge-prelude.js", import.meta.url)),
  "utf8",
);

/** Run the prelude in a mock document, mirroring how the iframe loads it. */
function runPrelude({ parent, host = "ha.local:8123", storage = {}, throwOnParent = false }) {
  const writes = [];
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
  }
  const window = {
    location: { host },
    WebSocket: MockWebSocket,
    localStorage: {
      getItem: (key) => (key in storage ? storage[key] : null),
      setItem: (key, value) => {
        writes.push(key);
        storage[key] = String(value);
      },
    },
  };
  Object.defineProperty(window, "parent", {
    get() {
      if (throwOnParent) throw new Error("cross-origin");
      return parent === "self" ? window : parent;
    },
  });
  const context = createContext({ window });
  runInContext(PRELUDE, context);
  return { window, storage, writes };
}

test("when hosted, the placeholder is exposed in memory, not stored", () => {
  const { window } = runPrelude({ parent: { __DASHBOARDMODERN_HOST__: true } });

  assert.equal(window.__DASHBOARDMODERN_HOSTED__, true);
  assert.equal(window.__DASHBOARDMODERN_CONNECTION__.token, "__dashboardmodern_hosted__");
  assert.equal(window.__DASHBOARDMODERN_CONNECTION__.local_ip, "ha.local:8123");
});

test("the prelude never writes to the shared localStorage", () => {
  // Two dashboards on one host share localStorage. Writing cd_connection here
  // is exactly what broke the standalone dashboard's real token.
  const { writes } = runPrelude({ parent: { __DASHBOARDMODERN_HOST__: true } });

  assert.deepEqual(writes, []);
});

test("an existing standalone connection is left untouched", () => {
  const storage = {
    cd_connection: JSON.stringify({ token: "real-standalone-token", dashboard_path: "/lovelace/2" }),
  };

  runPrelude({ parent: { __DASHBOARDMODERN_HOST__: true }, storage });

  // The standalone dashboard's own token survives intact.
  assert.equal(JSON.parse(storage.cd_connection).token, "real-standalone-token");
});

test("without a host the prelude is a no-op", () => {
  for (const scenario of [
    { parent: "self" },
    { parent: { __DASHBOARDMODERN_HOST__: false } },
    { parent: {}, throwOnParent: true },
  ]) {
    const { window, writes } = runPrelude(scenario);

    assert.equal(window.__DASHBOARDMODERN_HOSTED__, undefined);
    assert.equal(window.__DASHBOARDMODERN_CONNECTION__, undefined);
    assert.deepEqual(writes, []);
  }
});

test("the in-memory placeholder is not a usable Home Assistant credential", () => {
  const { window } = runPrelude({ parent: { __DASHBOARDMODERN_HOST__: true } });
  const token = window.__DASHBOARDMODERN_CONNECTION__.token;

  // A real Home Assistant token is a JWT. This is not, so anything trying to
  // authenticate with it gets nothing — which is the point.
  assert.equal(token.startsWith("eyJ"), false);
  assert.equal(token.includes("."), false);
});
