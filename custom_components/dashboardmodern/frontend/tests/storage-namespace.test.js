import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import test from "node:test";

const SCRIPT = readFileSync(
  fileURLToPath(new URL("../legacy/storage-namespace.js", import.meta.url)),
  "utf8",
);

/** Run the namespace shim in a mock window with a fake localStorage. */
function runWith({ instance, path = "/lovelace/plancia" }) {
  const store = {};
  const real = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
  const window = { location: { pathname: path }, localStorage: real };
  if (instance) window.__DASHBOARDMODERN_INSTANCE__ = instance;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      return real;
    },
    set() {},
  });
  // Allow redefining localStorage to the shim.
  let current = real;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      return current;
    },
    set(v) {
      current = v;
    },
  });
  const ctx = createContext({ window });
  runInContext(SCRIPT, ctx);
  return { window, store, ls: () => window.localStorage };
}

test("a managed key is rewritten under the instance prefix", () => {
  const { store, ls } = runWith({ instance: "casa1" });
  ls().setItem("cd_cameras", "[1,2,3]");

  // The real key carries the prefix; the plain key is never written.
  assert.equal(store["cd_casa1_cd_cameras"], "[1,2,3]");
  assert.equal(store["cd_cameras"], undefined);
});

test("what one instance writes, it reads back transparently", () => {
  const { ls } = runWith({ instance: "casa1" });
  ls().setItem("cd_connection", '{"token":"abc"}');

  assert.equal(ls().getItem("cd_connection"), '{"token":"abc"}');
});

test("two instances cannot see each other's keys", () => {
  const a = runWith({ instance: "integrazione" });
  a.ls().setItem("cd_connection", '{"token":"INTEGRATION"}');

  // A second dashboard on the same origin uses a different id and the same
  // underlying store — but sees nothing of the first.
  const b = runWith({ instance: "plancia", path: "/local/plancia.html" });
  // Point b at the same physical store as a.
  Object.assign(b.store, a.store);

  assert.equal(b.ls().getItem("cd_connection"), null);
  b.ls().setItem("cd_connection", '{"token":"PLANCIA"}');

  // Writing in b did not touch a's namespaced key.
  assert.equal(a.store["cd_integrazione_cd_connection"], '{"token":"INTEGRATION"}');
});

test("unmanaged keys from other apps are left completely alone", () => {
  const { store, ls } = runWith({ instance: "casa1" });
  ls().setItem("some_other_app_setting", "x");

  // No prefix: the key is written verbatim, so the shim never interferes with
  // anything that is not a dashboard key.
  assert.equal(store["some_other_app_setting"], "x");
});

test("without an explicit id, the path yields a stable per-document id", () => {
  const one = runWith({ path: "/local/dash-a.html" });
  one.ls().setItem("cd_theme", "dark");
  const two = runWith({ path: "/local/dash-b.html" });
  two.ls().setItem("cd_theme", "light");

  // Different paths → different prefixes → no collision, even with no id set.
  const keys = Object.keys({ ...one.store, ...two.store }).filter((k) => k.includes("cd_theme"));
  assert.equal(new Set(keys).size, 2);
});

test("clear removes only this instance's keys", () => {
  const { store, ls } = runWith({ instance: "casa1" });
  store["cd_altrodash_cd_cameras"] = "keep";
  ls().setItem("cd_cameras", "mine");

  ls().clear();

  assert.equal(store["cd_casa1_cd_cameras"], undefined);
  // Another dashboard's namespaced key survives.
  assert.equal(store["cd_altrodash_cd_cameras"], "keep");
});
