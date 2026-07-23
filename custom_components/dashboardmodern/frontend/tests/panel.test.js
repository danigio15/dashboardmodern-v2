import assert from "node:assert/strict";
import test from "node:test";

globalThis.HTMLElement = class {};
globalThis.customElements = { get() {}, define() {} };

const { createLegacyFrame, entryIdsFromPanel, legacyDashboardUrl } = await import("../panel.js");

test("legacy dashboard URL stays inside the versioned frontend mount", () => {
  assert.equal(
    legacyDashboardUrl("https://ha.local/dashboardmodern_static/abc123/panel.js"),
    "https://ha.local/dashboardmodern_static/abc123/legacy/dashboard.html?embedded=1",
  );
});

test("missing config entry id yields no entry ids", () => {
  assert.deepEqual(entryIdsFromPanel({ config: {} }), []);
});

test("panel entry ids are filtered without changing their order", () => {
  assert.deepEqual(
    entryIdsFromPanel({ config: { entry_ids: ["b", "", null, "a"] } }),
    ["b", "a"],
  );
});

test("legacy iframe enables the capabilities used by the original dashboard", () => {
  const attributes = new Map();
  const iframe = {
    className: "",
    title: "",
    src: "",
    loading: "",
    referrerPolicy: "",
    allow: "",
    setAttribute(name, value) { attributes.set(name, value); },
  };
  const documentRef = { createElement: (name) => {
    assert.equal(name, "iframe");
    return iframe;
  } };

  const result = createLegacyFrame(documentRef, "https://ha.local/legacy/dashboard.html");

  assert.equal(result, iframe);
  assert.equal(iframe.src, "https://ha.local/legacy/dashboard.html");
  assert.match(iframe.allow, /camera/);
  assert.match(iframe.allow, /fullscreen/);
  assert.equal(attributes.get("allowfullscreen"), "");
});
